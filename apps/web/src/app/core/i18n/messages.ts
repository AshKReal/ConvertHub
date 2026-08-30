import type { ConversionDirectionId, ErrorCode } from '@convert-hub/shared';

import type { LoginProvider } from '../services/auth';
import type { Locale } from './locale';
import { EN_MESSAGES, type MessageKey } from './messages/en';
import { RU_MESSAGES } from './messages/ru';
import { UK_MESSAGES } from './messages/uk';

export type { MessageKey };

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
  uk: UK_MESSAGES,
};

/**
 * Направление конвертации — общий контракт (`packages/shared`), его описание —
 * текст интерфейса. Явная таблица вместо склейки ключа из идентификатора:
 * при добавлении направления компилятор потребует перевод.
 */
export const DIRECTION_DESCRIPTION_KEYS: Record<ConversionDirectionId, MessageKey> = {
  'jpg-to-png': 'direction.jpgToPng.description',
  'png-to-jpg': 'direction.pngToJpg.description',
  'docx-to-pdf': 'direction.docxToPdf.description',
  'pdf-to-docx': 'direction.pdfToDocx.description',
};

/**
 * Код ошибки (`packages/shared`) — текст в словаре. Явная карта вместо
 * склейки ключа шаблонной строкой: при добавлении кода компилятор
 * потребует перевод, а не молча подставит `undefined`.
 */
export const ERROR_MESSAGE_KEYS: Record<ErrorCode, MessageKey> = {
  INVALID_API_KEY: 'error.invalidApiKey',
  EMAIL_NOT_VERIFIED: 'error.emailNotVerified',
  FILE_NOT_FOUND: 'error.fileNotFound',
  FILE_TOO_LARGE: 'error.fileTooLarge',
  UNSUPPORTED_FILE_TYPE: 'error.unsupportedFileType',
  FILE_TYPE_MISMATCH: 'error.fileTypeMismatch',
  FILE_CORRUPTED: 'error.fileCorrupted',
  FILE_PASSWORD_PROTECTED: 'error.filePasswordProtected',
  IMAGE_TOO_LARGE: 'error.imageTooLarge',
  TOO_MANY_PAGES: 'error.tooManyPages',
  INVALID_PARAMETER: 'error.invalidParameter',
  RATE_LIMIT_EXCEEDED: 'error.rateLimitExceeded',
  CONVERSION_FAILED: 'error.conversionFailed',
  INTERNAL_ERROR: 'error.internalError',
  SERVICE_OVERLOADED: 'error.serviceOverloaded',
  STORAGE_UNAVAILABLE: 'error.storageUnavailable',
  CONVERSION_TIMEOUT: 'error.conversionTimeout',
};

/**
 * Способ входа мок-сессии (`AuthService`) — подпись в профиле. Явная карта
 * вместо склейки ключа: новый провайдер не скомпилируется без перевода.
 */
export const LOGIN_PROVIDER_LABEL_KEYS: Record<LoginProvider, MessageKey> = {
  password: 'profile.providers.password',
  google: 'profile.providers.google',
  telegram: 'profile.providers.telegram',
};
