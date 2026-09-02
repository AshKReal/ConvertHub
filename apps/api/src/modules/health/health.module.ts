import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Спека 014. `PrismaModule`/`RedisModule` — `@Global`, в `imports` не нужны.
 * Руками, без `@nestjs/terminus`: две проверки (`SELECT 1`, `PING`).
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
