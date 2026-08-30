import 'dotenv/config';

// Спека 015 (частично). Подменяет DATABASE_URL до того, как что-либо
// импортирует config/env.ts/Prisma — Vitest гарантированно выполняет
// setupFiles раньше файлов тестов. Без TEST_DATABASE_URL падаем явно,
// а не тихо гоняем e2e-тесты (создание/удаление строк) против dev-БД.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set (apps/api/.env) — refusing to run e2e tests against the dev database.',
  );
}
process.env.DATABASE_URL = testDatabaseUrl;
