import type { ConversionDirectionId } from '@convert-hub/shared';

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
  'pdf-to-jpg': 'direction.pdfToJpg.description',
};
