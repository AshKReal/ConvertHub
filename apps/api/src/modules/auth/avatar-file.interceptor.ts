import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MAX_AVATAR_SIZE_BYTES } from '@convert-hub/shared';

declare module 'express' {
  interface Request {
    avatarTempDir?: string;
  }
}

/**
 * Спека 029. Тот же приём, что `createConvertFileInterceptor` (016), с двумя
 * отличиями: свой потолок размера (`MAX_AVATAR_SIZE_BYTES`, 2 МБ вместо 10) и
 * своя временная папка, чтобы уборка одного пути не задевала другой.
 *
 * Поток сразу на диск, не в память: два мегабайта на запрос при
 * `memoryStorage` — это память, которую заказывает клиент, а не мы.
 * `file.originalname` и `file.mimetype` не читаются нигде и никогда не
 * становятся частью пути (🔒 `critical-zones.md`).
 */
export function createAvatarFileInterceptor() {
  return FileInterceptor('avatar', {
    storage: diskStorage({
      destination: (req, _file, callback) => {
        const dir = join(tmpdir(), 'convert-hub-avatar', randomUUID());
        mkdirSync(dir, { recursive: true });
        req.avatarTempDir = dir;
        callback(null, dir);
      },
      filename: (_req, _file, callback) => {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  });
}

/** Вызывается в `finally`, а не только на успешном пути (`critical-zones.md`). */
export async function cleanupAvatarTempDir(
  dir: string | undefined,
): Promise<void> {
  if (dir === undefined) {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}
