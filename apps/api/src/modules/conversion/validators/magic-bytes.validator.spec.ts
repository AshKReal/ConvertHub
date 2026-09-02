import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { detectFileType } from './magic-bytes.validator';

// vitest запускается с cwd = `apps/api` (`vitest.config.ts` → `root: './'`).
const fixture = (name: string): string =>
  join(process.cwd(), 'test', 'fixtures', name);

describe('detectFileType', () => {
  const temps: string[] = [];

  afterAll(async () => {
    await Promise.all(
      temps.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  // Тип по сигнатуре, не по расширению: копируем реальный JPEG под именем
  // `.png` и проверяем, что детект всё равно даёт `image/jpeg`.
  const asExtension = async (
    source: string,
    newName: string,
  ): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), 'ch-magic-'));
    temps.push(dir);
    const target = join(dir, newName);
    await copyFile(fixture(source), target);
    return target;
  };

  it('identifies a real JPEG as image/jpeg', async () => {
    expect(await detectFileType(fixture('sample.jpg'))).toMatchObject({
      mime: 'image/jpeg',
    });
  });

  it('identifies a real PNG as image/png', async () => {
    expect(await detectFileType(fixture('sample.png'))).toMatchObject({
      mime: 'image/png',
    });
  });

  it('identifies a real PDF as application/pdf', async () => {
    expect(await detectFileType(fixture('sample.pdf'))).toMatchObject({
      mime: 'application/pdf',
    });
  });

  it('ignores the file extension — a JPEG renamed to .png is still image/jpeg', async () => {
    const disguised = await asExtension('sample.jpg', 'photo.png');
    expect(await detectFileType(disguised)).toMatchObject({
      mime: 'image/jpeg',
    });
  });

  it('returns undefined for a file with no known signature', async () => {
    expect(await detectFileType(fixture('not-an-image.txt'))).toBeUndefined();
  });
});
