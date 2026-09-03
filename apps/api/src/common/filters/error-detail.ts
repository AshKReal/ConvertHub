import type { ErrorCode } from '@convert-hub/shared';

type Meta = Readonly<Record<string, string | number>> | undefined;

/**
 * Английский текст для интеграторов API (RFC 9457 `detail`, TECH-SPEC.md §7.5) —
 * не то же самое, что переведённые тексты клиента (004): тот текст для
 * конечного пользователя в интерфейсе, этот — техническое описание причины,
 * всегда на английском, независимо от локали запроса.
 */
const ERROR_DETAILS: Record<ErrorCode, (meta: Meta) => string> = {
  INVALID_RESET_TOKEN: () =>
    'The password reset link is invalid, already used, or has expired.',
  INVALID_API_KEY: () => 'The provided API key is invalid or has been revoked.',
  INVALID_CREDENTIALS: () => 'Email or password is incorrect.',
  UNAUTHENTICATED: () =>
    'The access token is missing, invalid, or has expired.',
  EMAIL_NOT_VERIFIED: () =>
    'The sign-in provider did not confirm ownership of this email address.',
  FILE_NOT_FOUND: () =>
    'The requested file does not exist or is no longer available.',
  API_KEY_NOT_FOUND: () =>
    'The API key does not exist or has already been revoked.',
  EMAIL_ALREADY_REGISTERED: () =>
    'An account with this email address already exists.',
  LAST_LOGIN_METHOD: () =>
    'This is the only remaining sign-in method for the account and cannot be unlinked.',
  IDEMPOTENCY_KEY_CONFLICT: () =>
    'A request with this Idempotency-Key is still being processed. Retry once it completes.',
  FILE_TOO_LARGE: (meta) =>
    `Uploaded file is ${meta?.['actual_size_bytes'] ?? '?'} bytes, maximum allowed is ${meta?.['max_size_bytes'] ?? '?'}.`,
  UNSUPPORTED_FILE_TYPE: () =>
    "The uploaded file's content type is not supported for this conversion.",
  FILE_TYPE_MISMATCH: () =>
    "The uploaded file's content does not match the requested conversion direction.",
  FILE_CORRUPTED: () =>
    'The uploaded file is corrupted and could not be read as the expected format.',
  FILE_PASSWORD_PROTECTED: () => 'The uploaded file is password-protected.',
  IMAGE_TOO_LARGE: (meta) =>
    `Declared image resolution is ${meta?.['actual_pixels'] ?? '?'} pixels, maximum allowed is ${meta?.['max_pixels'] ?? '?'}.`,
  TOO_MANY_PAGES: () =>
    'The document has more pages than can be converted in a single request.',
  INVALID_PARAMETER: (meta) =>
    meta?.['field'] !== undefined
      ? `One of the request parameters is invalid (field: ${meta['field']}).`
      : 'One of the request parameters is invalid.',
  STORAGE_QUOTA_EXCEEDED: () =>
    'Restoring this file would exceed the storage quota.',
  API_KEY_LIMIT_REACHED: (meta) =>
    `The account already has the maximum of ${meta?.['max'] ?? '?'} active API keys. Revoke one before issuing another.`,
  RATE_LIMIT_EXCEEDED: () =>
    'Too many requests. Retry after the indicated interval.',
  CONCURRENCY_LIMIT_EXCEEDED: (meta) =>
    `This client already has ${meta?.['limit'] ?? '?'} conversions running. Wait for one to finish and try again.`,
  CONVERSION_FAILED: () => 'The conversion failed unexpectedly.',
  SERVICE_OVERLOADED: () => 'The conversion service is temporarily overloaded.',
  STORAGE_UNAVAILABLE: () => 'Storage is temporarily unavailable.',
  CONVERSION_TIMEOUT: () => 'The conversion took too long and was stopped.',
  INTERNAL_ERROR: () =>
    'An unexpected error occurred while processing the request.',
};

export function buildDetail(code: ErrorCode, meta: Meta): string {
  return ERROR_DETAILS[code](meta);
}
