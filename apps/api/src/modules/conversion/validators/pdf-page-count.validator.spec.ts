import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@convert-hub/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import { assertPdfPageLimit } from './pdf-page-count.validator';

// vitest запускается с cwd = `apps/api` (`vitest.config.ts` → `root: './'`).
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

describe('assertPdfPageLimit', () => {
  const temps: string[] = [];

  afterAll(async () => {
    await Promise.all(
      temps.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  const writeTemp = async (name: string, bytes: Buffer): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), 'ch-pdf-'));
    temps.push(dir);
    const target = join(dir, name);
    await writeFile(target, bytes);
    return target;
  };

  it('passes a single-page PDF', async () => {
    await expect(
      assertPdfPageLimit(fixture('sample.pdf')),
    ).resolves.toBeUndefined();
  });

  it('passes a PDF with exactly MAX_PDF_PAGES pages (boundary)', async () => {
    await expect(
      assertPdfPageLimit(fixture('exactly-50.pdf')),
    ).resolves.toBeUndefined();
  });

  it('rejects a PDF one page over the limit with TOO_MANY_PAGES and the counts', async () => {
    const error = await rejection(
      assertPdfPageLimit(fixture('many-pages.pdf')),
    );
    expect(bodyOf(error)).toEqual({
      code: 'TOO_MANY_PAGES' satisfies ErrorCode,
      meta: { actual_pages: 51, max_pages: 50 },
    });
    expect(error.getStatus()).toBe(422);
  });

  it('maps bytes with no PDF header to FILE_CORRUPTED', async () => {
    // Нет сигнатуры `%PDF` вовсе — pdf-lib отказывает детерминированно
    // («No PDF header found»), в отличие от «полу-битого» PDF, где поведение
    // парсера зависит от версии.
    const garbage = await writeTemp(
      'garbage.pdf',
      Buffer.from('this is not a pdf at all', 'utf8'),
    );
    const error = await rejection(assertPdfPageLimit(garbage));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });

  it('maps an empty file to FILE_CORRUPTED', async () => {
    const empty = await writeTemp('empty.pdf', Buffer.alloc(0));
    const error = await rejection(assertPdfPageLimit(empty));
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });
});
