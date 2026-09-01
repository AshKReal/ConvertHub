import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiKeyEnvironment, Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import {
  MAX_ACTIVE_API_KEYS,
  type ApiKeyListItem,
  type IssuedApiKey,
} from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

/** Видимый набор из примера `TECH-SPEC.md` §7.1 (`ch_live_a1b2c3d4…`). */
const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const KEY_RANDOM_LENGTH = 32;
const KEY_ENV_PART = 'ch_live_';
/** `ch_live_` + первые 4 символа случайной части — маска в списке (`TECH-SPEC.md` §8.4). */
const PREFIX_LENGTH = KEY_ENV_PART.length + 4;

const API_KEY_LIST_SELECT = {
  id: true,
  environment: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
} satisfies Prisma.ApiKeySelect;

type ApiKeyRow = Prisma.ApiKeyGetPayload<{
  select: typeof API_KEY_LIST_SELECT;
}>;

/** Prisma-энум (`LIVE`) → публичное значение (`live`, `packages/shared`) — единая точка перевода, как `PROVIDER_LABELS` в `auth.service.ts`. */
const ENVIRONMENT_LABELS: Record<
  ApiKeyEnvironment,
  ApiKeyListItem['environment']
> = {
  [ApiKeyEnvironment.LIVE]: 'live',
  [ApiKeyEnvironment.TEST]: 'test',
};

/**
 * Спека 011. Управление API-ключами под сессией пользователя (никогда по
 * самому ключу — `TECH-SPEC.md` §8.1). Prisma + генерация; ничего не знает
 * про `Request`/`Response` (`ARCHITECTURE.md` §4.1).
 */
@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ApiKeyListItem[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { id: 'desc' },
      select: API_KEY_LIST_SELECT,
    });
    return rows.map(toListItem);
  }

  async issue(userId: string): Promise<IssuedApiKey> {
    await this.assertUnderLimit(userId);
    const generated = generateApiKey();
    const row = await this.prisma.apiKey.create({
      data: newKeyData(userId, generated),
      select: API_KEY_LIST_SELECT,
    });
    return { ...toListItem(row), fullValue: generated.fullValue };
  }

  /**
   * Старый ключ становится недействителен немедленно (`revokedAt`), в ответе —
   * новое полное значение один раз. Перевыпуск уже отозванного/чужого ключа →
   * `API_KEY_NOT_FOUND` (UI перевыпускает только активные строки).
   */
  async reissue(userId: string, id: string): Promise<IssuedApiKey> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId, revokedAt: null },
      select: { id: true },
    });
    if (existing === null) {
      throw new AppException('API_KEY_NOT_FOUND');
    }

    const generated = generateApiKey();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.apiKey.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      return tx.apiKey.create({
        data: newKeyData(userId, generated),
        select: API_KEY_LIST_SELECT,
      });
    });
    return { ...toListItem(row), fullValue: generated.fullValue };
  }

  /**
   * Чужой/несуществующий id → `API_KEY_NOT_FOUND` (не раскрывает, какой из
   * двух — `critical-zones.md`). Свой уже отозванный → идемпотентный `204`,
   * как повторный `logout` (007).
   */
  async revoke(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId },
      select: { revokedAt: true },
    });
    if (existing === null) {
      throw new AppException('API_KEY_NOT_FOUND');
    }
    if (existing.revokedAt !== null) {
      return;
    }
    await this.prisma.apiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async assertUnderLimit(userId: string): Promise<void> {
    // Чтение `count` вне транзакции с `create` — параллельные выпуски одного
    // пользователя теоретически проведут (N+1)-й ключ. Тот же принятый класс
    // гонки, что квота (010) и in-memory лимитеры (005/007); не 🔒-инвариант.
    const activeCount = await this.prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_API_KEYS) {
      throw new AppException('API_KEY_LIMIT_REACHED', {
        max: MAX_ACTIVE_API_KEYS,
      });
    }
  }
}

interface GeneratedApiKey {
  readonly fullValue: string;
  readonly keyHash: string;
  readonly prefix: string;
}

function newKeyData(
  userId: string,
  generated: GeneratedApiKey,
): Prisma.ApiKeyUncheckedCreateInput {
  return {
    id: ulid(),
    userId,
    keyHash: generated.keyHash,
    prefix: generated.prefix,
    environment: ApiKeyEnvironment.LIVE,
  };
}

function toListItem(row: ApiKeyRow): ApiKeyListItem {
  return {
    id: row.id,
    environment: ENVIRONMENT_LABELS[row.environment],
    maskedPrefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

/**
 * `ch_live_` + 32 символа `[a-z0-9]` (~165 бит). Хеш — SHA-256, не argon2
 * (`AUTH-RULES.md` §2: SHA-256 предписан для высокоэнтропийных ключей).
 * Свободная функция рядом с сервисом — как `generateOpaqueToken` в
 * `token.service.ts`.
 */
export function generateApiKey(): GeneratedApiKey {
  const fullValue = `${KEY_ENV_PART}${randomKeyChars(KEY_RANDOM_LENGTH)}`;
  return {
    fullValue,
    keyHash: createHash('sha256').update(fullValue).digest('hex'),
    prefix: fullValue.slice(0, PREFIX_LENGTH),
  };
}

/**
 * Отбраковка байтов ≥ 252 вместо `% 36` — модуло-остаток вносит небольшой
 * перекос к началу алфавита; для 🔒-ключа устраняется, хоть на 165 битах
 * это и косметика.
 */
function randomKeyChars(length: number): string {
  const cutoff = 256 - (256 % KEY_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < length) {
    for (const byte of randomBytes(length)) {
      if (chars.length >= length) {
        break;
      }
      if (byte < cutoff) {
        chars.push(KEY_ALPHABET.charAt(byte % KEY_ALPHABET.length));
      }
    }
  }
  return chars.join('');
}
