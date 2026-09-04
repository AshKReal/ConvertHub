import { z } from 'zod';

import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '../constants/limits.js';

/**
 * Спека 029. Имя и фамилия по отдельности. `trim` стоит ДО ограничений, иначе
 * строка из пробелов проходит `.min(1)`: Zod применяет проверки к результату
 * трансформации только в этом порядке.
 */
const personNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(MAX_NAME_LENGTH));

/**
 * Спека 007. `email` нормализуется (нижний регистр) на сервере, не здесь —
 * схема только проверяет форму. Пароль ограничен снизу: настоящая политика
 * задаётся тут же, `MIN_PASSWORD_LENGTH`, и клиент, и сервер читают одно
 * число.
 *
 * Спека 029 добавила имя и фамилию обязательными (решение владельца). В БД
 * колонки при этом nullable: у аккаунтов, созданных до 029, имени нет и
 * обратной засыпки не будет — обязательность относится к новой регистрации,
 * не к существующим строкам.
 */
export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  firstName: personNameSchema,
  lastName: personNameSchema,
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

/** Спека 008. Пока один провайдер (`AUTH-RULES.md` §5) — enum растёт, когда/если Telegram вернётся в план. */
export const oauthProviderSchema = z.enum(['google']);

export type OauthProvider = z.infer<typeof oauthProviderSchema>;

/**
 * Общая форма пользователя в ответах `register`/`login`/`refresh`/`me`.
 * `hasPassword`/`providers` — спека 008: для нативной регистрации (007)
 * тривиально `{hasPassword: true, providers: []}`, других способов входа
 * тогда ещё не существует.
 */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  hasPassword: z.boolean(),
  providers: z.array(oauthProviderSchema),
  /**
   * Спека 029. `null` — у аккаунта, созданного до неё: регистрация теперь
   * требует имя, но существующие строки не засыпаются. Интерфейс на этом и
   * строит показ — имя есть, показываем его, нет — email, как было до 029.
   */
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  /**
   * Спека 029. Подписанная ссылка, а не ключ в хранилище: `avatarKey` наружу
   * не отдаётся никогда. Ссылка живёт `SIGNED_URL_TTL_SECONDS`, поэтому она
   * пересобирается на каждый ответ и в БД не хранится. `null` — аватара нет.
   */
  avatarUrl: z.string().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Спека 029. Тело `PATCH /v1/auth/profile`. Email сюда не входит: он
 * идентификатор аккаунта и цель ссылки восстановления, маршрута для его смены
 * нет и не заводится (029, «Не входит»).
 */
export const updateProfileRequestSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/**
 * Спека 010. Тело `GET /v1/auth/me` — отдельная схема, не расширение самого
 * `authUserSchema`: `register`/`login`/`refresh` не обязаны знать актуальную
 * квоту на момент входа (снэпшот сессии), `GET /me` — намеренно живой
 * повторный запрос за свежими данными (`core/services/me.ts`, TanStack Query
 * `['me']`, apps/web).
 */
export const meResponseSchema = authUserSchema.extend({
  storageUsedBytes: z.number(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

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
