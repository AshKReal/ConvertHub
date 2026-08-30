import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import type { ConvertRequest } from '@convert-hub/shared';
import type { Response } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConversionService } from './conversion.service';
import { createConvertFileInterceptor } from './convert-file.interceptor';
import { convertFormSchema } from './dto/convert-form.schema';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

/**
 * Без логики и без Prisma (ARCHITECTURE.md §4.1) — разбирает запрос, вызывает
 * сервис, формирует ответ. `@Res()` — успешный ответ бинарный (байты файла),
 * не JSON-обёртка Nest по умолчанию.
 */
@Controller('v1/convert')
@UseFilters(MulterExceptionFilter)
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Post()
  @HttpCode(200) // Nest иначе шлёт дефолтный статус POST (201) даже при @Res(); ничего не "создаётся"
  @UseInterceptors(createConvertFileInterceptor())
  async convert(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(convertFormSchema)) body: ConvertRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new AppException('INVALID_PARAMETER', { field: 'file' });
    }

    const result = await this.conversionService.convert(file.path, body);
    res.setHeader('Content-Type', result.mime);
    res.send(result.buffer);
  }
}
