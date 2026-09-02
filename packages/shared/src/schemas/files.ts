import { z } from 'zod';

/**
 * Спека 010. Курсор — `id` (ULID, лексикографически сортируемый), не номер
 * страницы: вставки между запросами не сдвигают уже выданные страницы
 * (`ARCHITECTURE.md`, `WHERE id < :cursor ORDER BY id DESC`).
 */
export const listFilesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;

/** `saved` — `expiresAt === null` на сервере, не отдельное поле в БД. */
export const fileListItemSchema = z.object({
  id: z.string(),
  originalFilename: z.string().nullable(),
  sizeBytes: z.number(),
  extension: z.string(),
  createdAt: z.string(),
  saved: z.boolean(),
});

export type FileListItem = z.infer<typeof fileListItemSchema>;

export const listFilesResponseSchema = z.object({
  items: z.array(fileListItemSchema),
  nextCursor: z.string().nullable(),
});

export type ListFilesResponse = z.infer<typeof listFilesResponseSchema>;

/** `PATCH /v1/files/:id` — тумблер `save` на уже существующем файле. */
export const updateFileRequestSchema = z.object({
  save: z.boolean(),
});

export type UpdateFileRequest = z.infer<typeof updateFileRequestSchema>;
