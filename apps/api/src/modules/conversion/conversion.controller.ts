import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import type { ConvertRequest } from '@convert-hub/shared';
import type { Request, Response } from 'express';
import { hashIp } from '../../common/util/hash-ip';
import { AppException } from '../../common/exceptions/app.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConversionService } from './conversion.service';
import { createConvertFileInterceptor } from './convert-file.interceptor';
import { convertFormSchema } from './dto/convert-form.schema';
import { ConversionFailureFilter } from './filters/conversion-failure.filter';

/**
 * Без логики и без Prisma (ARCHITECTURE.md §4.1) — разбирает запрос, вызывает
 * сервис, формирует ответ. `@Res()` — успешный ответ бинарный (байты файла),
 * не JSON-обёртка Nest по умолчанию. Единственный зарегистрированный фильтр —
 * `ConversionFailureFilter`; он сам вызывает `MulterExceptionFilter` изнутри
 * (см. её докблок — у Nest не срабатывают два независимых catch-all-фильтра рядом).
 */
@Controller('v1/convert')
@UseFilters(ConversionFailureFilter)
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Post()
  @HttpCode(200) // Nest иначе шлёт дефолтный статус POST (201) даже при @Res(); ничего не "создаётся"
  @UseInterceptors(createConvertFileInterceptor())
  async convert(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(convertFormSchema)) body: ConvertRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new AppException('INVALID_PARAMETER', { field: 'file' });
    }

    // TODO(007): реальный id из сессии/API-ключа вместо гостевого null
    const userId: string | null = null;
    // Ключ лимита одновременности (спека 005) — тот же паттерн анонимной
    // идентичности, что и лимит частоты гостя (TECH-SPEC.md §6): хеш IP, пока
    // нет настоящего пользователя.
    const concurrencyKey =
      userId ?? hashIp(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const result = await this.conversionService.convert(
      file.path,
      body,
      userId,
      concurrencyKey,
    );
    if (result.fileId !== undefined) {
      res.setHeader('X-File-Id', result.fileId);
    }
    res.setHeader('Content-Type', result.mime);
    res.send(result.buffer);
  }
}
