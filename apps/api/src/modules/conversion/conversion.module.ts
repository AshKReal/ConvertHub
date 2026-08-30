import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ConcurrencyLimiterService } from './concurrency-limiter.service';
import { ConversionController } from './conversion.controller';
import { ConversionHistoryService } from './conversion-history.service';
import { ConversionService } from './conversion.service';
import { CONVERSION_ENGINES } from './engines/engine.interface';
import { ImageEngine } from './engines/image.engine';
import { PdfToDocxEngine } from './engines/pdf-to-docx.engine';
import { ConversionFailureFilter } from './filters/conversion-failure.filter';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

@Module({
  imports: [FilesModule],
  controllers: [ConversionController],
  providers: [
    ImageEngine,
    PdfToDocxEngine,
    {
      provide: CONVERSION_ENGINES,
      useFactory: (
        imageEngine: ImageEngine,
        pdfToDocxEngine: PdfToDocxEngine,
      ) => [imageEngine, pdfToDocxEngine],
      inject: [ImageEngine, PdfToDocxEngine],
    },
    ConversionService,
    ConversionHistoryService,
    ConcurrencyLimiterService,
    // Не зарегистрирован через @UseFilters — вызывается изнутри
    // ConversionFailureFilter как обычный провайдер (см. её докблок).
    MulterExceptionFilter,
    ConversionFailureFilter,
  ],
})
export class ConversionModule {}
