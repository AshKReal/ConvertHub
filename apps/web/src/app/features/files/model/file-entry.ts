import type { ConversionTarget } from '@convert-hub/shared';

export type FileCategory = 'image' | 'document' | 'document-with-lines';

export interface FileEntry {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly target: ConversionTarget;
  readonly saved: boolean;
}

const CATEGORY_BY_TARGET: Record<ConversionTarget, FileCategory> = {
  png: 'image',
  jpg: 'image',
  docx: 'document',
  pdf: 'document-with-lines',
};

export function fileCategory(target: ConversionTarget): FileCategory {
  return CATEGORY_BY_TARGET[target];
}
