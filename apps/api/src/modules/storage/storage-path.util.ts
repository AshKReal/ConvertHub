import { isAbsolute, join } from 'node:path';

/**
 * Общая для `LocalDiskStorage` (запись/удаление) и `local-disk-raw.controller.ts`
 * (отдача байт) проверка: `key` — всегда системная строка (ULID + расширение),
 * никогда не приходит от клиента как есть, но обе стороны 🔒-пути защищаются
 * одинаково, а не каждая по-своему.
 */
export function resolveStorageKeyPath(baseDir: string, key: string): string {
  if (key.includes('..') || isAbsolute(key)) {
    throw new Error(`Небезопасный storage key: ${key}`);
  }
  return join(baseDir, key);
}
