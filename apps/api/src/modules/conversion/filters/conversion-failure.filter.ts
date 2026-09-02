import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AppException,
  type AppExceptionBody,
} from '../../../common/exceptions/app.exception';
import { ConversionHistoryService } from '../conversion-history.service';
import { MulterExceptionFilter } from './multer-exception.filter';

/**
 * Единственный фильтр, реально зарегистрированный на `ConversionController`
 * (`@UseFilters`). Nest выбирает ПЕРВЫЙ подходящий фильтр из списка
 * (`selectExceptionFilterMetadata` — `Array.prototype.find`), а у бесскобочного
 * `@Catch()` список типов исключений пуст — значит два независимых
 * catch-all-фильтра рядом друг с другом не сработают оба: второй никогда
 * не вызвался бы. Поэтому `MulterExceptionFilter` не регистрируется
 * отдельно — он внедряется сюда как обычный провайдер и вызывается напрямую
 * как метод; всё его протестированное в 002 поведение (уборка temp-папки,
 * перевод `PayloadTooLargeException`) не меняется ни на строку.
 */
@Catch()
@Injectable()
export class ConversionFailureFilter implements ExceptionFilter<unknown> {
  constructor(
    private readonly conversionHistory: ConversionHistoryService,
    private readonly multerFilter: MulterExceptionFilter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    const startedAt = req.convertStartedAt ?? Date.now();

    // Спека 012. Отказ до самой конвертации (лимит частоты, повтор
    // идемпотентного ключа во время выполнения, неверный API-ключ) — не
    // «неуспешная конвертация», в `conversions` его писать незачем.
    if (isPreConversionRejection(exception)) {
      this.multerFilter.catch(exception, host);
      return;
    }

    // Не блокирует ответ клиенту — тот же fire-and-forget, что и уборка
    // temp-папки в MulterExceptionFilter; аудит-лог не должен маскировать
    // реальный ответ, если сам не пишется.
    void this.conversionHistory
      .recordConversion({
        userId: null, // TODO(007): реальный id из сессии/API-ключа
        target: extractTarget(req.body),
        // Фильтр работает на HTTP-слое и не знает, было ли направление уже
        // определено к моменту отказа — конвертационный сервис такое
        // состояние наружу не отдаёт (один try/finally без верхнего catch).
        directionId: null,
        status: 'FAILED',
        errorCode: extractErrorCode(exception),
        durationMs: Date.now() - startedAt,
        fileId: null,
      })
      .catch(() => undefined);

    this.multerFilter.catch(exception, host);
  }
}

function extractTarget(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'target' in body &&
    typeof body.target === 'string'
  ) {
    return (body as { target: string }).target.slice(0, 8);
  }
  return 'unknown';
}

function extractErrorCode(exception: unknown): string {
  if (exception instanceof AppException) {
    return (exception.getResponse() as AppExceptionBody).code;
  }
  return 'CONVERSION_FAILED';
}

/** Коды, означающие «до конвертации дело не дошло» — история их не пишет (спека 012). */
const PRE_CONVERSION_CODES = new Set([
  'RATE_LIMIT_EXCEEDED',
  'IDEMPOTENCY_KEY_CONFLICT',
  'INVALID_API_KEY',
]);

function isPreConversionRejection(exception: unknown): boolean {
  return (
    exception instanceof AppException &&
    PRE_CONVERSION_CODES.has((exception.getResponse() as AppExceptionBody).code)
  );
}
