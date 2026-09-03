import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  MAX_DOCX_UNZIP_BYTES,
  MAX_DOCX_UNZIP_RATIO,
  type ErrorCode,
} from '@convert-hub/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildZip,
  docxEntries,
} from '../../../../test/fixtures/zip-writer.mjs';
import { assertDocxWithinUnzipLimit } from './docx-zip-bomb.validator';

const fixture = (name: string): string =>
  join(process.cwd(), 'test', 'fixtures', name);

const rejection = async (promise: Promise<unknown>): Promise<AppException> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return error as AppException;
  }
  throw new Error('expected the promise to reject');
};

const bodyOf = (error: AppException): { code: string; meta?: unknown } =>
  error.getResponse() as { code: string; meta?: unknown };

describe('assertDocxWithinUnzipLimit', () => {
  const temps: string[] = [];

  afterAll(async () => {
    await Promise.all(
      temps.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  const writeTemp = async (name: string, bytes: Buffer): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), 'ch-docx-'));
    temps.push(dir);
    const target = join(dir, name);
    await writeFile(target, bytes);
    return target;
  };

  it('passes a real minimal .docx', async () => {
    await expect(
      assertDocxWithinUnzipLimit(fixture('sample.docx')),
    ).resolves.toBeUndefined();
  });

  it('rejects the zip bomb fixture with FILE_TOO_LARGE and the numbers', async () => {
    const error = await rejection(
      assertDocxWithinUnzipLimit(fixture('zip-bomb.docx')),
    );
    const body = bodyOf(error);
    expect(body.code).toBe('FILE_TOO_LARGE' satisfies ErrorCode);
    // Сумма заявленного несжатого по всем записям (word/document.xml = 500 МиБ
    // + две мелкие части), сравнивается с абсолютным пределом.
    expect(body.meta).toMatchObject({ max_size_bytes: MAX_DOCX_UNZIP_BYTES });
    expect(
      (body.meta as { actual_size_bytes: number }).actual_size_bytes,
    ).toBeGreaterThanOrEqual(500 * 1024 * 1024);
    expect(error.getStatus()).toBe(413);
  });

  it('passes when the declared size is exactly MAX_DOCX_UNZIP_RATIO x file size', async () => {
    // Один store-вход: заявленный несжатый = fileSize*100 ровно. Файл строим,
    // мерим, потом переписываем — размер файла от значения в заголовке не
    // зависит (uint32-поле на месте).
    const probe = buildZip([{ name: 'a', data: Buffer.from('x') }]);
    const declared = probe.length * MAX_DOCX_UNZIP_RATIO;
    const atBoundary = buildZip([
      { name: 'a', data: Buffer.from('x'), declaredUncompressed: declared },
    ]);
    const path = await writeTemp('boundary.docx', atBoundary);
    await expect(assertDocxWithinUnzipLimit(path)).resolves.toBeUndefined();
  });

  it('rejects one byte over the ratio', async () => {
    const probe = buildZip([{ name: 'a', data: Buffer.from('x') }]);
    const over = buildZip([
      {
        name: 'a',
        data: Buffer.from('x'),
        declaredUncompressed: probe.length * MAX_DOCX_UNZIP_RATIO + 1,
      },
    ]);
    const path = await writeTemp('over.docx', over);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error)).toMatchObject({
      code: 'FILE_TOO_LARGE' satisfies ErrorCode,
      meta: { unzip_ratio_limit: MAX_DOCX_UNZIP_RATIO },
    });
  });

  it('maps non-zip bytes to FILE_CORRUPTED (no EOCD)', async () => {
    const path = await writeTemp('x.docx', Buffer.from('not a zip at all'));
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  it('maps a truncated archive to FILE_CORRUPTED', async () => {
    const full = buildZip(docxEntries());
    const path = await writeTemp('trunc.docx', full.subarray(0, 40));
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  // --- Фактическая распаковка (🔒 BE-DOCX-01) ---

  it('rejects a bomb that LIES about its size: tiny declaration, real DEFLATE blow-up', async () => {
    // Регрессия на саму дыру. Каталог заявляет 100 байт — предфильтр по
    // заявленному пропускает. Внутри DEFLATE, честно разворачивающийся в 5 МиБ
    // при файле в несколько килобайт. До фикса проходило целиком.
    const bomb = buildZip([
      {
        name: 'word/document.xml',
        data: Buffer.alloc(5 * 1024 * 1024),
        deflate: true,
        declaredUncompressed: 100,
      },
    ]);
    const path = await writeTemp('liar.docx', bomb);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error)).toMatchObject({
      code: 'FILE_TOO_LARGE' satisfies ErrorCode,
      meta: { unzip_ratio_limit: MAX_DOCX_UNZIP_RATIO },
    });
  });

  it('passes an honest DEFLATE .docx', async () => {
    const zip = buildZip(docxEntries().map((e) => ({ ...e, deflate: true })));
    const path = await writeTemp('deflated.docx', zip);
    await expect(assertDocxWithinUnzipLimit(path)).resolves.toBeUndefined();
  });

  // Граница считается от АБСОЛЮТНОГО предела, а не от коэффициента: стоит
  // архиву перевалить MAX_DOCX_UNZIP_BYTES/MAX_DOCX_UNZIP_RATIO (512 КиБ),
  // и связывает уже константа. Иначе предел зависел бы от размера файла,
  // который сам зависит от содержимого, — точную границу не построить.
  const PADDING_BYTES = 600 * 1024;
  const atExactly = (total: number): Buffer =>
    buildZip([
      { name: 'pad', data: Buffer.alloc(PADDING_BYTES) },
      {
        name: 'bomb',
        data: Buffer.alloc(total - PADDING_BYTES),
        deflate: true,
        declaredUncompressed: 1,
      },
    ]);

  it('passes when the REAL inflated size is exactly MAX_DOCX_UNZIP_BYTES', async () => {
    const path = await writeTemp('exact.docx', atExactly(MAX_DOCX_UNZIP_BYTES));
    await expect(assertDocxWithinUnzipLimit(path)).resolves.toBeUndefined();
  });

  it('rejects one byte over MAX_DOCX_UNZIP_BYTES of real inflation', async () => {
    const path = await writeTemp(
      'over-abs.docx',
      atExactly(MAX_DOCX_UNZIP_BYTES + 1),
    );
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error)).toMatchObject({
      code: 'FILE_TOO_LARGE' satisfies ErrorCode,
      meta: { max_size_bytes: MAX_DOCX_UNZIP_BYTES },
    });
  });

  it('maps a truncated DEFLATE stream to FILE_CORRUPTED, not FILE_TOO_LARGE', async () => {
    // Заголовки сходятся, оборван сам поток. Это битый файл, а не бомба —
    // код должен различать (`critical-zones.md`).
    const zip = buildZip([
      {
        name: 'a',
        data: Buffer.alloc(5000),
        deflate: true,
        truncateCompressed: 4,
      },
    ]);
    const path = await writeTemp('trunc-deflate.docx', zip);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  it('rejects an unknown compression method as FILE_CORRUPTED', async () => {
    const zip = buildZip([{ name: 'a', data: Buffer.from('x'), method: 12 }]);
    const path = await writeTemp('method12.docx', zip);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  it('rejects a local header offset pointing outside the file', async () => {
    const zip = buildZip(docxEntries());
    const idx = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(zip.length + 1000, idx + 42);
    const path = await writeTemp('bad-offset.docx', zip);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  it('rejects a ZIP64 sentinel in the central directory as FILE_CORRUPTED', async () => {
    const zip = buildZip(docxEntries());
    // Найти первый central header (PK\x01\x02) и подставить 0xFFFFFFFF в
    // поле «несжатый размер» (offset +24).
    const idx = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(0xffffffff, idx + 24);
    const path = await writeTemp('zip64.docx', zip);
    const error = await rejection(assertDocxWithinUnzipLimit(path));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });
});
