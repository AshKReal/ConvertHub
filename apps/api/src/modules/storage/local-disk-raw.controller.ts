import { timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { env } from '../../config/env';
import { AppException } from '../../common/exceptions/app.exception';
import { computeSignedUrlSignature } from './signed-url.util';
import { resolveStorageKeyPath } from './storage-path.util';

const EXTENSION_MIME: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Единственный стенд-ин под реальный presigned URL S3 (спека 016) — там
 * браузер клиента заберёт байты напрямую у S3, минуя приложение целиком, и
 * этот контроллер исчезнет вместе с `LocalDiskStorage`. Без Prisma: хранилище
 * остаётся БД-агностичным, `Content-Type` — по расширению ключа, не по
 * `files.mime` из БД.
 *
 * Подделанная подпись, истёкшая подпись и отсутствующий на диске файл дают
 * один и тот же `FILE_NOT_FOUND` — намеренно неразличимо снаружи (спека 003,
 * 🔒 «ошибка не раскрывает, существует ли объект»).
 */
@Controller('v1/storage/local')
export class LocalDiskRawController {
  @Get('raw')
  async raw(
    @Query('key') key: string | undefined,
    @Query('expires') expiresRaw: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (
      typeof key !== 'string' ||
      typeof expiresRaw !== 'string' ||
      typeof sig !== 'string'
    ) {
      throw new AppException('FILE_NOT_FOUND');
    }

    const expires = Number(expiresRaw);
    if (!Number.isInteger(expires)) {
      throw new AppException('FILE_NOT_FOUND');
    }

    const expected = computeSignedUrlSignature(key, expires);
    if (!signaturesMatch(expected, sig)) {
      throw new AppException('FILE_NOT_FOUND');
    }

    // Подпись проверена раньше, чем `expires` доверяется хоть в чём-то —
    // иначе неподписанное поле решало бы, каким путём идёт код.
    if (expires < Math.floor(Date.now() / 1000)) {
      throw new AppException('FILE_NOT_FOUND');
    }

    let filePath: string;
    try {
      filePath = resolveStorageKeyPath(resolve(env.LOCAL_STORAGE_DIR), key);
    } catch {
      throw new AppException('FILE_NOT_FOUND');
    }

    try {
      await stat(filePath);
    } catch {
      throw new AppException('FILE_NOT_FOUND');
    }

    const mime =
      EXTENSION_MIME[extname(filePath)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(filePath)}"`,
    );

    const stream = createReadStream(filePath);
    res.on('close', () => stream.destroy());
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}

function signaturesMatch(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(actual, 'hex');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}
