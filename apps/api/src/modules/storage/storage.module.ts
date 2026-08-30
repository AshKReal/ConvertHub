import { Module } from '@nestjs/common';
import { LocalDiskRawController } from './local-disk-raw.controller';
import { LocalDiskStorage } from './local-disk.storage';
import { STORAGE } from './storage.interface';

@Module({
  controllers: [LocalDiskRawController],
  providers: [{ provide: STORAGE, useClass: LocalDiskStorage }],
  exports: [STORAGE],
})
export class StorageModule {}
