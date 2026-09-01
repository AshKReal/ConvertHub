import { dirname } from 'node:path';
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
  idempotencyKeySchema,
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
import {
  cleanupConvertTempDir,
  createConvertFileInterceptor,
} from './convert-file.interceptor';
import { convertFormSchema } from './dto/convert-form.schema';
import { ConversionFailureFilter } from './filters/conversion-failure.filter';
import {
  IdempotencyService,
  type IdempotentResult,
} from './idempotency.service';

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
    private readonly idempotency: IdempotencyService,
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
    const tempFilePath = file.path;
    const originalFilename = file.originalname;

    try {
      // Спека 012. Гость ∨ сессия ∨ API-ключ. Плохой/отозванный ключ —
      // `INVALID_API_KEY` (не тихий гость, решение владельца); протухший JWT —
      // по-прежнему тихий гость.
      const identity = await this.requestIdentity.resolve(
        req.headers.authorization,
      );
      const idempotencyKey = readIdempotencyKey(req);
      const scope =
        identity.kind === 'guest' ? hashIp(clientIp(req)) : identity.userId;

      // Идемпотентность до `consume`: replay не списывает лимит частоты.
      let storeResult = false;
      if (idempotencyKey !== undefined) {
        const outcome = await this.idempotency.begin(scope, idempotencyKey);
        if (outcome.state === 'conflict') {
          throw new AppException('IDEMPOTENCY_KEY_CONFLICT');
        }
        if (outcome.state === 'replay') {
          this.sendResult(res, outcome.result, true);
          return;
        }
        storeResult = outcome.state === 'new';
      }

      await this.applyRateLimits(identity, req, res);

      const userId = identity.kind === 'guest' ? null : identity.userId;
      // Ключ лимита одновременности (спека 005) — реальный пользователь или
      // хеш IP гостя, тот же паттерн анонимной идентичности (TECH-SPEC.md §6).
      const concurrencyKey = userId ?? hashIp(clientIp(req));

      const result = await this.conversionService.convert(
        tempFilePath,
        body,
        userId,
        concurrencyKey,
        originalFilename,
      );

      const payload: IdempotentResult = {
        mime: result.mime,
        fileId: result.fileId ?? null,
        saveSkippedQuota: result.saveSkippedQuota,
        body: result.buffer,
      };
      if (storeResult && idempotencyKey !== undefined) {
        await this.idempotency.complete(scope, idempotencyKey, payload);
      }
      this.sendResult(res, payload, false);
    } finally {
      // Multer уже выгрузил файл во временный каталог к моменту входа сюда;
      // на пути replay/`409`/`429` `ConversionService` (со своим `finally`)
      // не вызывается — убираем каталог здесь. На обычном пути это
      // повторная уборка, `rm({ force: true })` её выдерживает.
      await cleanupConvertTempDir(dirname(tempFilePath));
    }
  }

  private sendResult(
    res: Response,
    result: IdempotentResult,
    replayed: boolean,
  ): void {
    if (result.fileId !== null) {
      res.setHeader('X-File-Id', result.fileId);
    }
    // Спека 010. Клиент просил save:true, сервер молча не сохранил из-за
    // квоты — тело ответа бинарное (байты файла), сигнализировать иначе
    // нечем; фронт (dropzone) читает заголовок и показывает тост.
    if (result.saveSkippedQuota) {
      res.setHeader('X-Save-Skipped-Reason', 'quota-full');
    }
    if (replayed) {
      res.setHeader('X-Idempotent-Replay', 'true');
    }
    res.setHeader('Content-Type', result.mime);
    res.send(result.body);
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

/** `Idempotency-Key` — UUID (спека 012). Отсутствует → `undefined`; есть, но не UUID → `INVALID_PARAMETER`. */
function readIdempotencyKey(req: Request): string | undefined {
  const raw = req.headers['idempotency-key'];
  if (raw === undefined) {
    return undefined;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new AppException('INVALID_PARAMETER', { field: 'Idempotency-Key' });
  }
  return parsed.data;
}
