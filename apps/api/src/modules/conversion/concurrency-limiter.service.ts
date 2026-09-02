import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { MetricsService } from '../metrics/metrics.service';

const MAX_CONCURRENT_PER_KEY = 3;

/**
 * В памяти процесса, не Redis (решение владельца, спека 005) — корректно для
 * текущего нераспределённого деплоя; последний in-memory лимитер (лимит
 * частоты переехал на Redis в 012). Ключ — `userId` реального пользователя
 * или хеш IP гостя (тот же паттерн анонимной идентичности, что и лимит
 * частоты, TECH-SPEC.md §6) — вызывающий код решает, что передать.
 */
@Injectable()
export class ConcurrencyLimiterService {
  private readonly active = new Map<string, number>();

  constructor(private readonly metrics: MetricsService) {}

  acquire(key: string): void {
    const current = this.active.get(key) ?? 0;
    if (current >= MAX_CONCURRENT_PER_KEY) {
      throw new AppException('CONCURRENCY_LIMIT_EXCEEDED', {
        limit: MAX_CONCURRENT_PER_KEY,
      });
    }
    this.active.set(key, current + 1);
    this.metrics.conversionsInFlight.inc();
  }

  release(key: string): void {
    const current = this.active.get(key) ?? 0;
    if (current <= 1) {
      this.active.delete(key);
    } else {
      this.active.set(key, current - 1);
    }
    this.metrics.conversionsInFlight.dec();
  }
}
