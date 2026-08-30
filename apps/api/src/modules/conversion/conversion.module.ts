import { Module } from '@nestjs/common';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { CONVERSION_ENGINES } from './engines/engine.interface';
import { ImageEngine } from './engines/image.engine';

@Module({
  controllers: [ConversionController],
  providers: [
    ImageEngine,
    {
      provide: CONVERSION_ENGINES,
      useFactory: (imageEngine: ImageEngine) => [imageEngine],
      inject: [ImageEngine],
    },
    ConversionService,
  ],
})
export class ConversionModule {}
