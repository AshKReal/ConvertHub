import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_PAGES } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Разбирает только структуру документа (число страниц), не рендерит
 * содержимое — тот же принцип, что `pixel-count.validator.ts` (002):
 * дешёвая проверка заявленного объёма до дорогой обработки (здесь —
 * запуск Python-процесса).
 */
export async function assertPdfPageLimit(filePath: string): Promise<void> {
  let pageCount: number;

  try {
    const bytes = await readFile(filePath);
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = document.getPageCount();
  } catch {
    throw new AppException('FILE_CORRUPTED');
  }

  if (pageCount > MAX_PDF_PAGES) {
    throw new AppException('TOO_MANY_PAGES', {
      actual_pages: pageCount,
      max_pages: MAX_PDF_PAGES,
    });
  }
}
