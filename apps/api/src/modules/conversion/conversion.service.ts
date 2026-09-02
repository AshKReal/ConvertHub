import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConvertRequest } from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { FilesService } from '../files/files.service';
import { ConcurrencyLimiterService } from './concurrency-limiter.service';
import { ConversionHistoryService } from './conversion-history.service';
import { cleanupConvertTempDir } from './convert-file.interceptor';
import { DocumentPoolService } from './document-pool.service';
import {
  CONVERSION_ENGINES,
  type ConversionEngine,
} from './engines/engine.interface';
import { outputMimeFor } from './output-mime';
import { assertSupportedDirection } from './validators/conversion-direction.validator';
import { assertDocxWithinUnzipLimit } from './validators/docx-zip-bomb.validator';
import { detectFileType } from './validators/magic-bytes.validator';
import { assertPdfPageLimit } from './validators/pdf-page-count.validator';
import { assertWithinPixelLimit } from './validators/pixel-count.validator';

export interface ConvertResult {
  readonly buffer: Buffer;
  readonly mime: string;
  /** Задан только если клиент попросил сохранить и сохранение удалось (спека 003). */
  readonly fileId?: string;
  /**
   * Спека 010. `true`, только если клиент просил `save:true`, а сервер молча
   * не сохранил из-за заполненной квоты — контроллер превращает это в
   * заголовок `X-Save-Skipped-Reason` (тело ответа бинарное, сигнализировать
   * иначе нечем).
   */
  readonly saveSkippedQuota: boolean;
}

@Injectable()
export class ConversionService {
  constructor(
    @Inject(CONVERSION_ENGINES)
    private readonly engines: readonly ConversionEngine[],
    private readonly filesService: FilesService,
    private readonly conversionHistory: ConversionHistoryService,
    private readonly concurrencyLimiter: ConcurrencyLimiterService,
    private readonly documentPool: DocumentPoolService,
  ) {}

  /**
   * Один `try {} finally {}`, без `catch` на верхнем уровне: типизированные
   * исключения из валидаторов и движка летят как есть (историю неуспешных
   * попыток пишет `ConversionFailureFilter` на HTTP-слое, не этот сервис —
   * спека 003), `finally` гарантирует уборку temp-файла независимо от исхода
   * и освобождение слота одновременности, если он вообще был занят.
   */
  async convert(
    filePath: string,
    request: ConvertRequest,
    userId: string | null,
    concurrencyKey: string,
    originalFilename: string,
  ): Promise<ConvertResult> {
    const startedAt = Date.now();
    let acquiredSlot = false;
    try {
      this.concurrencyLimiter.acquire(concurrencyKey);
      acquiredSlot = true;

      const detected = await detectFileType(filePath);
      const direction = assertSupportedDirection(detected, request.target);

      // Проверка входа — по категории формата (`sharp` не понимает PDF, а
      // DOCX — это ZIP, спека 018 🔒): бомба-разрешение для изображений,
      // предел страниц для PDF, бомба-распаковки для DOCX. Всегда ДО движка.
      if (direction.from === 'PDF') {
        await assertPdfPageLimit(filePath);
      } else if (direction.from === 'DOCX') {
        await assertDocxWithinUnzipLimit(filePath);
      } else {
        await assertWithinPixelLimit(filePath);
      }

      const engine = this.engines.find((e) =>
        e.supports(direction.from, direction.to),
      );
      if (!engine) {
        // supports() у зарегистрированных движков не покрывает это направление —
        // конфигурация модуля неполна, не вина запроса.
        throw new AppException('CONVERSION_FAILED');
      }

      const input = await readFile(filePath);

      // Спека 018 (TECH-SPEC.md §6). Пул документных конвертаций — только для
      // `DOCX→PDF` (общий ресурс LibreOffice), вокруг самого `engine.convert`;
      // `acquire()` может бросить `SERVICE_OVERLOADED` после ожидания.
      let buffer: Buffer;
      if (direction.from === 'DOCX') {
        await this.documentPool.acquire();
        try {
          buffer = await engine.convert(input, {
            target: request.target,
            quality: request.quality,
            background: request.background,
          });
        } finally {
          this.documentPool.release();
        }
      } else {
        buffer = await engine.convert(input, {
          target: request.target,
          quality: request.quality,
          background: request.background,
        });
      }
      const mime = outputMimeFor(request.target);

      let fileId: string | undefined;
      let saveSkippedQuota = false;
      if (request.save === true) {
        const outcome = await this.filesService.saveConversionResult({
          userId,
          buffer,
          mime,
          extension: request.target,
          originalFilename,
        });
        if (outcome.status === 'saved') {
          fileId = outcome.fileId;
        } else if (outcome.status === 'skipped-quota') {
          saveSkippedQuota = true;
        }
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

      return { buffer, mime, fileId, saveSkippedQuota };
    } finally {
      if (acquiredSlot) {
        this.concurrencyLimiter.release(concurrencyKey);
      }
      await cleanupConvertTempDir(dirname(filePath));
    }
  }
}
