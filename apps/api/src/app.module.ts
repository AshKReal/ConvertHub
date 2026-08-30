import { Module } from '@nestjs/common';
import { ConversionModule } from './modules/conversion/conversion.module';
import { FilesModule } from './modules/files/files.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, StorageModule, FilesModule, ConversionModule],
})
export class AppModule {}
