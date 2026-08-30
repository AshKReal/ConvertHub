import type { FileTypeResult } from 'file-type';
import {
  CONVERSION_DIRECTIONS,
  type ConversionDirection,
  type ConversionTarget,
} from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

const IMAGE_DIRECTIONS = CONVERSION_DIRECTIONS.filter(
  (d) => d.target === 'png' || d.target === 'jpg',
);
const SUPPORTED_MIMES = new Set<string>(
  IMAGE_DIRECTIONS.flatMap((d) => d.accept),
);

/**
 * Различает два разных отказа: байты вообще не входят в поддерживаемые
 * этим модулем форматы (`UNSUPPORTED_FILE_TYPE`) — и байты поддерживаемого
 * формата, но не того, что подразумевает `target` (`FILE_TYPE_MISMATCH`).
 * Область — только направления `png`/`jpg`: 002 не знает про docx/pdf,
 * реальный тип «PDF, переименованный в .jpg» здесь всегда неподдерживаемый,
 * а не «несовпадение», даже если PDF когда-нибудь станет направлением где-то ещё.
 */
export function assertSupportedDirection(
  detected: FileTypeResult | undefined,
  target: ConversionTarget,
): ConversionDirection {
  if (!detected || !SUPPORTED_MIMES.has(detected.mime)) {
    throw new AppException('UNSUPPORTED_FILE_TYPE');
  }

  const direction = IMAGE_DIRECTIONS.find(
    (d) =>
      d.target === target &&
      (d.accept as readonly string[]).includes(detected.mime),
  );

  if (!direction) {
    throw new AppException('FILE_TYPE_MISMATCH');
  }

  return direction;
}
