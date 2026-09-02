import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Спека 015. Браузерный e2e-минимум (`ARCHITECTURE.md` §11): гость
 * конвертирует, вошедший видит файл, файл > 10 МБ отклоняется, при полной
 * квоте файл не сохраняется.
 *
 * Стек поднимает сам Playwright (`webServer`): API на `convert_hub_test`
 * (та же БД, что e2e-слой `apps/api` — Playwright-сценарии создают и убирают
 * своих `e2e-pw-*` пользователей), `ng serve` для фронта.
 *
 * `apps/api` API-сервер здесь НЕ переиспользует уже запущенный: локальный
 * `pnpm dev:api` смотрит в dev-БД `convert_hub`, а `e2e-db.mjs` (сидинг
 * квоты, уборка) — в тестовую; их нельзя расходить. Перед `pnpm --filter
 * web e2e` останови `pnpm dev:api` (Playwright иначе явно сообщит про
 * занятый порт 3000).
 */
const repoRoot = resolve(__dirname, '..', '..');

const testDatabaseUrl = readEnv(
  resolve(repoRoot, 'apps', 'api', '.env'),
  'TEST_DATABASE_URL',
);

// Читает e2e-db.mjs (сидинг квоты / уборка) — та же БД, что API ниже.
process.env.E2E_DATABASE_URL = testDatabaseUrl;

// `localhost`, не `127.0.0.1`: `CORS_ORIGIN` API по умолчанию
// `http://localhost:4200` (`apps/api/.env.example`) — Origin браузера обязан
// совпадать буквально, иначе все запросы к API рубит CORS.
const API_URL = 'http://localhost:3000';
const WEB_URL = 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api exec nest start',
      url: `${API_URL}/health`,
      cwd: repoRoot,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DATABASE_URL: testDatabaseUrl },
    },
    {
      command: 'pnpm --filter web exec ng serve --host localhost --port 4200',
      url: WEB_URL,
      cwd: repoRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});

function readEnv(path: string, key: string): string {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `${path} not found — copy apps/api/.env.example and set ${key} (docs/SETUP.md).`,
    );
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && match[1] === key) {
      return match[2].replace(/^["']|["']$/g, '');
    }
  }
  throw new Error(`${key} is not set in ${path} (docs/SETUP.md, раздел «Тесты»).`);
}
