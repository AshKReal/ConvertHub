import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './common/logging/logger.config';
import { ExceptionsModule } from './common/filters/exceptions.module';
import { RedisModule } from './common/redis/redis.module';
import { ApiKeyModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConversionModule } from './modules/conversion/conversion.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { OpenapiModule } from './modules/openapi/openapi.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    LoggerModule.forRoot(buildLoggerParams()),
    PrismaModule,
    RedisModule,
    // До ExceptionsModule: `AllExceptionsFilter` инжектит `MetricsService` (спека 014).
    MetricsModule,
    ExceptionsModule,
    StorageModule,
    AuthModule,
    FilesModule,
    ConversionModule,
    ApiKeyModule,
    OpenapiModule,
    HealthModule,
  ],
})
export class AppModule {}
