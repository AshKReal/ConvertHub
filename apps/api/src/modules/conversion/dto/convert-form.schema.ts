import { z } from 'zod';
import { convertRequestSchema } from '@convert-hub/shared';

/**
 * multer парсит все текстовые поля формы как строки (`req.body[field]`).
 * `convertRequestSchema` из `packages/shared` описывает логическую форму
 * запроса, не то, что реально приходит по проводу — это единственное место,
 * где известен квирк multipart; сама Zod-схема из `shared` не меняется
 * и не дублируется.
 */
function toConvertRequestCandidate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return raw;
  }

  const body = raw as Record<string, unknown>;
  const candidate: Record<string, unknown> = { ...body };

  if (typeof body.save === 'string') {
    candidate.save = body.save === 'true';
  }

  if (typeof body.quality === 'string') {
    // Нечисловая строка станет NaN — z.number() её и так отклонит как невалидную.
    candidate.quality = Number(body.quality);
  }

  return candidate;
}

export const convertFormSchema = z.preprocess(
  toConvertRequestCandidate,
  convertRequestSchema,
);
