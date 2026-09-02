import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_PIXELS, type ErrorCode } from '@convert-hub/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import { assertWithinPixelLimit } from './pixel-count.validator';

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

describe('assertWithinPixelLimit', () => {
  it('passes a small valid image', async () => {
    await expect(
      assertWithinPixelLimit(fixture('sample.png')),
    ).resolves.toBeUndefined();
  });

  it('passes an image whose declared pixels are exactly MAX_IMAGE_PIXELS (boundary)', async () => {
    await expect(
      assertWithinPixelLimit(fixture('exactly-50mp.png')),
    ).resolves.toBeUndefined();
  });

  it('rejects a decompression bomb by its declared dimensions, before decoding', async () => {
    const error = await rejection(
      assertWithinPixelLimit(fixture('oversized-dimensions.png')),
    );
    expect(bodyOf(error)).toEqual({
      code: 'IMAGE_TOO_LARGE' satisfies ErrorCode,
      meta: { actual_pixels: 8000 * 8000, max_pixels: MAX_IMAGE_PIXELS },
    });
    expect(error.getStatus()).toBe(422);
  });

  it('maps a non-image file to FILE_CORRUPTED', async () => {
    const error = await rejection(
      assertWithinPixelLimit(fixture('not-an-image.txt')),
    );
    expect(bodyOf(error).code).toBe('FILE_CORRUPTED' satisfies ErrorCode);
  });
});
