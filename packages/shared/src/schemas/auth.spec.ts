import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH } from '../constants/limits.js';
import { loginRequestSchema, registerRequestSchema } from './auth.js';

describe('registerRequestSchema', () => {
  it('accepts a valid email and a password at the minimum length', () => {
    const result = registerRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than MIN_PASSWORD_LENGTH', () => {
    const result = registerRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = registerRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH),
    });
    expect(result.success).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  // AUTH-RULES.md §2: короткий пароль при входе — то же "неверный email или
  // пароль", не отдельная ошибка валидации формы (docs/auth.ts). Схема это
  // не проверяет сама, только форму входа — namespace-разница с registerRequestSchema
  // должна остаться настоящей, не случайно схлопнуться при рефакторинге.
  it('accepts a password shorter than MIN_PASSWORD_LENGTH, unlike registerRequestSchema', () => {
    const result = loginRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'a',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginRequestSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
