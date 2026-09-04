import { Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ulid } from 'ulid';
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  type AuthUser,
} from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage.interface';
import { MailService } from '../mail/mail.service';
import {
  ARGON2_OPTIONS,
  AUTH_USER_SELECT,
  PROVIDER_LABELS,
  normalizeEmail,
  presentAuthUser,
} from './auth.service';
import { generateOpaqueToken, hashOpaqueToken } from './token.service';

/**
 * Prisma + argon2 + `MailService`/`Storage` — как и `AuthService`, ничего
 * не знает про `Request`/`Response`/cookie (`ARCHITECTURE.md` §4.1); cookie
 * на `DELETE /v1/auth/account` чистит контроллер, как на `logout`.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /**
   * Ничего не возвращает и не бросает из-за "email не найден" — ответ
   * вызывающему один и тот же независимо от результата (`TECH-SPEC.md` §8.5).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true },
    });
    if (user === null) {
      return;
    }

    const now = new Date();
    // Не больше одной живой ссылки одновременно — новый запрос гасит
    // предыдущие ещё не использованные токены этого пользователя.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    const token = generateOpaqueToken();
    const expiresAt = new Date(
      now.getTime() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000,
    );
    await this.prisma.passwordResetToken.create({
      data: { id: ulid(), userId: user.id, tokenHash: token.hash, expiresAt },
    });

    const link = `${env.CORS_ORIGIN}/reset-password/${token.raw}`;
    // Не `await`: синхронная отправка сделала бы ответ для существующего
    // email ощутимо медленнее (реальный SMTP), чем для несуществующего —
    // тот же тайминг-канал, что `login()` (007) уже закрыл dummy-хешем,
    // только на другой операции.
    void this.mail
      .send({
        to: user.email,
        subject: 'Reset your ConvertHub password',
        text: `Follow this link to reset your password: ${link}\n\nIf you didn't request this, ignore this email — your password won't change.`,
      })
      .catch((error: unknown) =>
        this.logger.error('Failed to send password reset email', error),
      );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (token === null || token.usedAt !== null || token.expiresAt < now) {
      throw new AppException('INVALID_RESET_TOKEN');
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    const user = await this.prisma.$transaction(async (tx) => {
      // Conditional update, не read-then-write — тот же приём, что ротация
      // refresh-токена (007): два одновременных `resetPassword` одним
      // токеном не оба посчитают его свежим.
      const updated = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      });
      if (updated.count !== 1) {
        return null;
      }
      const updatedUser = await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash },
        select: { id: true, email: true },
      });
      // AUTH-RULES.md §2: сброс пароля — всегда конец всех сессий.
      await tx.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return updatedUser;
    });

    if (user === null) {
      throw new AppException('INVALID_RESET_TOKEN');
    }

    void this.sendPasswordChangedNotice(user.email);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });

    // Спека 008: чисто-Google аккаунт (`passwordHash: null`) не имеет пароля,
    // который можно ввести верно — тот же код, что "неверный текущий пароль"
    // (честно: такого пароля не существует), без отдельного кода и без
    // `argon2.verify(null, ...)`, который бросил бы `TypeError`, а не
    // доменную ошибку. Профиль (008) скрывает саму форму для этого случая —
    // сюда можно дойти только curl'ом или гонкой с параллельной отвязкой.
    if (
      user.passwordHash === null ||
      !(await argon2.verify(user.passwordHash, currentPassword))
    ) {
      throw new AppException('INVALID_CREDENTIALS');
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    const now = new Date();
    // AUTH-RULES.md §2: смена пароля — всегда конец всех сессий.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    void this.sendPasswordChangedNotice(user.email);
  }

  /**
   * Спека 029. Возвращает обновлённый `AuthUser`, а не `void`: клиент показывает
   * имя в шапке и профиле сразу после сохранения, и следующий `GET /me` ради
   * двух полей, которые он только что записал, был бы лишним запросом.
   *
   * Сессии не отзываются, письмо не шлётся — в отличие от смены пароля
   * (`AUTH-RULES.md` §2). Имя не способ входа: его смена не даёт и не отнимает
   * доступ, поэтому и повода выкидывать другие вкладки нет.
   */
  async updateProfile(
    userId: string,
    input: { firstName: string; lastName: string },
  ): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName },
      select: {
        ...AUTH_USER_SELECT,
        identities: { select: { provider: true } },
      },
    });

    return presentAuthUser(
      this.storage,
      { ...user, hasPassword: user.passwordHash !== null },
      user.identities.map((identity) => PROVIDER_LABELS[identity.provider]),
    );
  }

  async deleteAccount(userId: string): Promise<void> {
    const files = await this.prisma.file.findMany({
      where: { userId },
      select: { storageKey: true },
    });

    // Спека 029. Аватар не строка в `files` — он вне квоты, — поэтому обход
    // ниже его не видит и без этой строки он остался бы в хранилище навсегда
    // после удаления аккаунта. Названо в спеке до кода именно потому, что
    // отсутствие правки ничего не ломает: сирота копится молча.
    const { avatarKey } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true },
    });
    const keys = [
      ...files.map((file) => file.storageKey),
      ...(avatarKey === null ? [] : [avatarKey]),
    ];

    // Best-effort, по одному — как `saveConversionResult` (003): один
    // упавший объект не должен остановить удаление остальных/аккаунта.
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.logger.error(`Failed to delete storage object ${key}`, error);
      }
    }

    // Каскад (onDelete Cascade на File/Conversion/RefreshToken/
    // PasswordResetToken, спека 009) стирает всё остальное одним вызовом.
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /** Не критична для ответа — просто не ждём её здесь же, ошибку логируем и не показываем вызывающему. */
  private sendPasswordChangedNotice(email: string): Promise<void> {
    return this.mail
      .send({
        to: email,
        subject: 'Your ConvertHub password was changed',
        text: "Your password was just changed. If this wasn't you, contact support immediately — all your other sessions have been signed out.",
      })
      .catch((error: unknown) =>
        this.logger.error('Failed to send password-changed notice', error),
      );
  }
}
