import type { FileTypeResult } from 'file-type';
import {
  CONVERSION_DIRECTIONS,
  type ConversionDirection,
  type ConversionTarget,
} from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Все направления, для которых сейчас есть движок (002, 005) — не только
 * изображения, магический-байты-детект ниже не знает о категории формата.
 * `docx-to-pdf` — единственное исключение: движок для него появится только
 * в 018 (Gotenberg, требует Docker). Не включать его сюда означает честный
 * `UNSUPPORTED_FILE_TYPE`, а включить и получить «движок не найден» в
 * `conversion.service.ts` значило бы подменить понятный отказ на `CONVERSION_FAILED`.
 */
const SUPPORTED_DIRECTIONS = CONVERSION_DIRECTIONS.filter(
  (d) => d.id !== 'docx-to-pdf',
);
const SUPPORTED_MIMES = new Set<string>(
  SUPPORTED_DIRECTIONS.flatMap((d) => d.accept),
);

/**
 * Различает два разных отказа: байты вообще не входят в поддерживаемые
 * форматы (`UNSUPPORTED_FILE_TYPE`) — и байты поддерживаемого формата, но не
 * того, что подразумевает `target` (`FILE_TYPE_MISMATCH`).
 */
export function assertSupportedDirection(
  detected: FileTypeResult | undefined,
  target: ConversionTarget,
): ConversionDirection {
  if (!detected || !SUPPORTED_MIMES.has(detected.mime)) {
    throw new AppException('UNSUPPORTED_FILE_TYPE');
  }

  const direction = SUPPORTED_DIRECTIONS.find(
    (d) =>
      d.target === target &&
      (d.accept as readonly string[]).includes(detected.mime),
  );

  if (!direction) {
    throw new AppException('FILE_TYPE_MISMATCH');
  }

  return direction;
}
