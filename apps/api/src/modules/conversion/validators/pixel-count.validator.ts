import sharp from 'sharp';
import { MAX_IMAGE_PIXELS } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Decompression bomb: заявленное в заголовке разрешение проверяется до
 * декодирования пикселей — `sharp().metadata()` читает только заголовок,
 * без декодирования сжатых данных.
 */
export async function assertWithinPixelLimit(filePath: string): Promise<void> {
  let width: number | undefined;
  let height: number | undefined;

  try {
    ({ width, height } = await sharp(filePath).metadata());
  } catch {
    throw new AppException('FILE_CORRUPTED');
  }

  if (width === undefined || height === undefined) {
    throw new AppException('FILE_CORRUPTED');
  }

  // Вне try/catch выше: собственный отказ не должен быть переклассифицирован
  // как FILE_CORRUPTED повторным попаданием в тот же catch.
  const pixels = width * height;
  if (pixels > MAX_IMAGE_PIXELS) {
    throw new AppException('IMAGE_TOO_LARGE', {
      actual_pixels: pixels,
      max_pixels: MAX_IMAGE_PIXELS,
    });
  }
}
