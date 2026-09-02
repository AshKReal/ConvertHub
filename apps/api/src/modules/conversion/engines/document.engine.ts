import { Logger } from '@nestjs/common';
import { CONVERSION_TIMEOUT_SECONDS } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';
import { env } from '../../../config/env';
import type { ConvertOptions } from '../models/convert-options.model';
import type { ConversionEngine } from './engine.interface';

const logger = new Logger('DocumentEngine');

/**
 * Спека 018. Вторая реализация `ConversionEngine` (первые — `ImageEngine`
 * 002, `PdfToDocxEngine` 005): HTTP-клиент к Gotenberg (LibreOffice в
 * изолированном контейнере, `ARCHITECTURE.md` §2). Сигнатура интерфейса не
 * менялась — это проверочное свойство (`TECH-SPEC.md` §14).
 *
 * Пул одновременных вызовов (`DocumentPoolService`) — не здесь: движок не
 * знает про очередь и `503`, `ConversionService` держит его вокруг
 * `convert()`.
 */
export class DocumentEngine implements ConversionEngine {
  supports(from: string, to: string): boolean {
    return from === 'DOCX' && to === 'PDF';
  }

  async convert(input: Buffer, _opts: ConvertOptions): Promise<Buffer> {
    const form = new FormData();
    form.append(
      'files',
      new Blob([new Uint8Array(input)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      'document.docx',
    );

    let response: Response;
    try {
      response = await fetch(`${env.GOTENBERG_URL}/forms/libreoffice/convert`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(CONVERSION_TIMEOUT_SECONDS * 1000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AppException('CONVERSION_TIMEOUT');
      }
      // Сеть/DNS/Gotenberg лёг — диагностика в лог сервера, не клиенту.
      logger.error(
        `Gotenberg недоступен: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AppException('CONVERSION_FAILED', { reason: 'gotenberg' });
    }

    if (!response.ok) {
      logger.error(`Gotenberg вернул ${response.status}`);
      throw new AppException('CONVERSION_FAILED', {
        gotenberg_status: response.status,
      });
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
