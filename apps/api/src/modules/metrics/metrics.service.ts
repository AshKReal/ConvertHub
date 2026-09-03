import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Спека 014. `@Global` (`MetricsModule`) — счётчики трогаются из `conversion`,
 * `exceptions`, `concurrency-limiter`; тот же приём, что `PrismaModule`.
 * Свой `Registry`, не глобальный синглтон `@prometheus-io/client` — состояние
 * не переживает между тестами.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  /** Число конвертаций по направлению и итогу — инкремент в `ConversionHistoryService`. */
  readonly conversionsTotal = new Counter({
    name: 'converthub_conversions_total',
    help: 'Conversions by direction and outcome.',
    labelNames: ['direction', 'status'],
    registers: [this.registry],
  });

  /** Гистограмма длительности конвертации (с). */
  readonly conversionDuration = new Histogram({
    name: 'converthub_conversion_duration_seconds',
    help: 'Conversion wall time by direction.',
    labelNames: ['direction'],
    buckets: [0.05, 0.1, 0.3, 1, 3, 8, 30],
    registers: [this.registry],
  });

  /** Число ответов-ошибок по коду — инкремент в `AllExceptionsFilter`. */
  readonly httpErrorsTotal = new Counter({
    name: 'converthub_http_errors_total',
    help: 'Error responses by machine-readable code.',
    labelNames: ['code'],
    registers: [this.registry],
  });

  /** Конвертаций «в работе» прямо сейчас — inc/dec в `ConcurrencyLimiterService`. */
  readonly conversionsInFlight = new Gauge({
    name: 'converthub_conversions_in_flight',
    help: 'Conversions currently holding a concurrency slot.',
    registers: [this.registry],
  });

  /** Спека 018. Занятых слотов пула документных конвертаций (Gotenberg) — inc/dec в `DocumentPoolService`. 014 отложил эту метрику сюда. */
  readonly documentPoolActive = new Gauge({
    name: 'converthub_document_pool_active',
    help: 'DOCX->PDF conversions currently holding a document-pool slot.',
    registers: [this.registry],
  });

  private readonly storageUsedBytes = new Gauge({
    name: 'converthub_storage_used_bytes',
    help: 'Sum of users.storage_used_bytes.',
    registers: [this.registry],
  });

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Динамические гейджи, которые считаются из БД, — обновляются перед
   * скрейпом (`MetricsController`). Один агрегат на скрейп вместо счётчика в
   * памяти, который разъедётся с БД при рестарте и денормализации (010).
   */
  async refreshDynamicGauges(): Promise<void> {
    const { _sum } = await this.prisma.user.aggregate({
      _sum: { storageUsedBytes: true },
    });
    this.storageUsedBytes.set(_sum.storageUsedBytes ?? 0);
  }
}
