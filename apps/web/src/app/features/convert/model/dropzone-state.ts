/**
 * Дискриминантное объединение, а не набор булевых флагов (ARCHITECTURE.md §6.4):
 * оказаться одновременно в `empty` и `selected` нельзя, а `file` существует
 * только там, где он осмыслен.
 *
 * Состояния `uploading`, `converting`, `done`, `error`, `quotaFull` добавляет спека 006.
 */
export type DropzoneState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'dragover' }
  | { readonly kind: 'selected'; readonly file: File };

export type DropzoneStateKind = DropzoneState['kind'];
