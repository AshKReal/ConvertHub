import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  IDEMPOTENCY_TTL_SECONDS,
  MAX_FILE_SIZE_BYTES,
} from '@convert-hub/shared';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

export interface IdempotentResult {
  readonly mime: string;
  readonly fileId: string | null;
  readonly saveSkippedQuota: boolean;
  readonly body: Buffer;
}

export type BeginOutcome =
  | { readonly state: 'new' }
  | { readonly state: 'conflict' }
  | { readonly state: 'replay'; readonly result: IdempotentResult }
  | { readonly state: 'unavailable' };

interface StoredResult {
  readonly mime: string;
  readonly fileId: string | null;
  readonly saveSkippedQuota: boolean;
  readonly bodyB64: string;
}

const PROCESSING = 'processing';

/**
 * Спека 012. `Idempotency-Key` на `POST /v1/convert` (TECH-SPEC.md §7.3).
 * `SET NX` — замок: первый запрос кладёт `"processing"`, дальше пишет туда
 * сериализованный ответ; повтор в течение `IDEMPOTENCY_TTL_SECONDS` получает
 * его назад без повторной конвертации. Повтор во время выполнения первого →
 * `conflict` (`409`). Redis недоступен → `unavailable` — обычная обработка
 * без идемпотентности (fail-open, принятый риск «двойная конвертация»,
 * `ARCHITECTURE.md` §9).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly ttlMs = IDEMPOTENCY_TTL_SECONDS * 1000;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async begin(scope: string, key: string): Promise<BeginOutcome> {
    const redisKey = buildKey(scope, key);
    try {
      const set = await this.redis.set(
        redisKey,
        PROCESSING,
        'PX',
        this.ttlMs,
        'NX',
      );
      if (set === 'OK') {
        return { state: 'new' };
      }

      const stored = await this.redis.get(redisKey);
      if (stored === null) {
        // Истёк между NX и GET — редкая гонка; идём без замка.
        return { state: 'new' };
      }
      if (stored === PROCESSING) {
        return { state: 'conflict' };
      }
      return { state: 'replay', result: deserialize(stored) };
    } catch (error) {
      this.logger.warn(
        `Идемпотентность fail-open — Redis недоступен: ${asMessage(error)}`,
      );
      return { state: 'unavailable' };
    }
  }

  async complete(
    scope: string,
    key: string,
    result: IdempotentResult,
  ): Promise<void> {
    if (result.body.length > MAX_FILE_SIZE_BYTES) {
      // Потолок хранения (решение владельца) — повтор просто переконвертирует.
      return;
    }
    try {
      await this.redis.set(
        buildKey(scope, key),
        serialize(result),
        'PX',
        this.ttlMs,
      );
    } catch (error) {
      this.logger.warn(
        `Идемпотентность: результат не сохранён (${asMessage(error)}) — повтор переконвертирует`,
      );
    }
  }
}

function buildKey(scope: string, key: string): string {
  return `idem:${scope}:${key}`;
}

function serialize(result: IdempotentResult): string {
  const stored: StoredResult = {
    mime: result.mime,
    fileId: result.fileId,
    saveSkippedQuota: result.saveSkippedQuota,
    bodyB64: result.body.toString('base64'),
  };
  return JSON.stringify(stored);
}

function deserialize(raw: string): IdempotentResult {
  const stored = JSON.parse(raw) as StoredResult;
  return {
    mime: stored.mime,
    fileId: stored.fileId,
    saveSkippedQuota: stored.saveSkippedQuota,
    body: Buffer.from(stored.bodyB64, 'base64'),
  };
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
