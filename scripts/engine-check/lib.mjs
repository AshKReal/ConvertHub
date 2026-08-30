import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

/** Lists files with one of `extensions` (lowercase, with dot) directly inside `dir`. */
export async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && extensions.includes(extname(e.name).toLowerCase()))
    .map((e) => join(dir, e.name))
    .sort();
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

/** Runs `fn`, returns { ms, result } or { ms, error }. Never throws. */
export async function timed(fn) {
  const start = performance.now();
  try {
    const result = await fn();
    return { ms: Math.round(performance.now() - start), result };
  } catch (error) {
    return { ms: Math.round(performance.now() - start), error: String(error?.message ?? error) };
  }
}

/** Writes rows as JSON to results/<name>.json and prints a plain-text summary table. */
export async function report(name, rows) {
  await ensureDir(join(import.meta.dirname, 'results'));
  const outPath = join(import.meta.dirname, 'results', `${name}.json`);
  await writeFile(outPath, JSON.stringify(rows, null, 2), 'utf-8');

  const ok = rows.filter((r) => r.ok);
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n=== ${name} ===`);
  console.log(`${ok.length}/${rows.length} succeeded`);
  for (const r of rows) {
    const status = r.ok ? `${r.ms}ms` : `FAILED: ${r.error}`;
    console.log(`  ${r.file.padEnd(40)} ${status}`);
  }
  if (ok.length > 0) {
    const avg = Math.round(ok.reduce((sum, r) => sum + r.ms, 0) / ok.length);
    console.log(`avg ${avg}ms over ${ok.length} successful files`);
  }
  if (failed.length > 0) {
    console.log(`${failed.length} failed - see reasons above`);
  }
  console.log(`Full report: ${outPath}`);
}
