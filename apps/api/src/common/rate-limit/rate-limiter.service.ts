import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppException } from '../exceptions/app.exception';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface ConsumeOptions {
  readonly max: number;
  readonly windowSeconds: number;
}

export interface RateLimitResult {
  readonly limit: number;
  readonly remaining: number;
  /** Секунд до полного долива бакета — для `X-RateLimit-Reset`. */
  readonly resetSeconds: number;
}

/**
 * Token bucket целиком внутри одного `EVAL`: два параллельных запроса иначе
 * оба прочитали бы «1 токен» и оба списали. Возвращает `{allowed, tokens,
 * reset_ms, retry_ms}`; Redis усекает числа Lua до целых на возврате — отсюда
 * `math.floor`/`math.ceil` в скрипте.
 */
const TOKEN_BUCKET_LUA = `
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = now - ts
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * refill)

local allowed = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
end

redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[1], ttl)

local reset_ms = math.ceil((capacity - tokens) / refill)
local retry_ms = 0
if allowed == 0 then
  retry_ms = math.ceil((1 - tokens) / refill)
end

return { allowed, math.floor(tokens), reset_ms, retry_ms }
`;

/**
 * Спека 012. Заменяет `FixedWindowRateLimiterService` (007): та же сигнатура
 * `consume()`, тот же бросок `RATE_LIMIT_EXCEEDED` при превышении — но token
 * bucket в Redis, переживающий рестарт и общий между экземплярами.
 *
 * Redis недоступен → fail-open (`ARCHITECTURE.md` §9: «отсутствие проверки
 * частоты допустимо»): запрос проходит, в лог — предупреждение. Проверка
 * ключа/пароля Redis не касается — fail-closed там соблюдён по построению.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(
    key: string,
    { max, windowSeconds }: ConsumeOptions,
  ): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const refillPerMs = max / windowMs;

    let raw: unknown;
    try {
      raw = await this.redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        key,
        max,
        refillPerMs,
        Date.now(),
        windowMs,
      );
    } catch (error) {
      this.logger.warn(
        `Rate limit fail-open — Redis недоступен: ${asMessage(error)}`,
      );
      return { limit: max, remaining: max, resetSeconds: 0 };
    }

    const [allowed, remaining, resetMs, retryMs] = raw as [
      number,
      number,
      number,
      number,
    ];

    if (allowed !== 1) {
      throw new AppException('RATE_LIMIT_EXCEEDED', {
        retry_after_seconds: Math.max(1, Math.ceil(retryMs / 1000)),
      });
    }

    return {
      limit: max,
      remaining,
      resetSeconds: Math.ceil(resetMs / 1000),
    };
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
