import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppException } from '../exceptions/app.exception';

/**
 * Валидация только через Zod-схемы из `packages/shared` (`.claude/rules/backend.md`) —
 * не `class-validator`. Общий паттерн, не только для 002: любой контроллер,
 * которому нужна валидация тела/полей запроса, использует этот же пайп.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.');
      throw new AppException(
        'INVALID_PARAMETER',
        field === undefined ? undefined : { field },
      );
    }
    return result.data;
  }
}
