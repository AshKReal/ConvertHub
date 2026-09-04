import { describe, expect, it } from 'vitest';
import { ERROR_CODES, type ErrorCode } from '@convert-hub/shared';

import type { AppError } from './interceptors/error-interceptor';
import { shouldRetryQuery } from './query-retry';

const appError = (code: ErrorCode): AppError => ({
  code,
  message: 'не важно',
  requestId: undefined,
  retryable: ERROR_CODES[code].retryable,
});

describe('shouldRetryQuery — что повторять', () => {
  it('повторяет временные отказы сервера', () => {
    expect(shouldRetryQuery(0, appError('SERVICE_OVERLOADED'))).toBe(true);
    expect(shouldRetryQuery(0, appError('STORAGE_UNAVAILABLE'))).toBe(true);
    expect(shouldRetryQuery(0, appError('RATE_LIMIT_EXCEEDED'))).toBe(true);
    expect(shouldRetryQuery(0, appError('INTERNAL_ERROR'))).toBe(true);
  });

  it('не повторяет то, что не изменится от повтора', () => {
    expect(shouldRetryQuery(0, appError('FILE_NOT_FOUND'))).toBe(false);
    expect(shouldRetryQuery(0, appError('EMAIL_ALREADY_REGISTERED'))).toBe(false);
    expect(shouldRetryQuery(0, appError('UNSUPPORTED_FILE_TYPE'))).toBe(false);
  });

  it('не повторяет 401, хотя реестр помечает UNAUTHENTICATED повторяемым', () => {
    // Повтор после 401 — обязанность authInterceptor: он делает единственный
    // /refresh и переигрывает запрос сам. Ретрай ещё и здесь удваивал бы
    // цепочку — ровно это мигало скелетоном у гостя на /files.
    expect(ERROR_CODES.UNAUTHENTICATED.retryable).toBe(true);
    expect(shouldRetryQuery(0, appError('UNAUTHENTICATED'))).toBe(false);
    expect(shouldRetryQuery(0, appError('INVALID_API_KEY'))).toBe(false);
    expect(shouldRetryQuery(0, appError('INVALID_CREDENTIALS'))).toBe(false);
  });
});

describe('shouldRetryQuery — сколько раз', () => {
  it('останавливается после двух дополнительных попыток', () => {
    expect(shouldRetryQuery(1, appError('SERVICE_OVERLOADED'))).toBe(true);
    expect(shouldRetryQuery(2, appError('SERVICE_OVERLOADED'))).toBe(false);
    expect(shouldRetryQuery(9, appError('SERVICE_OVERLOADED'))).toBe(false);
  });
});

describe('shouldRetryQuery — ошибки не из errorInterceptor', () => {
  it('не повторяет ничего, что не является AppError', () => {
    // До сюда доходят только ошибки, прошедшие errorInterceptor. Чужая форма
    // означает сбой в самом клиенте — повторять такое бессмысленно.
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(false);
    expect(shouldRetryQuery(0, null)).toBe(false);
    expect(shouldRetryQuery(0, undefined)).toBe(false);
    expect(shouldRetryQuery(0, { code: 'SERVICE_OVERLOADED' })).toBe(false);
  });
});
