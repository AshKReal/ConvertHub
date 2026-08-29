// specs/000-engine-quality-check.md - candidate A: LibreOffice's own PDF import filter.
// Free, reuses the soffice binary already required for docx-pdf.mjs.
// Usage: node pdf-docx-a-libreoffice.mjs
import { spawn } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { listFiles, fileSize, timed, report, ensureDir } from './lib.mjs';
import { findSoffice } from './soffice.mjs';

const SAMPLES_DIR = join(import.meta.dirname, 'samples', 'pdf-docx');
const OUT_DIR = join(import.meta.dirname, 'results', 'pdf-docx-a-out');

const files = await listFiles(SAMPLES_DIR, ['.pdf']);
if (files.length === 0) {
  console.error(`No files in ${SAMPLES_DIR} - drop 20-30 real PDF files there first.`);
  process.exit(1);
}

await ensureDir(OUT_DIR);
const soffice = await findSoffice();

function convert(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(soffice, [
      '--headless',
      '--infilter=writer_pdf_import',
      '--convert-to',
      'docx',
      '--outdir',
      OUT_DIR,
      file,
    ]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`soffice exit ${code}: ${stderr.trim() || '(no stderr)'}`));
    });
  });
}

const rows = [];
for (const file of files) {
  const outPath = join(OUT_DIR, basename(file, extname(file)) + '.docx');
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

await report('pdf-docx-a-libreoffice', rows);
console.log(`Converted files: ${OUT_DIR} - open in Word/LibreOffice, check if text is editable or a frozen frame.`);
