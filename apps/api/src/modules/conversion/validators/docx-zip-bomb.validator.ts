import { readFile } from 'node:fs/promises';
import {
  MAX_DOCX_UNZIP_BYTES,
  MAX_DOCX_UNZIP_RATIO,
} from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Спека 018, 🔒. DOCX — это ZIP: защита от бомбы распаковки (TECH-SPEC.md §9).
 * Считаем ЗАЯВЛЕННЫЙ несжатый размер по центральному каталогу архива, ничего
 * не распаковывая — заголовки ZIP врут так же, как размеры в заголовке PNG
 * (`pixel-count.validator.ts`), поэтому и распаковщик тащить незачем, и
 * доверять локальным заголовкам записей нельзя (центральный каталог —
 * канонический).
 *
 * Отклоняем, если суммарный несжатый размер > `MAX_DOCX_UNZIP_RATIO`× размера
 * файла ИЛИ > `MAX_DOCX_UNZIP_BYTES` абсолютно → `FILE_TOO_LARGE`. Битый
 * архив / ZIP64 без EOCD64 → `FILE_CORRUPTED` (различаем причину —
 * `critical-zones.md`).
 */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_FILE_MIN_SIZE = 46;
const ZIP64_SENTINEL = 0xffffffff;
const ZIP64_COUNT_SENTINEL = 0xffff;

export async function assertDocxWithinUnzipLimit(
  filePath: string,
): Promise<void> {
  const buffer = await readFile(filePath);
  const declaredUncompressed = sumDeclaredUncompressed(buffer);

  // `actual_size_bytes`/`max_size_bytes` — те же ключи, что ждёт шаблон
  // `FILE_TOO_LARGE` в `error-detail.ts` (числа в `detail`, ТЗ п. 12.5).
  if (declaredUncompressed > MAX_DOCX_UNZIP_BYTES) {
    throw new AppException('FILE_TOO_LARGE', {
      actual_size_bytes: declaredUncompressed,
      max_size_bytes: MAX_DOCX_UNZIP_BYTES,
    });
  }
  if (declaredUncompressed > buffer.length * MAX_DOCX_UNZIP_RATIO) {
    throw new AppException('FILE_TOO_LARGE', {
      actual_size_bytes: declaredUncompressed,
      max_size_bytes: buffer.length * MAX_DOCX_UNZIP_RATIO,
      unzip_ratio_limit: MAX_DOCX_UNZIP_RATIO,
    });
  }
}

function sumDeclaredUncompressed(buffer: Buffer): number {
  const eocd = findEocd(buffer);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralDirSize = buffer.readUInt32LE(eocd + 12);
  const centralDirOffset = buffer.readUInt32LE(eocd + 16);

  if (
    totalEntries === ZIP64_COUNT_SENTINEL ||
    centralDirSize === ZIP64_SENTINEL ||
    centralDirOffset === ZIP64_SENTINEL
  ) {
    // ZIP64 — настоящие .docx почти всегда обычный ZIP; не угадываем.
    throw corrupted();
  }
  if (centralDirOffset + centralDirSize > buffer.length) {
    throw corrupted();
  }

  let cursor = centralDirOffset;
  let total = 0;
  for (let i = 0; i < totalEntries; i += 1) {
    if (
      cursor + CENTRAL_FILE_MIN_SIZE > buffer.length ||
      buffer.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw corrupted();
    }
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    if (uncompressed === ZIP64_SENTINEL) {
      throw corrupted();
    }
    total += uncompressed;

    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    cursor += CENTRAL_FILE_MIN_SIZE + nameLen + extraLen + commentLen;
  }
  return total;
}

/** EOCD — с конца файла: сигнатура + до 65535 байт комментария после неё. */
function findEocd(buffer: Buffer): number {
  const earliest = Math.max(0, buffer.length - EOCD_MIN_SIZE - 0xffff);
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= earliest; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      const commentLen = buffer.readUInt16LE(i + 20);
      if (i + EOCD_MIN_SIZE + commentLen === buffer.length) {
        return i;
      }
    }
  }
  throw corrupted();
}

function corrupted(): AppException {
  return new AppException('FILE_CORRUPTED');
}
