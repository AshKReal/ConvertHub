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
import { extractBearerToken } from '../../common/guards/extract-bearer-token';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TokenService } from '../auth/token.service';
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
  constructor(
    private readonly conversionService: ConversionService,
    private readonly tokenService: TokenService,
  ) {}

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

    // Гостевой маршрут (001/005) — невалидный/просроченный токен тихо даёт
    // `null`, не 401: здесь нечего блокировать, `verifyAccessToken` для
    // этого и не бросает (спека 007, `token.service.ts`).
    const userId =
      this.tokenService.verifyAccessToken(
        extractBearerToken(req.headers.authorization),
      )?.userId ?? null;
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
