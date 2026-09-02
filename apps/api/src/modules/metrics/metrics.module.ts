import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Спека 014. `@Global` — `MetricsService` инжектится в `conversion`,
 * `exceptions`, `concurrency-limiter` без ритуального импорта в каждый
 * модуль (тот же прецедент, что `PrismaModule`/`RedisModule`).
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
