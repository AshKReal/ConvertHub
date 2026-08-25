import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ERROR_CODES, type ErrorCode } from '@convert-hub/shared';
import { catchError, throwError } from 'rxjs';

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

const FALLBACK_CODE: ErrorCode = 'CONVERSION_FAILED';

/**
 * Заготовка под 026: реального `problem+json` от бэкенда пока нет, поэтому
 * маппинг не подключён к `provideHttpClient` — подключается вместе с ним.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      return throwError(() => toAppError(error, i18n));
    }),
  );
};

function toAppError(response: HttpErrorResponse, i18n: I18nService): AppError {
  const problem = asProblemDetails(response.error);
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
