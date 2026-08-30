/**
 * Реестр кодов ошибок API (TECH-SPEC.md §7.5). Ответ — `application/problem+json`
 * (RFC 9457) с полем `code`; по одному HTTP-статусу клиент не может решить,
 * повторять ли запрос — отсюда `retryable` рядом со `status`.
 */
export const ERROR_CODES = {
  INVALID_API_KEY: { status: 401, retryable: false },
  EMAIL_NOT_VERIFIED: { status: 403, retryable: false },
  FILE_NOT_FOUND: { status: 404, retryable: false },
  FILE_TOO_LARGE: { status: 413, retryable: false },
  UNSUPPORTED_FILE_TYPE: { status: 415, retryable: false },
  FILE_TYPE_MISMATCH: { status: 415, retryable: false },
  FILE_CORRUPTED: { status: 422, retryable: false },
  FILE_PASSWORD_PROTECTED: { status: 422, retryable: false },
  IMAGE_TOO_LARGE: { status: 422, retryable: false },
  TOO_MANY_PAGES: { status: 422, retryable: false },
  INVALID_PARAMETER: { status: 422, retryable: false },
  RATE_LIMIT_EXCEEDED: { status: 429, retryable: true },
  /** Одновременных запросов от одного клиента больше лимита (спека 005) — счётчик "сейчас", не по времени, как RATE_LIMIT_EXCEEDED. */
  CONCURRENCY_LIMIT_EXCEEDED: { status: 429, retryable: true },
  CONVERSION_FAILED: { status: 500, retryable: true },
  /** Фолбэк для непредвиденных ошибок вне доменных кодов (спека 026) — не только конвертация. */
  INTERNAL_ERROR: { status: 500, retryable: true },
  SERVICE_OVERLOADED: { status: 503, retryable: true },
  STORAGE_UNAVAILABLE: { status: 503, retryable: true },
  CONVERSION_TIMEOUT: { status: 504, retryable: true },
} as const satisfies Record<string, { status: number; retryable: boolean }>;

export type ErrorCode = keyof typeof ERROR_CODES;
