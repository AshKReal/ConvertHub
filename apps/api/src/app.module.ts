import { Module } from '@nestjs/common';
import { ConversionModule } from './modules/conversion/conversion.module';

@Module({
  imports: [ConversionModule],
})
export class AppModule {}
