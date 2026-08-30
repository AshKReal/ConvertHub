import type { ConversionTarget } from '@convert-hub/shared';

/**
 * Единая точка «target → MIME результата», не по движку — сигнатура
 * `ConversionEngine.convert()` фиксирована заранее и отдаёт только байты
 * (`engine.interface.ts`), MIME вызывающий сервис определяет сам. `pdf` не
 * входит: до 018 ни один путь `SUPPORTED_DIRECTIONS` не отдаёт этот target,
 * добавлять его раньше значит держать недостижимый код.
 */
export function outputMimeFor(target: ConversionTarget): string {
  switch (target) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      throw new Error(`No output MIME mapping for target "${target}"`);
  }
}
