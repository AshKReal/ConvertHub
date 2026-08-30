import { Module } from '@nestjs/common';
import { ExceptionsModule } from './common/filters/exceptions.module';
import { ConversionModule } from './modules/conversion/conversion.module';
import { FilesModule } from './modules/files/files.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ExceptionsModule,
    PrismaModule,
    StorageModule,
    FilesModule,
    ConversionModule,
  ],
})
export class AppModule {}
