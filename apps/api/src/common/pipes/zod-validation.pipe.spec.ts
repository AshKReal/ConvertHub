import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ErrorCode } from '@convert-hub/shared';

import { AppException } from '../exceptions/app.exception';
import { ZodValidationPipe } from './zod-validation.pipe';

const bodyOf = (thrown: unknown): { code: string; meta?: unknown } => {
  expect(thrown).toBeInstanceOf(AppException);
  return (thrown as AppException).getResponse() as {
    code: string;
    meta?: unknown;
  };
};

const runAndCatch = (
  pipe: { transform: (v: unknown) => unknown },
  value: unknown,
): unknown => {
  try {
    pipe.transform(value);
  } catch (error) {
    return error;
  }
  throw new Error('expected transform to throw');
};

describe('ZodValidationPipe', () => {
  it('returns the parsed value on success', () => {
    const pipe = new ZodValidationPipe(
      z.object({ email: z.string().email(), age: z.number() }),
    );
    expect(pipe.transform({ email: 'user@example.com', age: 30 })).toEqual({
      email: 'user@example.com',
      age: 30,
    });
  });

  it('throws INVALID_PARAMETER (422) with meta.field for a bad object field', () => {
    const pipe = new ZodValidationPipe(z.object({ email: z.string().email() }));
    const thrown = runAndCatch(pipe, { email: 'not-an-email' });

    expect(bodyOf(thrown)).toEqual({
      code: 'INVALID_PARAMETER' satisfies ErrorCode,
      meta: { field: 'email' },
    });
    expect((thrown as AppException).getStatus()).toBe(422);
  });

  it('reports the dotted path of the first broken nested field', () => {
    const pipe = new ZodValidationPipe(
      z.object({ user: z.object({ age: z.number() }) }),
    );
    const thrown = runAndCatch(pipe, { user: { age: 'x' } });

    expect(bodyOf(thrown).meta).toEqual({ field: 'user.age' });
  });

  it('omits meta entirely for a scalar schema (empty path — no "field: \'\'")', () => {
    const pipe = new ZodValidationPipe(z.string().uuid());
    const thrown = runAndCatch(pipe, 'not-a-uuid');

    expect(bodyOf(thrown)).toEqual({
      code: 'INVALID_PARAMETER' satisfies ErrorCode,
    });
  });
});
