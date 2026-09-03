import { readFile } from 'node:fs/promises';
import { createInflateRaw } from 'node:zlib';
import {
  MAX_DOCX_UNZIP_BYTES,
  MAX_DOCX_UNZIP_RATIO,
} from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Спека 018, 🔒. DOCX — это ZIP: защита от бомбы распаковки (TECH-SPEC.md §9).
 *
 * Проверок две, и вторая — главная (🔒 BE-DOCX-01).
 *
 * 1. Дешёвый предфильтр по ЗАЯВЛЕННЫМ размерам из центрального каталога. Он
 *    ничего не доказывает — эти числа пишет тот, кто прислал файл, — но стоит
 *    O(записей) и отсекает архив, который сам признаётся, что развернётся в
 *    гигабайты, не тратя CPU на распаковку.
 * 2. ФАКТИЧЕСКАЯ распаковка каждой записи с подсчётом выходных байт. Байты
 *    считаются и выбрасываются, наружу не копятся: память — O(чанка), не
 *    O(распакованного). Как только счётчик переваливает бюджет, поток рвётся
 *    и дальше не считается — потолок работы равен бюджету, а не размеру бомбы.
 *
 * Без пункта 2 архив, заявляющий сотню байт и несущий DEFLATE-поток на
 * гигабайты, проходил обе проверки и уходил в LibreOffice. Пункт 2 попутно
 * обесценивает и подмену размера через ZIP64-extra `0x0001` (BE-DOCX-02):
 * решение больше не опирается на объявленные числа.
 *
 * Отклоняем, если распакованное > `MAX_DOCX_UNZIP_RATIO`× размера файла ИЛИ
 * > `MAX_DOCX_UNZIP_BYTES` абсолютно → `FILE_TOO_LARGE`. Битый архив, ZIP64,
 * неизвестный метод сжатия, оборванный DEFLATE → `FILE_CORRUPTED` (причина
 * различается — `critical-zones.md`).
 */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_FILE_MIN_SIZE = 46;
const LOCAL_FILE_MIN_SIZE = 30;
const ZIP64_SENTINEL = 0xffffffff;
const ZIP64_COUNT_SENTINEL = 0xffff;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

interface ZipEntry {
  readonly method: number;
  readonly compressedSize: number;
  readonly declaredUncompressed: number;
  readonly localHeaderOffset: number;
}

export async function assertDocxWithinUnzipLimit(
  filePath: string,
): Promise<void> {
  const buffer = await readFile(filePath);
  const entries = readCentralDirectory(buffer);

  let declared = 0;
  for (const entry of entries) {
    // Не переполнится: ≤ 65535 записей по uint32 — меньше 2^53.
    declared += entry.declaredUncompressed;
  }
  assertWithinLimits(declared, buffer.length);

  const budget = Math.min(
    MAX_DOCX_UNZIP_BYTES,
    buffer.length * MAX_DOCX_UNZIP_RATIO,
  );
  let produced = 0;
  for (const entry of entries) {
    produced += await inflatedSize(buffer, entry, budget - produced);
    assertWithinLimits(produced, buffer.length);
  }
}

/**
 * `actual_size_bytes`/`max_size_bytes` — те же ключи, что ждёт шаблон
 * `FILE_TOO_LARGE` в `error-detail.ts` (числа в `detail`, ТЗ п. 12.5).
 * Абсолютный предел проверяется первым: он не зависит от размера файла, и
 * сообщение про него понятнее, чем про коэффициент.
 */
function assertWithinLimits(size: number, fileSize: number): void {
  if (size > MAX_DOCX_UNZIP_BYTES) {
    throw new AppException('FILE_TOO_LARGE', {
      actual_size_bytes: size,
      max_size_bytes: MAX_DOCX_UNZIP_BYTES,
    });
  }
  const ratioLimit = fileSize * MAX_DOCX_UNZIP_RATIO;
  if (size > ratioLimit) {
    throw new AppException('FILE_TOO_LARGE', {
      actual_size_bytes: size,
      max_size_bytes: ratioLimit,
      unzip_ratio_limit: MAX_DOCX_UNZIP_RATIO,
    });
  }
}

/**
 * Сколько байт запись даёт на самом деле. `remaining` — сколько ещё влезает в
 * бюджет; считать точный размер сверх него незачем, любой ответ уже за
 * пределом, поэтому возвращённое значение может превысить `remaining` не
 * больше чем на один чанк.
 */
async function inflatedSize(
  buffer: Buffer,
  entry: ZipEntry,
  remaining: number,
): Promise<number> {
  const data = entryData(buffer, entry);
  if (entry.method === METHOD_STORE) {
    return data.length;
  }
  if (entry.method !== METHOD_DEFLATE) {
    // В OOXML бывают только store и deflate. Незнакомый метод — либо не
    // docx, либо попытка увести нас мимо проверки.
    throw corrupted();
  }
  return await countInflated(data, remaining);
}

/**
 * Сжатые байты записи. Смещение данных берётся из ЛОКАЛЬНОГО заголовка:
 * формат разрешает его длинам имени и extra отличаться от каталожных, а
 * данные лежат именно за локальным.
 *
 * `compressedSize` из каталога — тоже число атакующего, но соврать им незаметно
 * нельзя: завысил → выход за буфер и `FILE_CORRUPTED`, занизил → DEFLATE
 * оборвётся на полуслове, тоже `FILE_CORRUPTED`. Молча недосчитать не даёт.
 */
function entryData(buffer: Buffer, entry: ZipEntry): Buffer {
  const header = entry.localHeaderOffset;
  if (
    header + LOCAL_FILE_MIN_SIZE > buffer.length ||
    buffer.readUInt32LE(header) !== LOCAL_FILE_SIGNATURE
  ) {
    throw corrupted();
  }
  const nameLen = buffer.readUInt16LE(header + 26);
  const extraLen = buffer.readUInt16LE(header + 28);
  const start = header + LOCAL_FILE_MIN_SIZE + nameLen + extraLen;
  const end = start + entry.compressedSize;
  if (end > buffer.length) {
    throw corrupted();
  }
  return buffer.subarray(start, end);
}

/**
 * Распаковывает поток, считая выходные байты и не сохраняя их. Обрывается,
 * как только счётчик перевалил `remaining`: остаток бомбы не разворачивается.
 */
function countInflated(data: Buffer, remaining: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const inflate = createInflateRaw();
    let produced = 0;
    let settled = false;
    const settle = (act: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      act();
    };

    inflate.on('data', (chunk: Buffer) => {
      produced += chunk.length;
      if (produced > remaining) {
        // `destroy()` без аргумента не порождает 'error'; гонку с уже
        // поставленным в очередь событием снимает `settled`.
        inflate.destroy();
        settle(() => {
          resolve(produced);
        });
      }
    });
    inflate.on('end', () => {
      settle(() => {
        resolve(produced);
      });
    });
    inflate.on('error', () => {
      settle(() => {
        reject(corrupted());
      });
    });
    inflate.end(data);
  });
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
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

  const entries: ZipEntry[] = [];
  let cursor = centralDirOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (
      cursor + CENTRAL_FILE_MIN_SIZE > buffer.length ||
      buffer.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw corrupted();
    }
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const declaredUncompressed = buffer.readUInt32LE(cursor + 24);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    if (
      compressedSize === ZIP64_SENTINEL ||
      declaredUncompressed === ZIP64_SENTINEL ||
      localHeaderOffset === ZIP64_SENTINEL
    ) {
      throw corrupted();
    }
    entries.push({
      method: buffer.readUInt16LE(cursor + 10),
      compressedSize,
      declaredUncompressed,
      localHeaderOffset,
    });

    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    cursor += CENTRAL_FILE_MIN_SIZE + nameLen + extraLen + commentLen;
  }
  return entries;
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
