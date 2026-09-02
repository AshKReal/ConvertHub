import { CONVERSION_TARGETS, type ConversionTarget } from '@convert-hub/shared';

export type FileCategory = 'image' | 'document' | 'document-with-lines';

const CATEGORY_BY_TARGET: Record<ConversionTarget, FileCategory> = {
  png: 'image',
  jpg: 'image',
  docx: 'document',
  pdf: 'document-with-lines',
};

/**
 * Спека 010. `extension` в `FileListItem` (`packages/shared`) — обычная
 * строка (Prisma `@db.VarChar(8)`), не буквально `ConversionTarget` — но
 * гарантированно один из четырёх значений по построению: `FilesService`
 * (`apps/api`) создаёт файл только с `extension: request.target`, уже
 * провалидированным Zod-схемой запроса. Не внешние недоверенные данные —
 * сужение по факту, не догадка.
 */
export function fileCategory(extension: string): FileCategory {
  return isConversionTarget(extension) ? CATEGORY_BY_TARGET[extension] : 'document';
}

function isConversionTarget(value: string): value is ConversionTarget {
  return (CONVERSION_TARGETS as readonly string[]).includes(value);
}
