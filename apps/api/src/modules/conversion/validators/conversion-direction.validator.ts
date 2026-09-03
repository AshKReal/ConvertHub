import type { FileTypeResult } from 'file-type';
import {
  CONVERSION_DIRECTIONS,
  type ConversionDirection,
  type ConversionTarget,
} from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Все четыре направления — у каждого теперь есть движок: `ImageEngine` (002),
 * `PdfToDocxEngine` (005), `DocumentEngine` (018, Gotenberg). Магический-
 * байты-детект ниже не знает о категории формата, поэтому список общий.
 *
 * 🔒 018 сняла исключение `docx-to-pdf` — теперь DOCX (то есть ZIP) впервые
 * доходит до движка. Точка входа защищается `assertDocxWithinUnzipLimit`
 * (`conversion.service.ts`) ДО пула и движка.
 */
const SUPPORTED_DIRECTIONS = CONVERSION_DIRECTIONS;
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
