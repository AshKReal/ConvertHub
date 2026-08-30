import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IdentityProvider, Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import {
  JWT_REFRESH_TTL_SECONDS,
  REFRESH_REUSE_GRACE_SECONDS,
  type OauthProvider,
} from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { hashOpaqueToken, TokenService } from './token.service';

/**
 * OWASP-минимум для argon2id — `AUTH-RULES.md` называет алгоритм, не
 * параметры (docs/SECURITY.md). Экспортирован — `account.service.ts` (009)
 * хеширует новый пароль теми же параметрами при сбросе/смене.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Фиксированный хеш заведомо несуществующего пароля — при входе с
 * несуществующим email всё равно вызывается `argon2.verify` против него.
 * Без этого время ответа само выдаёт, существует ли аккаунт: реальная
 * проверка пароля занимает заметно дольше, чем немедленный отказ (тот же
 * инвариант, что запрещает разные тексты ошибки, `AUTH-RULES.md` §2, но
 * для тайминга, а не текста).
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$xW7V0tPUTV2jYNJBCx/TyA$ZIk4jH422Ca5UpkeqWwinDa5wAqNIlYUHkWotNazjuQ';

/**
 * Спека 008. `IdentityProvider` из Prisma (`GOOGLE`) → публичное значение
 * (`google`, `packages/shared`) — единая точка перевода, не разбрасывать
 * `.toLowerCase()`-касты по коду. Растёт вместе с `IdentityProvider` enum.
 */
export const PROVIDER_LABELS: Record<IdentityProvider, OauthProvider> = {
  [IdentityProvider.GOOGLE]: 'google',
};

/**
 * Форма пользователя сразу после аутентификации, ДО того как известны его
 * привязанные идентичности — `hasPassword` каждый вызывающий уже знает из
 * своего собственного запроса (не отдельный запрос ради одного поля).
 */
export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly hasPassword: boolean;
}

/**
 * Дальше сокращённая форма пользователя, которую отдаём наружу — не Prisma-
 * объект (`backend.md`). `providers` не `readonly` — форма совпадает с
 * `AuthUser` (`packages/shared`, `z.array(...)` инферит мутируемый массив).
 */
export interface SessionUser extends AuthUserRecord {
  readonly providers: OauthProvider[];
}

export interface IssuedSession {
  readonly accessToken: string;
  readonly refreshToken: { readonly raw: string; readonly expiresAt: Date };
  readonly user: SessionUser;
}

const MAX_GRACE_HOPS = 5;

/**
 * Prisma + argon2 — ничего не знает про `Request`/`Response`/cookie
 * (`ARCHITECTURE.md` §4.1), их выставляет `auth.controller.ts`.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: {
    email: string;
    password: string;
  }): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    try {
      const user = await this.prisma.user.create({
        data: { id: ulid(), email, passwordHash },
        select: { id: true, email: true },
      });
      // Только что создан с паролем и без единой идентичности — тривиально,
      // без отдельного запроса.
      return this.issueSession({ ...user, hasPassword: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException('EMAIL_ALREADY_REGISTERED');
      }
      throw error;
    }
  }

  /** Единый `INVALID_CREDENTIALS` на неизвестный email и на неверный пароль (`AUTH-RULES.md` §2). */
  async login(input: {
    email: string;
    password: string;
  }): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    const passwordValid = await argon2.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (user === null || !passwordValid) {
      throw new AppException('INVALID_CREDENTIALS');
    }

    // Явно {id, email, hasPassword}, не весь `user` из Prisma — тот несёт
    // `passwordHash` (нужен только что для `argon2.verify` выше). `AuthUserRecord`
    // как ТИП параметра `issueSession` этого не ловит: TS не проверяет лишние
    // поля на переменной, только на литерале — рантайм сериализовал бы хеш
    // пароля прямо в тело ответа. Найдено ручным curl-тестом, не тайпчеком
    // (`AUTH-RULES.md` §2 — тут и обещано, что так поймают).
    return this.issueSession({
      id: user.id,
      email: user.email,
      hasPassword: user.passwordHash !== null,
    });
  }

  async refresh(rawToken: string): Promise<IssuedSession> {
    return this.resolveRefresh(hashOpaqueToken(rawToken), 0);
  }

  /** Идемпотентно — токен уже не найден/отозван не считается ошибкой вызывающего. */
  async logout(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashOpaqueToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async resolveRefresh(
    tokenHash: string,
    hops: number,
  ): Promise<IssuedSession> {
    if (hops > MAX_GRACE_HOPS) {
      throw new AppException('UNAUTHENTICATED');
    }

    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    const now = new Date();

    if (token === null || token.revokedAt !== null || token.expiresAt < now) {
      throw new AppException('UNAUTHENTICATED');
    }

    if (token.usedAt === null) {
      return this.rotate(token, tokenHash, now);
    }

    // Уже ротирован. В пределах окна терпимости (решение владельца,
    // ARCHITECTURE.md §7) — не кража, идём по цепочке к актуальному звену.
    const graceDeadline = new Date(
      token.usedAt.getTime() + REFRESH_REUSE_GRACE_SECONDS * 1000,
    );
    if (now > graceDeadline || token.replacedById === null) {
      await this.revokeAllSessions(token.userId, now);
      throw new AppException('UNAUTHENTICATED');
    }

    const next = await this.prisma.refreshToken.findUnique({
      where: { id: token.replacedById },
    });
    if (next === null) {
      throw new AppException('UNAUTHENTICATED');
    }
    return this.resolveRefresh(next.tokenHash, hops + 1);
  }

  private async rotate(
    token: { id: string; userId: string },
    tokenHash: string,
    now: Date,
  ): Promise<IssuedSession> {
    const next = this.tokenService.generateRefreshToken();
    const newId = ulid();
    const expiresAt = new Date(now.getTime() + JWT_REFRESH_TTL_SECONDS * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      // Conditional update, не read-then-write: два одновременных `refresh`
      // с одним и тем же токеном иначе оба посчитали бы его неиспользованным.
      const updated = await tx.refreshToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now, replacedById: newId },
      });
      if (updated.count !== 1) {
        return null;
      }
      await tx.refreshToken.create({
        data: {
          id: newId,
          userId: token.userId,
          tokenHash: next.hash,
          expiresAt,
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: token.userId },
        select: { id: true, email: true, passwordHash: true },
      });
    });

    if (user === null) {
      // Гонку выиграл другой параллельный `refresh` с тем же токеном между
      // `findUnique` и этим `updateMany` — не кража, тот же токен просто
      // уже ротирован кем-то ещё; повторный проход находит его через окно
      // терпимости и выдаёт сессию с актуального звена.
      return this.resolveRefresh(tokenHash, 0);
    }

    // Актуальное состояние на момент обновления, не то, что было при
    // исходном входе — пользователь мог привязать/отвязать Google в другой
    // вкладке между двумя `refresh`.
    const sessionUser = await this.withProviders({
      id: user.id,
      email: user.email,
      hasPassword: user.passwordHash !== null,
    });

    return {
      accessToken: this.tokenService.signAccessToken({
        userId: sessionUser.id,
        email: sessionUser.email,
      }),
      refreshToken: { raw: next.raw, expiresAt },
      user: sessionUser,
    };
  }

  private async revokeAllSessions(userId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async issueSession(user: AuthUserRecord): Promise<IssuedSession> {
    const sessionUser = await this.withProviders(user);
    const refresh = this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);
    await this.prisma.refreshToken.create({
      data: { id: ulid(), userId: user.id, tokenHash: refresh.hash, expiresAt },
    });
    return {
      accessToken: this.tokenService.signAccessToken({
        userId: sessionUser.id,
        email: sessionUser.email,
      }),
      refreshToken: { raw: refresh.raw, expiresAt },
      user: sessionUser,
    };
  }

  /** Спека 008. Единственное место, где список привязанных провайдеров запрашивается у БД. */
  private async withProviders(user: AuthUserRecord): Promise<SessionUser> {
    const identities = await this.prisma.identity.findMany({
      where: { userId: user.id },
      select: { provider: true },
    });
    return {
      ...user,
      providers: identities.map(
        (identity) => PROVIDER_LABELS[identity.provider],
      ),
    };
  }
}

/** Экспортирован — `account.service.ts` (009) нормализует email тем же приёмом при запросе сброса пароля. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
