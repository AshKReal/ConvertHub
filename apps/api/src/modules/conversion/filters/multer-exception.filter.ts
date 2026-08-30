import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { MulterError } from 'multer';
import { MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';
import { cleanupConvertTempDir } from '../convert-file.interceptor';

/**
 * Контроллер-скоуп, не глобальный — `AllExceptionsFilter` (026) ещё не
 * существует. Ловит абсолютно всё: multer `LIMIT_FILE_SIZE`, но и обрыв
 * соединения посреди приёма (это обычный `Error`, не `MulterError`) — оба
 * случая происходят до входа в `conversion.service.ts`, где его собственный
 * `finally` не сработает, поэтому уборка temp-папки здесь.
 */
@Catch()
export class MulterExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    // Не блокирует ответ клиенту — уборка происходит в фоне; .catch() глушит
    // отказ rm() (force: true уже покрывает ENOENT), сообщать о нём здесь некому.
    void cleanupConvertTempDir(req.convertTempDir).catch(() => undefined);

    if (
      exception instanceof MulterError &&
      exception.code === 'LIMIT_FILE_SIZE'
    ) {
      super.catch(
        new AppException('FILE_TOO_LARGE', {
          max_size_bytes: MAX_FILE_SIZE_BYTES,
        }),
        host,
      );
      return;
    }

    // Не проглатывается: всё, что не размер файла, летит в дефолтный рендер Nest как есть.
    super.catch(exception, host);
  }
}
