# apps/web

Фронтенд ConvertHub: Angular 22, standalone-компоненты, сигналы, `OnPush`, Tailwind 4.

Общее описание проекта и быстрый старт — [корневой README](../../README.md). Локальный запуск и переменные
окружения — [docs/SETUP.md](../../docs/SETUP.md).

## Команды

```bash
pnpm dev:web                     # из корня репозитория; http://localhost:4200
pnpm --filter web build          # прод-сборка → apps/web/dist/web/browser
pnpm --filter web typecheck      # три проекта: app, spec, e2e
pnpm --filter web test           # юнит, Vitest через @angular/build:unit-test
pnpm --filter web e2e            # Playwright, нужен поднятый Postgres
pnpm --filter web lint
```

Тесты идут на **Vitest**, не Karma: она выпилена спекой 015. `vi.mock` для относительных импортов
Angular-раннер запрещает — зависимость подменяется через `TestBed` либо выносится параметром функции
(пример — `src/app/core/api-url.spec.ts`).

## Что важно знать до правок

- `NgModule` не используется. Компоненты standalone, `input()`/`output()` вместо декораторов, `OnPush`
  обязателен.
- Именование без суффиксов `.component`/`.service` — `dropzone.ts` / `class Dropzone`.
- Цвета, отступы, радиусы — только токены из [DESIGN.md](../../DESIGN.md), реализованные в `src/styles.css`.
  HEX в разметке запрещён; нужного значения нет — спросить, а не подобрать.
- Каждый экран проверяется в обеих темах: тёмная не выводится инверсией светлой.
- Стрелки зависимостей идут вниз: `features → shared → core`. Обратно и между фичами — нельзя.
- Компоненты не вызывают `HttpClient` напрямую, только через `data/*.api.ts` своей фичи, и работают с
  `AppError`, а не с сырым `HttpErrorResponse`.
- Серверные данные живут в TanStack Query и не копируются в сигналы; локальное состояние — `signal()`.

## Базовый URL API

`src/environments/environment.ts` — dev, API на отдельном origin (`http://localhost:3000`).
`environment.prod.ts` — прод, `apiUrl` **пуст**: фронт и API там на одном origin, `/v1/*` проксируется
Vercel на Railway. Прежде чем трогать это, прочитайте `src/app/core/api-url.ts` — пустая строка ломает
наивную проверку «наш ли это запрос».
