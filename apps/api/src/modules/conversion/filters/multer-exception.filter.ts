import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request } from 'express';
import { MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { AppException } from '../../../common/exceptions/app.exception';
import { cleanupConvertTempDir } from '../convert-file.interceptor';

/**
 * Контроллер-скоуп, не глобальный — рендер ответа не свой, делегируется
 * `AllExceptionsFilter` (026), внедрённому как обычный провайдер, а не как
 * второй Nest-фильтр (см. её докблок). Ловит абсолютно всё, включая обрыв
 * соединения посреди приёма (обычный `Error`, не `HttpException`) — оба
 * случая происходят до входа в `conversion.service.ts`, где его собственный
 * `finally` не сработает, поэтому уборка temp-папки здесь.
 *
 * `@nestjs/platform-express`'s `FileInterceptor` сам перехватывает сырой
 * `multer.MulterError` и превращает `LIMIT_FILE_SIZE` в свой
 * `PayloadTooLargeException` ещё до этого фильтра (подтверждено чтением
 * `multer.utils.js` при ручной проверке — `MulterError` сюда никогда не
 * доходит), поэтому здесь распознаётся уже готовый Nest-эксепшн, не сырая
 * ошибка multer.
 */
@Catch()
@Injectable()
export class MulterExceptionFilter implements ExceptionFilter<unknown> {
  constructor(private readonly allExceptions: AllExceptionsFilter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    // Не блокирует ответ клиенту — уборка происходит в фоне; .catch() глушит
    // отказ rm() (force: true уже покрывает ENOENT), сообщать о нём здесь некому.
    void cleanupConvertTempDir(req.convertTempDir).catch(() => undefined);

    if (exception instanceof PayloadTooLargeException) {
      // Multer обрывает поток при превышении лимита, не дожидаясь конца тела —
      // «фактический» размер не в его данных. `Content-Length` браузер/curl
      // выставляют по заранее известному размеру multipart-тела (не chunked),
      // так что заголовок обычно точнее любой попытки досчитать байты руками.
      const meta: Record<string, number> = {
        max_size_bytes: MAX_FILE_SIZE_BYTES,
      };
      const actualSize = Number(req.headers['content-length']);
      if (Number.isInteger(actualSize) && actualSize > 0) {
        meta['actual_size_bytes'] = actualSize;
      }

      this.allExceptions.catch(new AppException('FILE_TOO_LARGE', meta), host);
      return;
    }

    // Не проглатывается: всё, что не размер файла, летит в общий рендер как есть.
    this.allExceptions.catch(exception, host);
  }
}
