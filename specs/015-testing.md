# 015 — testing (частично)

| | |
|---|---|
| Статус | `~` — первый проход (раннер во всех трёх пакетах + e2e-слой `apps/api`) сделан; второй проход (реальное покрытие: 🔒-валидаторы, автомат зоны загрузки, квота, Playwright) — план ниже, код в ветке `015-testing` от `main` |
| Зависит от | 005, 007 |
| Источник | Прил. А ТЗ, этап 10 |
| Критичность | не 🔒 (инфраструктура, не бизнес-логика auth/conversion) |

## Задача

В проекте не было ни одного теста — только `pnpm typecheck`/`pnpm lint`. Весь сеанс 007–009 проверялся вручную
curl'ом, прямыми SQL-запросами и одноразовыми Playwright-скриптами: рабочий способ, но не остающийся в
репозитории как регрессионная защита и требующий заново собираться каждую сессию. Задача этого прохода — не
покрыть тестами существующие фичи (это отдельная, много большая работа), а завести реальный, работающий раннер
во всех трёх пакетах монорепы с одним настоящим тестом на пакет, доказывающим, что сборка/декораторы/workspace-
резолюция реально работают.

## Решение владельца — три вопроса в этой сессии, `AskUserQuestion`

1. **Для `apps/api` — юнит и e2e сразу**, не только юнит. E2E (Vitest + supertest поверх реального Postgres) —
   продолжение того же принципа, что управляло всей ручной проверкой 007–009: реальный HTTP-вызов к реальной БД
   ловит то, что юнит-тест с мокнутым Prisma не поймает (пример из этого же сеанса — баг `SMTP_SECURE`/
   `z.coerce.boolean()`, найденный только реальным вызовом, не тайпчеком).
2. **Тестовая БД — вторая база `convert_hub_test` на уже существующем контейнере Postgres, не Testcontainers.**
   `SPECS.md` изначально называл именно Testcontainers для будущей 015 — реальное, осознанное отклонение от
   реестра, не молчаливое: проще, без Docker-in-Docker сложности на CI, тот же образ/версия, что dev.
3. **Коммиты — прямо в `backend`, без отдельной ветки/PR.** Явное решение владельца, против моей рекомендации
   (указал, что это отступает от «одна фича — одна ветка — один PR», которому 007–009 следовали строго).

## Решение владельца — второй проход, 2026-09-02

Четыре вопроса перед возобновлением 015 (`AskUserQuestion`, ответы владельца):

1. **TECH-SPEC §15 (тест-кейсы 🔒-зон пишет владелец, не автор реализации) — принято как оверхед для
   pet-проекта.** Валидаторы (002) и квоту (010) писал агент; в этом проходе он же пишет и их покрытие.
   Осознанное отступление от §15, зафиксировано здесь, не молчком.
2. **Playwright возвращается в объём 015.** В первом проходе был отложен; `tasks.md` держал его в 015 —
   теперь делается.
3. **Строки про Testcontainers в `ARCHITECTURE.md` §11 и `TECH-SPEC.md` §3 правятся в рамках долга
   «После мержа» этой спеки**, не отдельной веткой доков.
4. **E2E-стек (Playwright + `apps/api` e2e) поднимается в GitHub Actions**, не остаётся ручным: job
   поднимает `docker compose up -d postgres redis`, миграции, `dev:api` + `dev:web`, гоняет Playwright.

Ветка — `015-testing` от `main` (бэкенд-фаза уже влита в `main` мерж-коммитом `1b0195e`), PR в `main`.

## Входит

- Vitest как единый раннер во всех трёх пакетах (`packages/shared`, `apps/api`, `apps/web`) — не Jest: текущий
  официальный рецепт NestJS (`unplugin-swc` для декораторов) и текущий официальный билдер Angular CLI
  (`@angular/build:unit-test`, сам вызывает Vitest) оба сошлись на нём независимо
- `apps/api`: юнит (мокнутые провайдеры) + e2e (`supertest` поверх настоящего `AppModule` и `convert_hub_test`)
- По одному тесту-доказательству на пакет — не исчерпывающее покрытие, а подтверждение, что раннер реально
  собирает и гоняет проект (декораторы транспилируются, DI резолвится, jsdom рендерит, workspace-импорты
  резолвятся)
- Починка мёртвого `test`-target в `apps/web/angular.json` (`@angular/build:karma` ссылался на несуществующий
  `tsconfig.spec.json`, самого `karma` не было в зависимостях — `ng test` падал бы прямо сейчас)
- `pnpm test`/`pnpm test:e2e` с корня — тот же паттерн, что `pnpm typecheck`/`pnpm lint`

## Не входит

| Что | Где будет |
|---|---|
| Исчерпывающее покрытие всего кода — каждая ветка каждого сервиса | Не цель и второго прохода: он берёт 🔒-валидаторы, автомат зоны загрузки, pipes, расчёт квоты и обязательный e2e-минимум, не «100% строк» |
| Testcontainers | Сознательно заменён второй БД на существующем контейнере Postgres (решение владельца) — e2e-слой `apps/api` уже проверяет транзакции и миграции на настоящем PostgreSQL |
| Юнит-тест транзакционной атомарности `FilesService` (rollback между `file.create` и `user.update`) | e2e-слой — на моке Prisma это не проверяется честно; юнит берёт только чистое решение «квота превышена / нет» |
| Нагрузочные тесты, тесты производительности | Вне 015 целиком; условия перехода на нагрузочный профиль — `TECH-SPEC.md` §4 |

**Первый проход (сделано) — `## Что сделано` ниже. Второй проход (план) — `## План — оставшийся объём` ниже.**

## Что сделано

### `packages/shared`
Чистый TS/Zod, без декораторов — `vitest.config.ts` без плагинов. Тест: `schemas/auth.spec.ts` (границы
`registerRequestSchema`/`loginRequestSchema`, включая задокументированную разницу между ними — короткий пароль
при входе не отклоняется схемой, `AUTH-RULES.md` §2).

### `apps/api`
`.swcrc` + `unplugin-swc` (официальный рецепт `docs.nestjs.com/recipes/swc`) — Vitest не умеет
`emitDecoratorMetadata` через дефолтный esbuild-транспайлер, а NestJS держится на декораторах. `vitest.config.ts`
(юнит) грузит `apps/api/.env` до всего остального — `config/env.ts` парсит `process.env` целиком на импорте.

Юнит-тесты: `token.service.spec.ts` (DI, `Test.createTestingModule`) — JWT sign/verify round-trip,
`generateOpaqueToken`/`hashOpaqueToken`; `hash-ip.spec.ts` (без DI) — чистая функция.

E2E: вторая БД `convert_hub_test` на контейнере `postgres` из `docker-compose.yml` (`docker/postgres-init/`
создаёт её на свежем volume; на уже существующем — вручную один раз). `TEST_DATABASE_URL` — не через
Zod-схему `env.ts` (тестовая инфраструктура, не рантайм-конфиг), подменяет `DATABASE_URL` в
`test/setup-e2e.ts` до импорта Prisma. `apps/api/scripts/migrate-test-db.mjs` — кроссплатформенный хелпер
(`pnpm --filter api db:migrate:test`), ручной шаг, как обычный `db:migrate`. Очистка между тестами — явная
(`test/utils/test-db.ts#cleanupUser`), не глобальный rollback транзакций. Тест: `test/auth.e2e-spec.ts` —
`POST /register` → `200`+`accessToken`+`Set-Cookie`; повтор email → `409`; `GET /me` без токена → `401`.

### `apps/web`
Старый `test`-target в `angular.json` был мёртвым (см. «Входит»). Заменён на `@angular/build:unit-test`;
`ng generate config vitest` (официальный генератор) создал `vitest-base.config.ts`; `tsconfig.spec.json`
написан по стандартному шаблону Angular CLI (билдер по умолчанию его ждёт). Тест: `theme.spec.ts` (`TestBed`,
jsdom) — `ThemeService.toggle()`/`setTheme()`/чтение уже применённого класса на `<html>`.

### Корень
`pnpm test` (юнит всех трёх пакетов, безопасно всегда) / `pnpm test:e2e` (сейчас только `apps/api`, требует
`docker compose up -d postgres`) — тот же паттерн, что `typecheck`/`lint`. `docs/SETUP.md` — новый раздел
«Тесты» с разовой настройкой `convert_hub_test`.

---

## План — оставшийся объём (2026-09-02)

### Подход

Раннер есть — писать только тесты. Порядок задан приоритетом из `REVIEW-FINDINGS.md` («015 — юнит хотя бы
на 🔒-валидаторы и автомат зоны загрузки до того, как список начнут разгребать»): сначала места, где ошибка
не падает, а открывает дыру, потом остальное, потом браузерный e2e-минимум.

Юнит — там, где логика чистая или сводится к одному-двум мокнутым провайдерам. Всё, что по-настоящему
зависит от БД (атомарность транзакций квоты, курсорная пагинация на реальных строках), остаётся за
e2e-слоем `apps/api` — он уже есть и бьёт по настоящему Postgres.

### Затрагиваемые файлы

Новый код — только тесты, фикстуры, конфиги; продакшен-код `apps/api/src` / `apps/web/src` не трогаем.

- `apps/api/src/modules/conversion/validators/conversion-direction.validator.spec.ts`
- `apps/api/src/modules/conversion/validators/magic-bytes.validator.spec.ts`
- `apps/api/src/modules/conversion/validators/pdf-page-count.validator.spec.ts`
- `apps/api/src/modules/conversion/validators/pixel-count.validator.spec.ts`
- `apps/api/src/common/pipes/zod-validation.pipe.spec.ts`
- `apps/api/src/modules/conversion/dto/convert-form.schema.spec.ts`
- `apps/api/src/modules/files/files.service.quota.spec.ts` — только ветка «квота превышена», мок Prisma + Storage
- `apps/api/test/fixtures/` — маленькие настоящие файлы: `sample.jpg`, `sample.png`, `sample.pdf` (1 стр),
  `exactly-50.pdf`, `many-pages.pdf` (51 стр), `sample.docx`, `not-an-image.txt`,
  `huge-dimensions.png` (большой IHDR, крошечные данные), `encrypted.pdf` + `README.md` (чем сгенерён каждый)
- `apps/api/test/quota.e2e-spec.ts` — `POST /v1/convert` вошедшим: под квотой → `saved`; ровно на границе;
  +1 байт → `X-Save-Skipped-Reason: quota-full` и файла нет в `GET /v1/files`; тумблер `PATCH /v1/files/{id}`
- `apps/web/src/app/features/convert/components/dropzone/dropzone.spec.ts` — `TestBed`, стабы
  `injectConvertApi` / `AuthService` / `injectMeQuery` / `ToastService` / `I18nService`
- `apps/web/src/app/core/i18n/format.spec.ts` — `formatBytes` / `formatDate`, границы и локали
- `apps/web/e2e/` — `playwright.config.ts`, `guest-convert.spec.ts`, `user-convert.spec.ts`,
  `oversize-rejected.spec.ts`, `quota-full.spec.ts`
- `apps/web/package.json` — dev-зависимость `@playwright/test`, скрипт `e2e`
- `.github/workflows/ci.yml` — job `e2e` (docker compose + миграции + dev-серверы + Playwright + `api` e2e)
- корневой `package.json` — `pnpm e2e` / расширение `test:e2e` на `apps/web`
- `docs/SETUP.md` — раздел «Тесты»: как гонять Playwright локально
- долг «После мержа»: `specs/015-testing.md`, `SPECS.md`, `tasks.md`, `AI-JOURNAL.md`, `TECH-SPEC.md` §3,
  `ARCHITECTURE.md` §11

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| Юнит-тест `FilesService` целиком на моке Prisma, включая `$transaction` | Мок транзакции не проверяет атомарность — тест зелёный и при неверном коде; §15: закодировал бы то же непонимание | Никогда для транзакций — это работа e2e-слоя |
| Генерировать фикстуры-файлы в рантайме теста (собирать байты PDF/PNG из строк) | `detectFileType` / `pdf-lib` / `sharp` читают настоящую структуру; синтетические байты проверяли бы парсер фикстур, не валидатор | — |
| Playwright против собранного прод-бандла на статике | Дольше в CI, для этих 4 сценариев ничего сверх dev не ловит, отладка локально сложнее | Сценарии, чувствительные к прод-сборке (SSR, lazy-чанки) |
| `karma` / `jasmine` для `apps/web` e2e | Karma выпилена первым проходом; два раннера в одном пакете | — |

### Риски и границы транзакций

- **Тесты пишет автор реализации** (§15) — принято владельцем как оверхед, риск реальный: зелёный тест
  здесь не равен «валидатор верен». Смягчение — покрывать наблюдаемое поведение по кодам ошибок из
  `packages/shared`, не внутреннюю форму.
- Фикстура `huge-dimensions.png` должна реально иметь `width*height > MAX_IMAGE_PIXELS` в IHDR при паре КБ
  на диске. Проверить руками, что `sharp().metadata()` возвращает заявленные размеры, иначе тест бьёт не по
  тому пути.
- `encrypted.pdf`: `pdf-lib` на зашифрованном бросает, текущий код ловит это в общий `FILE_CORRUPTED` —
  отдельного `FILE_PASSWORD_PROTECTED` в валидаторе нет (он в движке 005). Тест фиксирует фактическое
  поведение (`FILE_CORRUPTED`), расхождение отметить, не «чинить» под тест.
- Playwright в CI — стек из трёх процессов (`postgres`/`redis`, `dev:api`, `dev:web`), флейки по таймингу
  старта. `webServer` в конфиге с ожиданием `/health` и `:4200`.
- `quota.e2e-spec.ts` создаёт пользователя у самой границы квоты — уборка обязательна
  (`test/utils/test-db.ts#cleanupUser`), как в `auth.e2e-spec.ts`.

### Мои тест-кейсы

**Пишет автор реализации — см. риск выше.** Проза, не код.

*Валидаторы:*
- `assertSupportedDirection`: `undefined` → `UNSUPPORTED_FILE_TYPE`; mime вне белого списка (`image/gif`) →
  `UNSUPPORTED_FILE_TYPE`; `image/png` + `target=jpg` — ок; `image/png` + `target=pdf` → `FILE_TYPE_MISMATCH`;
  `image/jpeg` + `target=png` → направление `jpg-to-png`
- `detectFileType`: `sample.jpg` → `image/jpeg`; тот же файл, переименованный в `.png`, — всё равно
  `image/jpeg`; `not-an-image.txt` → `undefined`; `sample.docx` → зафиксировать фактический mime
- `assertPdfPageLimit`: `sample.pdf` (1) — без исключения; `exactly-50.pdf` — без исключения;
  `many-pages.pdf` (51) → `TOO_MANY_PAGES`, `actual_pages: 51`; случайные байты → `FILE_CORRUPTED`;
  пустой буфер → `FILE_CORRUPTED`
- `assertWithinPixelLimit`: `sample.png` — без исключения; фикстура ровно `MAX_IMAGE_PIXELS` — без
  исключения; `huge-dimensions.png` → `IMAGE_TOO_LARGE`, `actual_pixels`; `not-an-image.txt` → `FILE_CORRUPTED`

*Pipe / схема формы:*
- `ZodValidationPipe`: валидный объект проходит типизированным; битое поле → `INVALID_PARAMETER` с
  `meta.field` = имя первого битого поля; скалярный вход с пустым `path` → `INVALID_PARAMETER` без
  `meta.field` (не `field: ""`)
- `convertFormSchema`: `save:"true"` → `true`; `save:"false"` → `false`; `quality:"80"` → `80`;
  `quality:"abc"` → отказ (NaN); `target` отсутствует → отказ

*Квота (юнит, мок Prisma):*
- `storageUsedBytes` + размер == квота ровно → сохраняем (не `skipped-quota`)
- +1 байт сверх → `{ status: 'skipped-quota' }`, `storage.put` не вызван
- `userId: null` (гость) → ветка квоты не выполняется

*Квота (e2e, реальная БД):*
- пользователь за 100 байт до квоты конвертирует, результат 50 байт → `200`, файл в `GET /v1/files`,
  `storageUsedBytes` вырос
- следующий файл, результат 200 байт → `200` + `X-Save-Skipped-Reason: quota-full`, нового файла в списке
  нет, `storageUsedBytes` не изменился
- `PATCH /v1/files/{id}` `save=false` → квота освободилась; `save=true` обратно → занята снова;
  `save=true` когда квота полна другими → `STORAGE_QUOTA_EXCEEDED`

*Автомат зоны загрузки (`Dropzone`, TestBed):*
- старт: `meQuery` пуст → `empty`; `storageUsedBytes >= квоты` → `quotaFull`
- `dragenter` ×2, `dragleave` ×1 → всё ещё `dragover`; ещё `dragleave` → `empty`; `dragleave` на нуле не
  уводит счётчик в минус
- `select` с файлом > `MAX_FILE_SIZE_BYTES` → `error` (`code: FILE_TOO_LARGE`), файл не принят
- `select` в `converting` / `done` игнорируется
- `error` перекрывает всё: `error` выставлен + есть файл → `state().kind === 'error'`
- `clear()` из любого состояния → `empty`, picker обнулён
- `markUploadDone` из `converting` (не `uploading`) — no-op

*`formatBytes` / `formatDate`:*
- `0` → «0 байт» / «0 B» по локали; `1023` → байты; `1024` → «1 КБ»; `MEGABYTE-1` → КБ целое;
  `MEGABYTE` → «1,0 МБ»; `300*MEGABYTE` → «300,0 МБ»
- одна величина в `ru` / `uk` / `en` — разный разделитель/юнит, число совпадает
- `formatDate('2026-09-02','ru')` — зафиксировать фактический вывод `Intl`

*Playwright (e2e-минимум `ARCHITECTURE.md` §11):*
- гость на `/convert/jpg-to-png` кидает `sample.jpg`, жмёт «Начать», дожидается `done`, «Скачать» отдаёт
  непустой blob
- пользователь логинится, конвертирует с дефолтным `save`, в `/files` видит только что сконвертированный файл
- гость выбирает файл > 10 МБ → зона в `error` с текстом про размер, запрос не уходит (перехват сети)
- пользователь у полной квоты конвертирует → результат скачивается, но в `/files` файла нет, тост про квоту

### Чек-лист — второй проход

- [x] Фикстуры `apps/api/test/fixtures/` + `README.md` + `generate.mjs` + `.gitattributes`
- [x] `conversion-direction.validator.spec.ts`
- [x] `magic-bytes.validator.spec.ts`
- [x] `pdf-page-count.validator.spec.ts`
- [x] `pixel-count.validator.spec.ts`
- [x] `zod-validation.pipe.spec.ts`
- [x] `convert-form.schema.spec.ts`
- [x] `files.service.quota.spec.ts`
- [x] `quota.e2e-spec.ts`
- [x] `dropzone.spec.ts` (TestBed + HttpTestingController; `quotaFull` — за e2e, `vi.mock` относительных путей Angular-раннер запрещает)
- [x] `format.spec.ts`
- [x] Playwright: `playwright.config.ts` + `@playwright/test` + `webServer` (API на `convert_hub_test`, `ng serve`) + `tsconfig.e2e.json` + `e2e-db.mjs`
- [x] 4 Playwright-спеки (`guest-convert`, `user-convert`, `oversize-rejected`, `quota-full`)
- [x] `ci.yml`: job `e2e` (postgres+redis, обе БД+миграции, `playwright install`, `api test:e2e` + `web e2e` + `e2e:typecheck`)
- [x] `docs/SETUP.md` — раздел Playwright
- [x] `pnpm test` с корня зелёный без Docker (shared 5 / api 47 / web 19)
- [x] `pnpm typecheck` / `pnpm lint` зелёные (`apps/web/e2e/` в охвате через `tsconfig.e2e.json`)

### Приёмка — второй проход

- [x] Тест-кейсы прогнаны; красный→зелёный проверен (сломать `assertPdfPageLimit` порог — `pdf-page-count.validator.spec.ts` падает, вернуть — зелёный)
- [x] `pnpm test` + `pnpm test:e2e` (6/6) + Playwright (4/4) зелёные локально; dev-БД `convert_hub` не тронута
- [ ] CI job `e2e` зелёный на PR
- [ ] Враждебное второе мнение: новый чат, только тесты, без плана
- [x] `git diff` — только `*.spec.ts` / фикстуры / конфиги / `e2e/` / доки, ноль строк продакшен-кода `apps/*/src` вне `.spec.ts`

### После мержа — второй проход

- [x] `TECH-SPEC.md` §3 (строка стека) + §14 (абзац про Testcontainers) → «Vitest (юнит + e2e-слой), Playwright», вторая БД вместо Testcontainers
- [x] `ARCHITECTURE.md` §11: таблица уровней и абзац «Testcontainers, а не in-memory» → вторая БД на общем контейнере
- [x] `SPECS.md` реестр: 015 → `✓`
- [x] `tasks.md`: галочки стадии 9 / 015
- [x] `AI-JOURNAL.md`: запись 2026-09-02 — §15 (тесты пишет автор реализации), ложно-зелёный `guest-convert`, `vi.mock` в Angular-раннере, `ci.yml` вне очереди (`a074ba0`)

## Проверка

- [x] `pnpm test` с корня — юнит-тесты всех трёх пакетов зелёные (20/20), без поднятого Docker
- [x] `pnpm --filter api test:e2e` — 3/3 зелёных против настоящей `convert_hub_test`
- [x] Руками сверено `docker compose exec postgres psql` до/после — тестовые строки реально появляются и
  удаляются в `convert_hub_test`, `convert_hub` (dev) не тронута ни разу
- [x] `pnpm --filter api build`/`pnpm --filter web build` — продакшен-сборки не подхватывают `*.spec.ts`/`test/`
- [x] `pnpm typecheck`/`pnpm lint` зелёные, включая расширенный охват (`apps/web` typecheck теперь проверяет и
  `tsconfig.spec.json`, `apps/api` lint — и `test/`, раньше не проверялись вообще)

### Приёмка

Первый проход (раннер) — приёмка отдельно не проводилась, свёрнута во второй проход. Актуальные разделы —
**«Приёмка — второй проход»** и **«После мержа — второй проход»** выше.

- [x] Решения-долгожители (Vitest вместо Jest, вторая БД вместо Testcontainers) перенесены в `TECH-SPEC.md` §3/§14, `ARCHITECTURE.md` §11
- [x] Статус в реестре обновлён (`✓`)
