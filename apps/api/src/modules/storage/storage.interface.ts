/**
 * Ровно две абстракции во всём проекте — `Storage` и `ConversionEngine`
 * (ARCHITECTURE.md §4.2, `.claude/rules/backend.md`). Сигнатура фиксирована
 * заранее: `S3Storage` (спека 016) реализует её без единой правки в местах
 * вызова — это и есть проверочное свойство абстракции.
 */
export interface Storage {
  put(key: string, body: Buffer, mime: string): Promise<void>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  list(prefix: string): AsyncIterable<string>;
}

export const STORAGE = Symbol('STORAGE');
