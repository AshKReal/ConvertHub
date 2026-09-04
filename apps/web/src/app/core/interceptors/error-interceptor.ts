import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ERROR_CODES, type ErrorCode } from '@convert-hub/shared';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { ERROR_MESSAGE_KEYS } from '../i18n/messages';
import { I18nService, type MessageParams } from '../services/i18n';

/**
 * Единственная форма ошибки, с которой работают компоненты (ARCHITECTURE.md §8).
 * Текст уже переведён и готов к показу — сырой `HttpErrorResponse` дальше не идёт.
 */
export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
}

interface ProblemDetails {
  readonly code?: string;
  readonly request_id?: string;
  readonly meta?: Readonly<Record<string, string | number>>;
}

/**
 * `INTERNAL_ERROR`, не `CONVERSION_FAILED`: сюда попадает ЛЮБОЙ ответ без
 * распознанного `code` — 401 на `/v1/auth/me`, обрыв сети, страница-заглушка
 * от прокси. Прежний фолбэк объявлял конвертацию неудавшейся на каждый такой
 * случай; на живом деплое ошибка регистрации показывалась пользователю как
 * «конвертация неожиданно завершилась ошибкой». Реестр кодов заводит
 * `INTERNAL_ERROR` ровно для этого — «вне доменных кодов, не только
 * конвертация» (`packages/shared`).
 */
const FALLBACK_CODE: ErrorCode = 'INTERNAL_ERROR';

/**
 * Подключён в `app.config.ts` вместе с первым реальным сетевым вызовом (026).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      // `responseType: 'blob'` (нужен для бинарного результата конвертации)
      // заставляет Angular трактовать ЛЮБОЕ тело ответа как `Blob` — включая
      // тело ошибки. Без этой ветки `problem+json` никогда бы не читался:
      // ниже `asProblemDetails` увидел бы объект `Blob`, не нашёл в нём
      // `code` и молча откатился на запасной код для абсолютно любой ошибки.
      if (error.error instanceof Blob) {
        return from(error.error.text()).pipe(
          switchMap((text) => throwError(() => toAppError(error, i18n, parseJsonSafely(text)))),
        );
      }

      return throwError(() => toAppError(error, i18n, error.error));
    }),
  );
};

function toAppError(response: HttpErrorResponse, i18n: I18nService, body: unknown): AppError {
  const problem = asProblemDetails(body);
  const code = asErrorCode(problem?.code) ?? FALLBACK_CODE;

  return {
    code,
    message: i18n.t(ERROR_MESSAGE_KEYS[code], messageParams(code, problem?.meta, i18n)),
    requestId: problem?.request_id,
    retryable: ERROR_CODES[code].retryable,
  };
}

/**
 * Единственная задокументированная пара meta-полей — `actual_size_bytes`/
 * `max_size_bytes` из примера в TECH-SPEC.md §7.5. Остальные коды получат
 * свои поля вместе с бэкендом (026), придумывать их сейчас нельзя.
 */
function messageParams(
  code: ErrorCode,
  meta: ProblemDetails['meta'],
  i18n: I18nService,
): MessageParams | undefined {
  if (code === 'FILE_TOO_LARGE' && meta) {
    return {
      actual: i18n.formatBytes(Number(meta['actual_size_bytes'])),
      max: i18n.formatBytes(Number(meta['max_size_bytes'])),
    };
  }

  return meta;
}

function asErrorCode(value: string | undefined): ErrorCode | undefined {
  return value !== undefined && value in ERROR_CODES ? (value as ErrorCode) : undefined;
}

function asProblemDetails(value: unknown): ProblemDetails | undefined {
  return typeof value === 'object' && value !== null ? (value as ProblemDetails) : undefined;
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
