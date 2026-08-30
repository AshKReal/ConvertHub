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
    // limitInputPixels отключён только для этого чтения заголовка: metadata()
    // не декодирует пиксели, поэтому здесь это безопасно, а sharp иначе сам
    // отказывает уже на этом шаге (лимит по умолчанию ~268 Мп) до того, как
    // наша проверка успеет отличить decompression bomb от честного большого фото.
    ({ width, height } = await sharp(filePath, {
      limitInputPixels: false,
    }).metadata());
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
