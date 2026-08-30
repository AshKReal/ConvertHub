import { ArgumentsHost, Catch, PayloadTooLargeException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';
import { cleanupConvertTempDir } from '../convert-file.interceptor';

/**
 * Контроллер-скоуп, не глобальный — `AllExceptionsFilter` (026) ещё не
 * существует. Ловит абсолютно всё, включая обрыв соединения посреди приёма
 * (обычный `Error`, не `HttpException`) — оба случая происходят до входа
 * в `conversion.service.ts`, где его собственный `finally` не сработает,
 * поэтому уборка temp-папки здесь.
 *
 * `@nestjs/platform-express`'s `FileInterceptor` сам перехватывает сырой
 * `multer.MulterError` и превращает `LIMIT_FILE_SIZE` в свой
 * `PayloadTooLargeException` ещё до этого фильтра (подтверждено чтением
 * `multer.utils.js` при ручной проверке — `MulterError` сюда никогда не
 * доходит), поэтому здесь распознаётся уже готовый Nest-эксепшн, не сырая
 * ошибка multer.
 */
@Catch()
export class MulterExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    // Не блокирует ответ клиенту — уборка происходит в фоне; .catch() глушит
    // отказ rm() (force: true уже покрывает ENOENT), сообщать о нём здесь некому.
    void cleanupConvertTempDir(req.convertTempDir).catch(() => undefined);

    if (exception instanceof PayloadTooLargeException) {
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
