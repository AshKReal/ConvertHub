import { createHmac } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Общая для подписи (`LocalDiskStorage.getSignedUrl`) и проверки
 * (`local-disk-raw.controller.ts`) конструкция — оба места обязаны считать
 * подпись одинаково байт в байт, иначе валидная ссылка перестанет проходить
 * проверку. `expires` — часть подписываемых данных, не отдельное поле:
 * иначе TTL можно продлить, не трогая подпись (спека 003, 🔒).
 */
export function computeSignedUrlSignature(
  key: string,
  expires: number,
): string {
  return createHmac('sha256', env.SIGNED_URL_SECRET)
    .update(`${key}.${expires}`)
    .digest('hex');
}
