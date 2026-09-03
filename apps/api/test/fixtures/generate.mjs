// Пересобирает бинарные фикстуры для юнит-тестов валидаторов (спека 015).
// Запуск: `node apps/api/test/fixtures/generate.mjs` из корня репозитория.
// Фикстуры коммитятся в репозиторий — скрипт нужен, чтобы их можно было
// воспроизвести и объяснить (SPECS.md: «чем сгенерён каждый файл»).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { buildZip, crc32, docxEntries } from './zip-writer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = (name) => join(here, name);

// 8×8 сплошной цвет — минимально валидные изображения, magic bytes реальные.
await sharp({
  create: { width: 8, height: 8, channels: 3, background: { r: 220, g: 40, b: 40 } },
})
  .jpeg()
  .toFile(out('sample.jpg'));

await sharp({
  create: { width: 8, height: 8, channels: 3, background: { r: 40, g: 90, b: 220 } },
})
  .png()
  .toFile(out('sample.png'));

/**
 * PNG, у которого IHDR заявляет `width`×`height`, а данных внутри — как у
 * 1×1. Собран патчем настоящего PNG: перезаписываем width/height в IHDR и
 * пересчитываем CRC этого чанка, всё остальное валидно. `assertWithinPixelLimit`
 * читает только заголовок (`sharp().metadata()`), декодирования нет.
 */
const patchDimensions = async (width, height) => {
  const onePx = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  const png = Buffer.from(onePx);
  // [0..8) сигнатура, [8..12) длина IHDR, [12..16) "IHDR",
  // [16..20) width, [20..24) height, ... CRC чанка после 13 байт данных.
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 12 + 4 + 13)), 12 + 4 + 13);
  return png;
};

// 8000×8000 = 64 Мп > MAX_IMAGE_PIXELS (50 Мп). Обычный размер кадра — ни
// один загрузчик его не отбрасывает как «слишком большой заголовок», в
// отличие от экстремальных значений.
await writeFile(out('oversized-dimensions.png'), await patchDimensions(8000, 8000));
// Ровно на границе: 10000×5000 = 50 000 000 = MAX_IMAGE_PIXELS — исключения быть не должно.
await writeFile(out('exactly-50mp.png'), await patchDimensions(10000, 5000));

const pdfWithPages = async (count) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i += 1) {
    doc.addPage([200, 200]);
  }
  return Buffer.from(await doc.save());
};

await writeFile(out('sample.pdf'), await pdfWithPages(1));
await writeFile(out('exactly-50.pdf'), await pdfWithPages(50));
await writeFile(out('many-pages.pdf'), await pdfWithPages(51));

await writeFile(out('not-an-image.txt'), 'just some text, no magic bytes here\n');

// ---- ZIP / DOCX (спека 018) — райтер в отдельном модуле, общий со спекой ----
const docx = docxEntries();
await writeFile(out('sample.docx'), buildZip(docx));

// Бомба №1, «лживая декларация»: тот же docx, но центральный каталог заявляет
// 500 МиБ несжатого на `word/document.xml` при паре сотен байт на диске —
// превышает и коэффициент (MAX_DOCX_UNZIP_RATIO), и абсолютный предел
// (MAX_DOCX_UNZIP_BYTES). Больше 4 ГиБ в обычный ZIP не заявить — там uint32,
// для этого нужен ZIP64. Ловится дешёвым предфильтром по заголовкам.
await writeFile(
  out('zip-bomb.docx'),
  buildZip(
    docx.map((e) =>
      e.name === 'word/document.xml'
        ? { ...e, declaredUncompressed: 500 * 1024 * 1024 }
        : e,
    ),
  ),
);

// Бомба №2, «настоящее раздутие» (🔒 BE-DOCX-01): заголовки скромничают (100
// байт), а DEFLATE-поток честно разворачивается в 40 МиБ при нескольких
// килобайтах на диске. Предфильтр по заявленному её НЕ видит — ловит только
// фактическая распаковка. Файл в репозитории маленький: нули жмутся ~1000:1.
await writeFile(
  out('zip-bomb-deflate.docx'),
  buildZip(
    docx.map((e) =>
      e.name === 'word/document.xml'
        ? {
            ...e,
            data: Buffer.alloc(40 * 1024 * 1024),
            deflate: true,
            declaredUncompressed: 100,
          }
        : e,
    ),
  ),
);

console.log('fixtures written to', here);
