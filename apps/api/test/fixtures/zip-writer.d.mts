// Типы для `zip-writer.mjs` (общий ZIP-райтер `generate.mjs` и
// `docx-zip-bomb.validator.spec.ts`).

export function crc32(buf: Uint8Array): number;

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
  /** Что записать в оба заголовка как «несжатый размер»; по умолчанию = data.length. */
  readonly declaredUncompressed?: number;
}

export function buildZip(entries: readonly ZipEntry[]): Buffer;

export const DOCX_MAIN_MIME: string;

export function docxEntries(): Array<{ name: string; data: Buffer }>;
