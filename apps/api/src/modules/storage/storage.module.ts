import { Module } from '@nestjs/common';
import { env } from '../../config/env';
import { LocalDiskRawController } from './local-disk-raw.controller';
import { LocalDiskStorage } from './local-disk.storage';
import { S3Storage } from './s3.storage';
import { STORAGE } from './storage.interface';
import type { Storage } from './storage.interface';

/**
 * Спека 016. `STORAGE_DRIVER` выбирает реализацию `Storage`. `local`
 * (умолчание) — `LocalDiskStorage` + `GET /v1/storage/local/raw` (стенд-ин
 * под presigned URL, 003); `s3` — `S3Storage`, отдачи через приложение нет,
 * raw-контроллер не регистрируется.
 */
const isS3 = env.STORAGE_DRIVER === 's3';

@Module({
  controllers: isS3 ? [] : [LocalDiskRawController],
  providers: [
    {
      provide: STORAGE,
      useFactory: (): Storage =>
        isS3 ? new S3Storage() : new LocalDiskStorage(),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
