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
import {
  API_RATE,
  GUEST_CONVERT_RATE,
  USER_CONVERT_RATE,
  type ConvertRequest,
} from '@convert-hub/shared';
import type { Request, Response } from 'express';
import { hashIp } from '../../common/util/hash-ip';
import {
  RequestIdentityService,
  type RequestIdentity,
} from '../../common/auth/request-identity.service';
import { AppException } from '../../common/exceptions/app.exception';
import {
  RateLimiterService,
  type RateLimitResult,
} from '../../common/rate-limit/rate-limiter.service';
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
  constructor(
    private readonly conversionService: ConversionService,
    private readonly requestIdentity: RequestIdentityService,
    private readonly rateLimiter: RateLimiterService,
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

    // Спека 012. Гость ∨ сессия ∨ API-ключ. Плохой/отозванный ключ —
    // `INVALID_API_KEY` (не тихий гость, решение владельца); протухший JWT —
    // по-прежнему тихий гость.
    const identity = await this.requestIdentity.resolve(
      req.headers.authorization,
    );

    await this.applyRateLimits(identity, req, res);

    const userId = identity.kind === 'guest' ? null : identity.userId;
    // Ключ лимита одновременности (спека 005) — реальный пользователь или
    // хеш IP гостя, тот же паттерн анонимной идентичности (TECH-SPEC.md §6).
    const concurrencyKey = userId ?? hashIp(clientIp(req));

    const result = await this.conversionService.convert(
      file.path,
      body,
      userId,
      concurrencyKey,
      file.originalname,
    );

    if (result.fileId !== undefined) {
      res.setHeader('X-File-Id', result.fileId);
    }
    // Спека 010. Клиент просил save:true, сервер молча не сохранил из-за
    // квоты — тело ответа бинарное (байты файла), сигнализировать иначе
    // нечем; фронт (dropzone) читает заголовок и показывает тост.
    if (result.saveSkippedQuota) {
      res.setHeader('X-Save-Skipped-Reason', 'quota-full');
    }
    res.setHeader('Content-Type', result.mime);
    res.send(result.buffer);
  }

  /**
   * Спека 012. Гость — часовой лимит по хешу IP; вошедший (сессия или ключ) —
   * суточный по `userId`; ключ вдобавок — минутный по `userId` (не по ключу,
   * решение владельца). `X-RateLimit-*` — по самому узкому бакету. Любой
   * `consume` бросает `RATE_LIMIT_EXCEEDED` при превышении.
   */
  private async applyRateLimits(
    identity: RequestIdentity,
    req: Request,
    res: Response,
  ): Promise<void> {
    const results: RateLimitResult[] = [];
    if (identity.kind === 'guest') {
      results.push(
        await this.rateLimiter.consume(
          `rl:guest:${hashIp(clientIp(req))}`,
          GUEST_CONVERT_RATE,
        ),
      );
    } else {
      results.push(
        await this.rateLimiter.consume(
          `rl:user:${identity.userId}`,
          USER_CONVERT_RATE,
        ),
      );
      if (identity.kind === 'api-key') {
        results.push(
          await this.rateLimiter.consume(`rl:api:${identity.userId}`, API_RATE),
        );
      }
    }

    const tightest = results.reduce((a, b) =>
      b.remaining < a.remaining ? b : a,
    );
    res.setHeader('X-RateLimit-Limit', tightest.limit);
    res.setHeader('X-RateLimit-Remaining', tightest.remaining);
    res.setHeader('X-RateLimit-Reset', tightest.resetSeconds);
  }
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
