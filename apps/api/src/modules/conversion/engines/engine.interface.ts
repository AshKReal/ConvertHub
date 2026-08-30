import type { ConvertOptions } from '../models/convert-options.model';

/**
 * Сигнатура фиксирована заранее — под движок, работающий по HTTP, а не только
 * внутри процесса (TECH-SPEC.md §14). Появление второй реализации (018,
 * Gotenberg или движок PDF→DOCX) не должно потребовать её менять.
 */
export interface ConversionEngine {
  supports(from: string, to: string): boolean;
  convert(input: Buffer, opts: ConvertOptions): Promise<Buffer>;
}

/** DI-токен для массива зарегистрированных движков (`conversion.module.ts`). */
export const CONVERSION_ENGINES = Symbol('CONVERSION_ENGINES');
