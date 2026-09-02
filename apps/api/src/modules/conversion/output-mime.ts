import type { ConversionTarget } from '@convert-hub/shared';

/**
 * Единая точка «target → MIME результата», не по движку — сигнатура
 * `ConversionEngine.convert()` фиксирована заранее и отдаёт только байты
 * (`engine.interface.ts`), MIME вызывающий сервис определяет сам. `pdf`
 * добавлен спекой 018 (направление `docx-to-pdf`).
 */
export function outputMimeFor(target: ConversionTarget): string {
  switch (target) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      // Все члены `ConversionTarget` покрыты — ветка только на случай
      // значения вне union в рантайме.
      throw new Error(`No output MIME mapping for target "${String(target)}"`);
  }
}
