// Пересобирает бинарные фикстуры для юнит-тестов валидаторов (спека 015).
// Запуск: `node apps/api/test/fixtures/generate.mjs` из корня репозитория.
// Фикстуры коммитятся в репозиторий — скрипт нужен, чтобы их можно было
// воспроизвести и объяснить (SPECS.md: «чем сгенерён каждый файл»).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

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

// PNG, у которого заголовок IHDR заявляет 60000×60000 (3.6 млрд пикселей,
// далеко за MAX_IMAGE_PIXELS), а данных внутри — как у 1×1. Собран патчем
// настоящего PNG: перезаписываем width/height в IHDR и пересчитываем CRC
// этого чанка, всё остальное остаётся валидным.
const onePx = await sharp({
  create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .png()
  .toBuffer();
const bomb = Buffer.from(onePx);
// Раскладка: [0..8) сигнатура, [8..12) длина IHDR, [12..16) "IHDR",
// [16..20) width, [20..24) height, ... CRC чанка идёт после 13 байт данных.
bomb.writeUInt32BE(60000, 16);
bomb.writeUInt32BE(60000, 20);
const ihdr = bomb.subarray(12, 12 + 4 + 13); // "IHDR" + 13 байт данных
bomb.writeUInt32BE(crc32(ihdr) >>> 0, 12 + 4 + 13);
await writeFile(out('huge-dimensions.png'), bomb);

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

console.log('fixtures written to', here);
