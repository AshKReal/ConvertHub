# apps/api

Бэкенд ConvertHub: NestJS 11, Prisma, PostgreSQL, Redis. Конвертация, аутентификация, файлы и квоты,
публичное API по ключу.

Общее описание проекта и быстрый старт — [корневой README](../../README.md). Локальный запуск и переменные
окружения — [docs/SETUP.md](../../docs/SETUP.md).

## Команды

```bash
pnpm dev:api                       # из корня репозитория; http://localhost:3000
pnpm --filter api build            # nest build → dist/src/main.js
pnpm --filter api typecheck
pnpm --filter api test             # юнит, внешние сервисы не нужны
pnpm --filter api test:e2e         # против реальной convert_hub_test
pnpm --filter api db:migrate       # prisma migrate dev
pnpm --filter api db:migrate:test  # миграции тестовой БД
pnpm --filter api db:generate      # prisma generate
```

`lint` здесь запускается с `--fix` и правит исходники — после него стоит перечитать дифф.

## Что важно знать до правок

- Конфигурация — `src/config/env.ts`: Zod-схема разбирает `process.env` при импорте, поэтому неверное
  значение роняет процесс на старте, а не на первом запросе. `@nestjs/config` не используется.
- Схема Prisma лежит нестандартно — `src/prisma/schema.prisma` (путь объявлен в `package.json`).
- Точка входа собирается в `dist/src/main.js`, не `dist/main.js`: рядом с `src` лежат `vitest.config.ts`,
  из-за чего `tsc` выводит `rootDir` в корень пакета.
- Валидация только Zod-схемами из `packages/shared`; DTO-классов и `class-validator` здесь нет.
- Репозиториев поверх Prisma нет — Prisma Client уже репозиторий.
- Абстракций ровно две: `Storage` и `ConversionEngine`.

Критичные зоны (`modules/auth/**`, `modules/api-keys/**`, `modules/conversion/validators/**`,
`modules/files/**`, `modules/storage/**`) правятся по отдельным правилам — см.
[AUTH-RULES.md](../../AUTH-RULES.md) и `.claude/rules/critical-zones.md`.

## Эндпоинты вне `/v1`

`GET /health` — живость, всегда `200`. `GET /ready` — готовность, проверяет Postgres, Redis и (в режиме `s3`)
бакет; `503`, если БД недоступна. `GET /metrics` — Prometheus, за `Authorization: Bearer $METRICS_TOKEN`.
