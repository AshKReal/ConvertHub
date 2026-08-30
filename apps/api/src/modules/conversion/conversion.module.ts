import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ConversionController } from './conversion.controller';
import { ConversionHistoryService } from './conversion-history.service';
import { ConversionService } from './conversion.service';
import { CONVERSION_ENGINES } from './engines/engine.interface';
import { ImageEngine } from './engines/image.engine';
import { ConversionFailureFilter } from './filters/conversion-failure.filter';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

@Module({
  imports: [FilesModule],
  controllers: [ConversionController],
  providers: [
    ImageEngine,
    {
      provide: CONVERSION_ENGINES,
      useFactory: (imageEngine: ImageEngine) => [imageEngine],
      inject: [ImageEngine],
    },
    ConversionService,
    ConversionHistoryService,
    // Не зарегистрирован через @UseFilters — вызывается изнутри
    // ConversionFailureFilter как обычный провайдер (см. её докблок).
    MulterExceptionFilter,
    ConversionFailureFilter,
  ],
})
export class ConversionModule {}
