import type { FileTypeResult } from 'file-type';

/**
 * Тип файла определяется по сигнатуре, не по расширению/`Content-Type`
 * (`.claude/rules/critical-zones.md`). `file-type` — ESM-only; `apps/api`
 * собирается в CJS, поэтому импорт значения динамический (статический дал бы
 * `ERR_REQUIRE_ESM` в рантайме) — тип берём отдельно, type-only импорт стирается
 * при компиляции и рантайм-ограничения не касается.
 */
export async function detectFileType(
  filePath: string,
): Promise<FileTypeResult | undefined> {
  const { fileTypeFromFile } = await import('file-type');
  return fileTypeFromFile(filePath);
}
