// Минимальный ZIP-райтер. В apps/api нет zip-библиотеки, а нужны ровно две
// вещи: собрать настоящий .docx и собрать «бомбу». Используется и
// `generate.mjs` (фикстуры), и `docx-zip-bomb.validator.spec.ts` (границы).
//
// Бомбы бывают двух видов, и райтер обязан уметь обе (🔒 BE-DOCX-01):
// - «лживая декларация» — store, центральный каталог ВРЁТ про несжатый размер
//   (`declaredUncompressed`). Ловится дешёвым предфильтром.
// - «настоящее раздутие» — `deflate: true`, поток честно разворачивается в
//   мегабайты, а заголовок при этом может заявлять сколько угодно мало.
//   Ловится только фактической распаковкой, ради чего фикс и делался.
import { deflateRawSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const DOS_DATE_TIME = Buffer.from([0x00, 0x00, 0x21, 0x00]); // 1980-01-01 00:00

/**
 * entries: [{ name, data, declaredUncompressed?, deflate?, method?, truncateCompressed? }].
 *
 * - `declaredUncompressed` (по умолчанию = data.length) — что пишется в оба
 *   заголовка как «несжатый размер». Переопределяя его, получаем бомбу.
 * - `deflate: true` — данные реально сжимаются (метод 8). Без него метод 0.
 * - `method` — записать в заголовки произвольный номер метода, не трогая сами
 *   данные (для проверки отказа на неизвестном методе).
 * - `truncateCompressed: n` — отрезать n байт с конца сжатого потока и
 *   уменьшить на них `compressedSize`. Даёт заголовки, которые сходятся, и
 *   оборванный DEFLATE внутри — это `FILE_CORRUPTED`, а не бомба.
 */
export function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    // CRC всегда по НЕсжатым данным — так требует формат.
    const crc = crc32(entry.data);
    const deflated = entry.deflate === true;
    const full = deflated ? deflateRawSync(entry.data) : entry.data;
    const payload =
      entry.truncateCompressed === undefined
        ? full
        : full.subarray(0, full.length - entry.truncateCompressed);
    const method = entry.method ?? (deflated ? 8 : 0);
    const compSize = payload.length;
    const uncompSize = entry.declaredUncompressed ?? entry.data.length;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    DOS_DATE_TIME.copy(local, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compSize, 18);
    local.writeUInt32LE(uncompSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push(local, payload);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    DOS_DATE_TIME.copy(central, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compSize, 20);
    central.writeUInt32LE(uncompSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + payload.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
}

export const DOCX_MAIN_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

/** Три обязательные части минимального OOXML-документа. */
export function docxEntries() {
  return [
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          `<Override PartName="/word/document.xml" ContentType="${DOCX_MAIN_MIME}"/>` +
          '</Types>',
        'utf8',
      ),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>',
        'utf8',
      ),
    },
    {
      name: 'word/document.xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:body><w:p><w:r><w:t>ConvertHub 018 fixture.</w:t></w:r></w:p></w:body>' +
          '</w:document>',
        'utf8',
      ),
    },
  ];
}
