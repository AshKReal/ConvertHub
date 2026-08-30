import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';

declare module 'express' {
  interface Request {
    convertTempDir?: string;
  }
}

/**
 * Поток файла сразу на диск, во временную папку на запрос — не в память
 * (`diskStorage`, не `memoryStorage`). Имя папки и файла — случайные;
 * `file.originalname`/`file.mimetype` от клиента нигде не читаются и никогда
 * не становятся частью пути (🔒: «имя файла от клиента нигде не используется
 * как путь»).
 */
export function createConvertFileInterceptor() {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, _file, callback) => {
        const dir = join(tmpdir(), 'convert-hub', randomUUID());
        mkdirSync(dir, { recursive: true });
        req.convertTempDir = dir;
        callback(null, dir);
      },
      filename: (_req, _file, callback) => {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
  });
}

/**
 * Общая уборка для сервиса (`finally` на успешном пути) и фильтра
 * (обрыв до входа в сервис — размер превышен, обрыв соединения и т.п.).
 */
export async function cleanupConvertTempDir(
  dir: string | undefined,
): Promise<void> {
  if (dir === undefined) {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}
