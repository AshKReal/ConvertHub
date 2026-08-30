import 'dotenv/config';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Юнит-тесты (`src/**\/*.spec.ts`) — мокнутые провайдеры, без реальной БД.
 * E2E — отдельный `vitest.config.e2e.ts`, не сюда (`test/**\/*.e2e-spec.ts`).
 *
 * `import 'dotenv/config'` выше, до всего остального — `config/env.ts`
 * парсит `process.env` целиком на этапе импорта модуля (приложение падает
 * на старте, а не на первом запросе, `AUTH-RULES.md` §2); любой юнит-тест,
 * который транзитивно тянет `env.ts` (даже ради одного `JWT_SECRET`), иначе
 * упал бы на отсутствии остальных обязательных переменных. Тот же `.env`,
 * что использует `pnpm dev:api` — не отдельный тестовый набор секретов.
 *
 * Vitest не умеет `emitDecoratorMetadata` через свой дефолтный esbuild-
 * транспайлер — NestJS держится на декораторах (DI, `@Injectable`,
 * `@Controller`), `unplugin-swc` — официальный рецепт NestJS
 * (docs.nestjs.com/recipes/swc), `.swcrc` рядом задаёт те же настройки,
 * что `legacyDecorator`/`decoratorMetadata` требуют.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
