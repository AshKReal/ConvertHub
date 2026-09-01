/**
 * Реестр кодов ошибок API (TECH-SPEC.md §7.5). Ответ — `application/problem+json`
 * (RFC 9457) с полем `code`; по одному HTTP-статусу клиент не может решить,
 * повторять ли запрос — отсюда `retryable` рядом со `status`.
 */
export const ERROR_CODES = {
  /** Ссылка сброса пароля не существует/использована/просрочена (спека 009). 400, не 401 — не про сессию, про одноразовое действие. */
  INVALID_RESET_TOKEN: { status: 400, retryable: false },
  INVALID_API_KEY: { status: 401, retryable: false },
  /** Логин: неизвестный email, неверный пароль — одно и то же наружу (спека 007, AUTH-RULES.md §2). */
  INVALID_CREDENTIALS: { status: 401, retryable: false },
  /** Access-токен отсутствует/просрочен/невалиден на защищённом маршруте (спека 007) — интерцептор фронта обязан повторить запрос после refresh, отсюда retryable. */
  UNAUTHENTICATED: { status: 401, retryable: true },
  EMAIL_NOT_VERIFIED: { status: 403, retryable: false },
  FILE_NOT_FOUND: { status: 404, retryable: false },
  /** Регистрация: email уже занят (спека 007) — в отличие от логина/сброса пароля, здесь раскрытие существования аккаунта не запрещено (AUTH-RULES.md §2 перечисляет только логин и восстановление). */
  EMAIL_ALREADY_REGISTERED: { status: 409, retryable: false },
  /** Google вернул email другого существующего аккаунта, но не подтвердил владение им (спека 008) — автолинковка запрещена (AUTH-RULES.md, OAuth), второй аккаунт с тем же email завести нельзя (User.email уникален). */
  OAUTH_ACCOUNT_CONFLICT: { status: 409, retryable: false },
  /** Попытка отвязать единственный оставшийся способ входа (спека 008, AUTH-RULES.md: «НИКОГДА не разрешать отвязку последнего способа входа»). */
  LAST_LOGIN_METHOD: { status: 409, retryable: false },
  FILE_TOO_LARGE: { status: 413, retryable: false },
  UNSUPPORTED_FILE_TYPE: { status: 415, retryable: false },
  FILE_TYPE_MISMATCH: { status: 415, retryable: false },
  FILE_CORRUPTED: { status: 422, retryable: false },
  FILE_PASSWORD_PROTECTED: { status: 422, retryable: false },
  IMAGE_TOO_LARGE: { status: 422, retryable: false },
  TOO_MANY_PAGES: { status: 422, retryable: false },
  INVALID_PARAMETER: { status: 422, retryable: false },
  /** Явное включение `save` обратно на файле, когда квота уже не позволяет (спека 010) — снятие `save` при заполненной квоте на конвертации молча пропускает сохранение, не бросает этот код (тело ответа бинарное). */
  STORAGE_QUOTA_EXCEEDED: { status: 422, retryable: false },
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
