import { HttpException } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@convert-hub/shared';

export interface AppExceptionBody {
  readonly code: ErrorCode;
  readonly meta?: Record<string, string | number>;
}

/**
 * Сид формата ошибок до появления `AllExceptionsFilter` (026): дефолтный
 * обработчик Nest уже умеет рендерить `HttpException` как есть, этого
 * достаточно, чтобы клиентский `errorInterceptor` читал `code`/`meta`
 * уже сейчас, без ожидания полного RFC 9457 (`type`/`title`/`instance`).
 */
export class AppException extends HttpException {
  constructor(code: ErrorCode, meta?: Record<string, string | number>) {
    const body: AppExceptionBody =
      meta === undefined ? { code } : { code, meta };
    super(body, ERROR_CODES[code].status);
  }
}
