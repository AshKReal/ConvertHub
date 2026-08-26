import type { AppError } from '../../../core/interceptors/error-interceptor';

/**
 * Дискриминантное объединение, а не набор булевых флагов (ARCHITECTURE.md §6.4):
 * оказаться одновременно в `empty` и `selected` нельзя, а `file`/`progress`/`error`
 * существуют только там, где они осмыслены. Все восемь состояний — `DESIGN.md`,
 * раздел «Зона загрузки».
 */
export type DropzoneState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'quotaFull' }
  | { readonly kind: 'dragover' }
  | { readonly kind: 'selected'; readonly file: File }
  | { readonly kind: 'uploading'; readonly file: File; readonly progress: number }
  | { readonly kind: 'converting'; readonly file: File }
  | { readonly kind: 'done'; readonly file: File }
  | { readonly kind: 'error'; readonly error: AppError };

export type DropzoneStateKind = DropzoneState['kind'];
