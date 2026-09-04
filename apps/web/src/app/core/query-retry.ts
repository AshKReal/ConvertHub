import type { ErrorCode } from '@convert-hub/shared';

import type { AppError } from './interceptors/error-interceptor';

/**
 * Коды, помеченные `retryable` в реестре, но повторять которые здесь нельзя.
 *
 * `UNAUTHENTICATED` помечен повторяемым для `authInterceptor`: тот делает
 * единственный `/refresh` (single-flight) и сам переигрывает запрос. Если
 * повторять ещё и на уровне запроса, цепочка удваивается — каждый ретрай
 * заново входит в интерцептор, снова идёт в refresh, снова получает отказ.
 * Именно это и наблюдалось на живом деплое: список файлов у гостя мигал
 * скелетоном, пока TanStack отрабатывал свои попытки.
 */
const INTERCEPTOR_OWNED_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'UNAUTHENTICATED',
  'INVALID_API_KEY',
  'INVALID_CREDENTIALS',
]);

/** Две дополнительные попытки поверх исходной — дефолтные три у TanStack избыточны. */
const MAX_RETRIES = 2;

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'retryable' in value &&
    typeof (value as { retryable: unknown }).retryable === 'boolean'
  );
}

/**
 * Решение о повторе принимается по контракту `AppError.retryable`
 * (`packages/shared`), а не по числу попыток: дефолт TanStack `retry: 3`
 * повторял и заведомо безнадёжное — 401 гостя, 404 несуществующего файла, —
 * возвращая страницу в состояние загрузки на каждой попытке.
 *
 * Всё, что не является `AppError`, не повторяется: до сюда доходят только
 * ошибки, прошедшие `errorInterceptor`, а значит чужая форма — признак сбоя
 * в самом клиенте, а не временной неполадки на сервере.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || !isAppError(error)) {
    return false;
  }

  return error.retryable && !INTERCEPTOR_OWNED_CODES.has(error.code);
}
