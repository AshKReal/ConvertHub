import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { env } from '../../config/env';
import { computeSignedUrlSignature } from './signed-url.util';
import { resolveStorageKeyPath } from './storage-path.util';
import type { Storage } from './storage.interface';

/**
 * Временная реализация `Storage` до появления S3-совместимого хранилища
 * (спека 016, TECH-SPEC.md §3.2). `mime` не используется — на локальном
 * диске нет слота для content-type; `S3Storage` передаст его в `ContentType`
 * реального объекта. Известный, принятый пробел интерим-реализации.
 */
@Injectable()
export class LocalDiskStorage implements Storage {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = resolve(env.LOCAL_STORAGE_DIR);
    const cwd = resolve(process.cwd());
    if (
      this.baseDir === cwd ||
      this.baseDir.toLowerCase().startsWith(cwd.toLowerCase() + sep)
    ) {
      // «Папка вне репозитория» (tasks.md, спека 003) — не просто соглашение
      // по именованию, а проверяемый на старте инвариант.
      throw new Error(
        `LOCAL_STORAGE_DIR (${this.baseDir}) не может лежать внутри репозитория (${cwd})`,
      );
    }
  }

  async put(key: string, body: Buffer, _mime: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, body);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- сигнатура интерфейса общая с будущим S3Storage (реальный I/O), здесь синхронная HMAC-подпись
  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = computeSignedUrlSignature(key, expires);
    const params = new URLSearchParams({
      key,
      expires: String(expires),
      sig,
    });
    return `/v1/storage/local/raw?${params.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async *list(prefix: string): AsyncIterable<string> {
    yield* this.walk(this.baseDir, prefix);
  }

  private resolveKey(key: string): string {
    return resolveStorageKeyPath(this.baseDir, key);
  }

  private async *walk(
    dir: string,
    prefix: string,
  ): AsyncGenerator<string, void, undefined> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* this.walk(full, prefix);
        continue;
      }
      const key = full
        .slice(this.baseDir.length + 1)
        .split(sep)
        .join('/');
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }
}
