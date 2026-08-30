import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConvertRequest } from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { cleanupConvertTempDir } from './convert-file.interceptor';
import {
  CONVERSION_ENGINES,
  type ConversionEngine,
} from './engines/engine.interface';
import { imageOutputMime } from './engines/image.engine';
import { assertSupportedDirection } from './validators/conversion-direction.validator';
import { detectFileType } from './validators/magic-bytes.validator';
import { assertWithinPixelLimit } from './validators/pixel-count.validator';

export interface ConvertResult {
  readonly buffer: Buffer;
  readonly mime: string;
}

@Injectable()
export class ConversionService {
  constructor(
    @Inject(CONVERSION_ENGINES)
    private readonly engines: readonly ConversionEngine[],
  ) {}

  /**
   * Один `try {} finally {}`, без `catch` на верхнем уровне: типизированные
   * исключения из валидаторов и движка летят как есть, `finally` гарантирует
   * уборку temp-файла независимо от исхода (успех, отказ, непредвиденный сбой).
   */
  async convert(
    filePath: string,
    request: ConvertRequest,
  ): Promise<ConvertResult> {
    try {
      const detected = await detectFileType(filePath);
      const direction = assertSupportedDirection(detected, request.target);
      await assertWithinPixelLimit(filePath);

      const engine = this.engines.find((e) =>
        e.supports(direction.from, direction.to),
      );
      if (!engine) {
        // supports() у зарегистрированных движков не покрывает это направление —
        // конфигурация модуля неполна, не вина запроса.
        throw new AppException('CONVERSION_FAILED');
      }

      const input = await readFile(filePath);
      const buffer = await engine.convert(input, {
        target: request.target,
        quality: request.quality,
        background: request.background,
      });

      return { buffer, mime: imageOutputMime(request.target) };
    } finally {
      await cleanupConvertTempDir(dirname(filePath));
    }
  }
}
