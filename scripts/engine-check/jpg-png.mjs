// specs/000-engine-quality-check.md - sharp, JPG<->PNG, on real files from samples/jpg-png/.
// Usage: node jpg-png.mjs
import sharp from 'sharp';
import { basename, extname, join } from 'node:path';
import { listFiles, fileSize, timed, report } from './lib.mjs';

const SAMPLES_DIR = join(import.meta.dirname, 'samples', 'jpg-png');
const OUT_DIR = join(import.meta.dirname, 'results', 'jpg-png-out');

const files = await listFiles(SAMPLES_DIR, ['.jpg', '.jpeg', '.png']);
if (files.length === 0) {
  console.error(`No files in ${SAMPLES_DIR} - drop 20-30 real JPG/PNG files there first.`);
  process.exit(1);
}

const rows = [];
for (const file of files) {
  const ext = extname(file).toLowerCase();
  const targetExt = ext === '.png' ? '.jpg' : '.png';
  const outPath = join(OUT_DIR, basename(file, ext) + targetExt);
  const inSize = await fileSize(file);

  const { ms, error } = await timed(async () => {
    const pipeline = sharp(file);
    if (targetExt === '.jpg') {
      pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
    } else {
      pipeline.png();
    }
    await pipeline.toFile(outPath);
  });

  rows.push({
    file: basename(file),
    direction: ext === '.png' ? 'PNG->JPG' : 'JPG->PNG',
    inSizeBytes: inSize,
    outSizeBytes: error ? null : await fileSize(outPath),
    ms,
    ok: !error,
    error: error ?? null,
  });
}

await report('jpg-png', rows);
console.log(`Converted files: ${OUT_DIR} - open them and judge quality by eye.`);
