import type { ApiKey, ApiKeyEnvironment } from '../model/api-key';

const MASK_SUFFIX = '••••••••';

export function maskedDisplay(maskedPrefix: string): string {
  return `${maskedPrefix}${MASK_SUFFIX}`;
}

/**
 * Не крипто-стойкая генерация — это витрина, не секрет. Реальный ключ и его
 * SHA-256 хеш появляются на бэкенде в 011 (`crypto.randomBytes`).
 */
function randomSegment(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
    '',
  );
}

export function generateApiKey(environment: ApiKeyEnvironment): {
  fullValue: string;
  maskedPrefix: string;
} {
  const maskedPrefix = `ch_${environment}_${randomSegment(4)}`;
  const fullValue = `${maskedPrefix}${randomSegment(28)}`;
  return { fullValue, maskedPrefix };
}

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

export const MOCK_API_KEYS: readonly ApiKey[] = [
  {
    id: 'key-003',
    environment: 'live',
    maskedPrefix: 'ch_live_a1b2',
    createdAt: new Date(now - 30 * DAY_MS).toISOString(),
    lastUsedAt: new Date(now - 1 * DAY_MS).toISOString(),
  },
  {
    id: 'key-002',
    environment: 'live',
    maskedPrefix: 'ch_live_p9x2',
    createdAt: new Date(now - 10 * DAY_MS).toISOString(),
    lastUsedAt: null,
  },
  {
    id: 'key-001',
    environment: 'test',
    maskedPrefix: 'ch_test_q7m4',
    createdAt: new Date(now - 3 * DAY_MS).toISOString(),
    lastUsedAt: new Date(now - 3 * DAY_MS).toISOString(),
  },
];
