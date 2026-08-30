import { z } from 'zod';

import { MIN_PASSWORD_LENGTH } from '../constants/limits.js';

/**
 * Спека 007. `email` нормализуется (нижний регистр) на сервере, не здесь —
 * схема только проверяет форму. Пароль ограничен снизу: настоящая политика
 * задаётся тут же, `MIN_PASSWORD_LENGTH`, и клиент, и сервер читают одно
 * число.
 */
export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * Пароль здесь БЕЗ `.min(MIN_PASSWORD_LENGTH)` намеренно: короткий пароль
 * при входе — то же самое «неверный email или пароль» (AUTH-RULES.md §2),
 * не отдельная ошибка валидации формы. Разная схема на регистрации и входе
 * — не дублирование одной и той же проверки, а две разные проверки.
 */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Общая форма пользователя в ответах `register`/`login`/`refresh`/`me`. */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/** Тело `register`/`login`/`refresh` — refresh-токен уходит только в cookie, не сюда. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Спека 009. Ответ на этот запрос одинаков независимо от результата — сама схема этого не выражает, только форму входа. */
export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

/** Спека 009. `token` — сырое значение из `/reset-password/:token`, не хеш. */
export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/**
 * Спека 009. `currentPassword` без `.min(MIN_PASSWORD_LENGTH)` — та же причина,
 * что у `loginRequestSchema`: неверный текущий пароль это `INVALID_CREDENTIALS`,
 * не ошибка формата.
 */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
