import { Injectable } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';

interface Window {
  count: number;
  resetAt: number;
}

export interface ConsumeOptions {
  readonly max: number;
  readonly windowSeconds: number;
}

/**
 * Обобщённый (не только auth) fixed-window счётчик в памяти процесса —
 * временная замена настоящего Redis token bucket (спека 012, решение
 * владельца). Конкретный класс, не интерфейс: `backend.md` разрешает ровно
 * две абстракции (`Storage`, `ConversionEngine`); 012 заменит этот файл
 * целиком Redis-версией с той же сигнатурой `consume()`, как уже сделано
 * для `ConcurrencyLimiterService` (005) — там тот же паттерн "in-memory
 * сейчас, Redis потом, без промежуточного интерфейса".
 */
@Injectable()
export class FixedWindowRateLimiterService {
  private readonly windows = new Map<string, Window>();

  consume(key: string, { max, windowSeconds }: ConsumeOptions): void {
    const now = Date.now();
    const window = this.windows.get(key);

    if (window === undefined || now >= window.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return;
    }

    if (window.count >= max) {
      throw new AppException('RATE_LIMIT_EXCEEDED', {
        retry_after_seconds: Math.ceil((window.resetAt - now) / 1000),
      });
    }

    window.count += 1;
  }
}
