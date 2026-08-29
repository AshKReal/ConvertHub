// specs/000-engine-quality-check.md - soffice --headless, DOCX->PDF, on real files from samples/docx-pdf/.
// One soffice process per file, so `ms` includes LibreOffice startup (~2-5s) on top of the
// actual conversion - a real service would keep a listener running instead. Fine for a quality
// check, not a latency benchmark.
// Usage: node docx-pdf.mjs
import { spawn } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { listFiles, fileSize, timed, report, ensureDir } from './lib.mjs';
import { findSoffice } from './soffice.mjs';

const SAMPLES_DIR = join(import.meta.dirname, 'samples', 'docx-pdf');
const OUT_DIR = join(import.meta.dirname, 'results', 'docx-pdf-out');

const files = await listFiles(SAMPLES_DIR, ['.docx', '.doc']);
if (files.length === 0) {
  console.error(`No files in ${SAMPLES_DIR} - drop 20-30 real DOCX files there first.`);
  process.exit(1);
}

await ensureDir(OUT_DIR);
const soffice = await findSoffice();

function convert(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', OUT_DIR, file]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', reject); // e.g. soffice not found
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`soffice exit ${code}: ${stderr.trim() || '(no stderr)'}`));
    });
  });
}

const rows = [];
for (const file of files) {
  const outPath = join(OUT_DIR, basename(file, extname(file)) + '.pdf');
  const inSize = await fileSize(file);
  const { ms, error } = await timed(() => convert(file));

  rows.push({
    file: basename(file),
    inSizeBytes: inSize,
    outSizeBytes: error ? null : await fileSize(outPath),
    ms,
    ok: !error,
    error: error ?? null,
  });
}

await report('docx-pdf', rows);
console.log(`Converted files: ${OUT_DIR} - open them and check tables/fonts/images by eye.`);
