import type { ConversionTarget } from '@convert-hub/shared';

/**
 * Опции движка — внутренний тип оркестрации, не форма запроса/ответа API
 * (ARCHITECTURE.md §4.1, таблица расположения типов). `target` переиспользует
 * `ConversionTarget` из `packages/shared`, не заводит второй union.
 */
export interface ConvertOptions {
  readonly target: ConversionTarget;
  readonly quality?: number;
  readonly background?: string;
}
