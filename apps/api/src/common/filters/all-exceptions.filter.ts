import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ulid } from 'ulid';
import { ERROR_CODES, type ErrorCode } from '@convert-hub/shared';
import {
  AppException,
  type AppExceptionBody,
} from '../exceptions/app.exception';
import { buildDetail } from './error-detail';

const PROBLEM_TYPE_BASE = 'https://api.convert-hub.io/errors/';
const REQUEST_ID_HEADER = 'x-request-id';

interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail: string;
  readonly instance: string;
  readonly request_id: string;
  readonly meta?: Record<string, string | number>;
}

/**
 * Единственное место, которое сериализует исключение в ответ (RFC 9457,
 * TECH-SPEC.md §7.5) — регистрируется глобально (`exceptions.module.ts`,
 * `APP_FILTER`). Контроллерные фильтры (`MulterExceptionFilter`,
 * `ConversionFailureFilter`, спека 003) больше не рендерят ответ сами —
 * вызывают `catch()` отсюда напрямую как метод обычного провайдера, тем же
 * способом, каким уже устроена их собственная композиция (см. докблок
 * `ConversionFailureFilter`: два независимых `@Catch()`-фильтра на одном
 * контроллере у Nest не работают одновременно).
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      // AppException и прочие HttpException — ожидаемые исходы (в т.ч. чужой
      // framework-уровневый 404 на несуществующий маршрут), не баги.
      // Логируется только то, что реально непредвиденно.
      this.logger.error(exception);
    }

    const { status, code, meta } = classify(exception);
    const body: ProblemDetails = {
      type: `${PROBLEM_TYPE_BASE}${kebabCase(code)}`,
      title: titleCase(code),
      status,
      code,
      detail: buildDetail(code, meta),
      instance: req.originalUrl ?? req.url,
      request_id: requestId(req),
      ...(meta ? { meta } : {}),
    };

    // Спека 012. `RATE_LIMIT_EXCEEDED` несёт `retry_after_seconds` в `meta` —
    // продублировать стандартным заголовком `Retry-After` (TECH-SPEC.md §7.5).
    const retryAfter = meta?.['retry_after_seconds'];
    if (code === 'RATE_LIMIT_EXCEEDED' && typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }

    res
      .status(status)
      .type('application/problem+json')
      .send(JSON.stringify(body));
  }
}

function classify(exception: unknown): {
  status: number;
  code: ErrorCode;
  meta?: Record<string, string | number>;
} {
  if (exception instanceof AppException) {
    const responseBody = exception.getResponse() as AppExceptionBody;
    return {
      status: exception.getStatus(),
      code: responseBody.code,
      meta: responseBody.meta,
    };
  }
  if (exception instanceof HttpException) {
    // Настоящий HTTP-статус сохраняется (например, 404 на несуществующий
    // маршрут) — но кода под него в реестре нет, честный фолбэк.
    return { status: exception.getStatus(), code: 'INTERNAL_ERROR' };
  }
  return { status: ERROR_CODES.INTERNAL_ERROR.status, code: 'INTERNAL_ERROR' };
}

function requestId(req: Request): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && value !== '' ? value : `req_${ulid()}`;
}

function kebabCase(code: ErrorCode): string {
  return code.toLowerCase().replace(/_/g, '-');
}

function titleCase(code: ErrorCode): string {
  const lower = code.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
