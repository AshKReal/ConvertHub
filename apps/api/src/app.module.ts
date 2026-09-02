import { Module } from '@nestjs/common';
import { ExceptionsModule } from './common/filters/exceptions.module';
import { RedisModule } from './common/redis/redis.module';
import { ApiKeyModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConversionModule } from './modules/conversion/conversion.module';
import { FilesModule } from './modules/files/files.module';
import { OpenapiModule } from './modules/openapi/openapi.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ExceptionsModule,
    PrismaModule,
    RedisModule,
    StorageModule,
    AuthModule,
    FilesModule,
    ConversionModule,
    ApiKeyModule,
    OpenapiModule,
  ],
})
export class AppModule {}
