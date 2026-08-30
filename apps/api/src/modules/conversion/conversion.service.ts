import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConvertRequest } from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { FilesService } from '../files/files.service';
import { ConversionHistoryService } from './conversion-history.service';
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
  /** Задан только если клиент попросил сохранить и сохранение удалось (спека 003). */
  readonly fileId?: string;
}

@Injectable()
export class ConversionService {
  constructor(
    @Inject(CONVERSION_ENGINES)
    private readonly engines: readonly ConversionEngine[],
    private readonly filesService: FilesService,
    private readonly conversionHistory: ConversionHistoryService,
  ) {}

  /**
   * Один `try {} finally {}`, без `catch` на верхнем уровне: типизированные
   * исключения из валидаторов и движка летят как есть (историю неуспешных
   * попыток пишет `ConversionFailureFilter` на HTTP-слое, не этот сервис —
   * спека 003), `finally` гарантирует уборку temp-файла независимо от исхода.
   */
  async convert(
    filePath: string,
    request: ConvertRequest,
    userId: string | null,
  ): Promise<ConvertResult> {
    const startedAt = Date.now();
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
      const mime = imageOutputMime(request.target);

      let fileId: string | undefined;
      if (request.save === true) {
        const saved = await this.filesService.saveConversionResult({
          userId,
          buffer,
          mime,
          extension: request.target,
        });
        fileId = saved?.fileId;
      }

      // Fire-and-forget, как и уборка temp-файла в фильтрах: упавшая запись
      // истории не должна превращать успешный ответ клиенту в отказ.
      void this.conversionHistory
        .recordConversion({
          userId,
          target: request.target,
          directionId: direction.id,
          status: 'COMPLETED',
          errorCode: null,
          durationMs: Date.now() - startedAt,
          fileId: fileId ?? null,
        })
        .catch(() => undefined);

      return { buffer, mime, fileId };
    } finally {
      await cleanupConvertTempDir(dirname(filePath));
    }
  }
}
