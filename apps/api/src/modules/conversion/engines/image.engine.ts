import sharp from 'sharp';
import { MAX_IMAGE_PIXELS } from '@convert-hub/shared';
import type { ConversionEngine } from './engine.interface';
import type { ConvertOptions } from '../models/convert-options.model';

const SUPPORTED_FORMATS = new Set(['JPG', 'PNG']);

export class ImageEngine implements ConversionEngine {
  supports(from: string, to: string): boolean {
    return (
      SUPPORTED_FORMATS.has(from) && SUPPORTED_FORMATS.has(to) && from !== to
    );
  }

  async convert(input: Buffer, opts: ConvertOptions): Promise<Buffer> {
    // Второй, движковый барьер против decompression bomb — первый и решающий
    // (validators/pixel-count.validator.ts) уже отработал до вызова этого метода.
    const pipeline = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS });

    switch (opts.target) {
      case 'jpg':
        return pipeline
          .flatten({ background: opts.background ?? '#ffffff' })
          .jpeg({ quality: opts.quality ?? 90 })
          .toBuffer();
      case 'png':
        return pipeline.png().toBuffer();
      default:
        // supports() гарантирует, что сервис не выберет ImageEngine для чужой цели;
        // если всё же дошло сюда — ошибка вызывающего кода, не пользовательского ввода.
        throw new Error(`ImageEngine cannot produce target "${opts.target}"`);
    }
  }
}
