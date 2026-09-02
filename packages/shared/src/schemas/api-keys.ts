import { z } from 'zod';

/**
 * Спека 011. Признак окружения в формате ключа (`ch_live_`/`ch_test_`,
 * `TECH-SPEC.md` §7.1). Сейчас сервер выпускает только `live`; `test` —
 * под будущую песочницу с иными лимитами.
 */
export const apiKeyEnvironmentSchema = z.enum(['live', 'test']);

export type ApiKeyEnvironment = z.infer<typeof apiKeyEnvironmentSchema>;

/**
 * Строка списка `GET /v1/api-keys` — маскированный показ, без хеша и без
 * полного значения. `maskedPrefix` — первые 12 символов ключа (`ch_live_a1b2`),
 * клиент дорисовывает `••••••••`.
 */
export const apiKeyListItemSchema = z.object({
  id: z.string(),
  environment: apiKeyEnvironmentSchema,
  maskedPrefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type ApiKeyListItem = z.infer<typeof apiKeyListItemSchema>;

/** Без курсора — предел `MAX_ACTIVE_API_KEYS` активных ключей помещается на один экран. */
export const apiKeyListResponseSchema = z.object({
  items: z.array(apiKeyListItemSchema),
});

export type ApiKeyListResponse = z.infer<typeof apiKeyListResponseSchema>;

/**
 * Ответ `POST /v1/api-keys` и `POST /v1/api-keys/:id/reissue` — та же строка
 * плюс `fullValue`: единственный раз, когда полное значение покидает сервер.
 */
export const issuedApiKeySchema = apiKeyListItemSchema.extend({
  fullValue: z.string(),
});

export type IssuedApiKey = z.infer<typeof issuedApiKeySchema>;
