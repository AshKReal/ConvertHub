import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { ConcurrencyLimiterService } from './concurrency-limiter.service';
import { ConversionController } from './conversion.controller';
import { ConversionHistoryService } from './conversion-history.service';
import { ConversionService } from './conversion.service';
import { DocumentPoolService } from './document-pool.service';
import { IdempotencyService } from './idempotency.service';
import { CONVERSION_ENGINES } from './engines/engine.interface';
import { DocumentEngine } from './engines/document.engine';
import { ImageEngine } from './engines/image.engine';
import { PdfToDocxEngine } from './engines/pdf-to-docx.engine';
import { ConversionFailureFilter } from './filters/conversion-failure.filter';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

@Module({
  // AuthModule — `RateLimiterService`; ApiKeyModule — `RequestIdentityService` (спека 012).
  imports: [FilesModule, AuthModule, ApiKeyModule],
  controllers: [ConversionController],
  providers: [
    ImageEngine,
    PdfToDocxEngine,
    DocumentEngine,
    {
      provide: CONVERSION_ENGINES,
      useFactory: (
        imageEngine: ImageEngine,
        pdfToDocxEngine: PdfToDocxEngine,
        documentEngine: DocumentEngine,
      ) => [imageEngine, pdfToDocxEngine, documentEngine],
      inject: [ImageEngine, PdfToDocxEngine, DocumentEngine],
    },
    ConversionService,
    ConversionHistoryService,
    ConcurrencyLimiterService,
    DocumentPoolService,
    IdempotencyService,
    // Не зарегистрирован через @UseFilters — вызывается изнутри
    // ConversionFailureFilter как обычный провайдер (см. её докблок).
    MulterExceptionFilter,
    ConversionFailureFilter,
  ],
})
export class ConversionModule {}
