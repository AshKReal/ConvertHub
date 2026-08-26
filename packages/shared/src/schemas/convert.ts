import { z } from 'zod';

import { CONVERSION_TARGETS } from '../constants/formats';

/**
 * Поля `POST /v1/convert` кроме самого файла: он передаётся частью `multipart/form-data`
 * и Zod-схемой не описывается — на сервере его разбирает обработчик загрузки,
 * на клиенте он кладётся в `FormData` как есть (ARCHITECTURE.md §6.3).
 *
 * Контракт задан клиентом (спека 001), бэкенд подстраивается под него.
 */
export const convertRequestSchema = z.object({
  target: z.enum(CONVERSION_TARGETS),
  save: z.boolean().optional(),
  quality: z.number().int().min(60).max(100).optional(),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  dpi: z.union([z.literal(72), z.literal(150), z.literal(300)]).optional(),
});

export type ConvertRequest = z.infer<typeof convertRequestSchema>;
