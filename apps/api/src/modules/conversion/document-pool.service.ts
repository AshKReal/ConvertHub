import { Injectable } from '@nestjs/common';
import {
  DOCUMENT_POOL_SIZE,
  DOCUMENT_POOL_WAIT_SECONDS,
} from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { MetricsService } from '../metrics/metrics.service';

interface Waiter {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

/**
 * Спека 018 (TECH-SPEC.md §6). Глобальный семафор на `DOCUMENT_POOL_SIZE`
 * одновременных `DOCX→PDF` — LibreOffice за Gotenberg держит ~150–300 МБ на
 * вызов, десяток параллельных исчерпает память. Запрос сверх лимита ждёт до
 * `DOCUMENT_POOL_WAIT_SECONDS`, затем `SERVICE_OVERLOADED` + `Retry-After`.
 *
 * Отдельно от `ConcurrencyLimiterService` (3 на идентичность, 005): тот
 * ограничивает одного пользователя, этот — общий ресурс движка.
 */
@Injectable()
export class DocumentPoolService {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(private readonly metrics: MetricsService) {}

  acquire(): Promise<void> {
    if (this.active < DOCUMENT_POOL_SIZE) {
      this.active += 1;
      this.metrics.documentPoolActive.inc();
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((w) => w.timer === timer);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        }
        reject(
          new AppException('SERVICE_OVERLOADED', {
            retry_after_seconds: DOCUMENT_POOL_WAIT_SECONDS,
          }),
        );
      }, DOCUMENT_POOL_WAIT_SECONDS * 1000);
      timer.unref();
      this.waiters.push({ resolve, reject, timer });
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next !== undefined) {
      // Слот передан следующему в очереди — `active` не меняется, метрика
      // тоже (один вышел, один вошёл).
      clearTimeout(next.timer);
      next.resolve();
      return;
    }
    this.active -= 1;
    this.metrics.documentPoolActive.dec();
  }
}
