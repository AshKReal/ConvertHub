import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Спека 015 (частично). Отдельно от `vitest.config.ts` (юнит) — эти тесты
 * поднимают весь `AppModule` и бьют реальным HTTP по нему через `supertest`,
 * с реальным Postgres (`TEST_DATABASE_URL`, `test/setup-e2e.ts` подменяет
 * `DATABASE_URL` до импорта `env.ts`/Prisma). Сеть/БД медленнее мокнутых
 * юнитов — увеличенный `testTimeout`.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
    testTimeout: 15_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
