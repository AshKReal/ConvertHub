import type { ApiKeyListItem } from '@convert-hub/shared';

/**
 * Спека 011. Тип строки списка — из общего контракта (`packages/shared`),
 * мок-модель 022 удалена. Имя `ApiKey` сохранено, чтобы `key-row` не менял
 * ссылки на тип.
 */
export type ApiKey = ApiKeyListItem;

const MASK_SUFFIX = '••••••••';

/** Показ в списке: `ch_live_a1b2` + `••••••••`. Полное значение сервер не отдаёт (`TECH-SPEC.md` §8.4). */
export function maskedDisplay(maskedPrefix: string): string {
  return `${maskedPrefix}${MASK_SUFFIX}`;
}
