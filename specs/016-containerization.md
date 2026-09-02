# 016 — containerization

| | |
|---|---|
| Статус | черновик спеки + плана, код не начат |
| Зависит от | 005 (движки), 015 (тесты — CI job), 003/010 (`Storage`) |
| Источник | ТЗ п. 8.4, `TECH-SPEC.md` §3.1 (Cloudflare R2), §3.2 (замена `LocalDiskStorage` на `S3Storage`), §13, `ARCHITECTURE.md` §2 (граница 1/3), §10 |
| Критичность | обычная (правит `config/env.ts` и `storage.module.ts`, но не 🔒-код; проверочное свойство — `conversion.service.ts`/`files.service.ts` не тронуты) |

## Задача

Приложение работает, но развернуть его пока нечем: нет образа `apps/api`, а файлы всё ещё лежат на диске
процесса (`LocalDiskStorage`) — это ломается на втором экземпляре и теряется при пересоздании контейнера
(`ARCHITECTURE.md` §2, граница 1). Стадия 10 упаковывает уже готовое: воспроизводимый образ бэкенда,
S3-совместимое объектное хранилище с локальным MinIO вместо папки, и сборку образа в CI как рубеж. Направление
`DOCX → PDF` (Gotenberg) — отдельная спека 018, идёт после этой.

## Входит

- `Dockerfile` для `apps/api`: multi-stage, воспроизводимая сборка по локу, в рантайм-образе есть всё, что
  нужно коду в проде — нативный libvips (`sharp`), Python с `pdf2docx`/`pymupdf` (`PDF → DOCX`, движок 005),
  сгенерированный Prisma Client
- Миграции применяются при старте контейнера, не руками (`ARCHITECTURE.md` §10)
- Вторая реализация `Storage` — S3-совместимая: кладёт объект с правильным `Content-Type`, отдаёт подписанную
  ссылку с TTL, по которой браузер качает **напрямую у хранилища, минуя приложение** (`ARCHITECTURE.md` §2,
  граница 3), удаляет, перечисляет по префиксу
- Переключатель драйвера хранилища: по умолчанию — прежний диск (локальная разработка и весь тестовый стек не
  начинают требовать поднятый MinIO), `s3` — когда хранилище поднято. Сигнатура интерфейса `Storage` не
  меняется — это и есть проверка, что абстракция не протекла (`TECH-SPEC.md` §3.2)
- `docker-compose.yml`: MinIO (+ одноразовая инициализация бакета) в основном наборе; `api` — под профилем,
  чтобы `docker compose up -d` по-прежнему поднимал только инфраструктуру и не ломал dev-цикл с горячей
  перезагрузкой (`ARCHITECTURE.md` §10)
- CI: сборка образа (без публикации) + smoke — поднять его против сервис-контейнеров и убедиться, что
  `/health` и `/ready` отвечают `200`

## Не входит

| Что | Где будет |
|---|---|
| Реальный деплой (Railway, Vercel, R2, домены, `CORS_ORIGIN`) | 017 |
| Публикация образа в registry (GHCR/Railway) | 017 |
| `DOCX → PDF`, Gotenberg, пул документных конвертаций, изоляция контейнера конвертера | 018 |
| `web` в `docker-compose.yml` | Не будет: фронт — статика на Vercel (`ARCHITECTURE.md` §10). Строку «сервисы api и web в compose» в `docs/SETUP.md` поправить под реальность |
| `Dockerfile` для `web` | 017, если Vercel-сборки окажется мало (не ожидается) |
| Ночная сверка `storageUsedBytes`, сметание осиротевших объектов | 014-долг / отдельная задача (`REVIEW-FINDINGS.md` BE-FILE-02/03) |
| Хелсчек объектного хранилища в `/ready` | Здесь: `S3Storage` добавит свою проверку в `HealthService` (014 оставил на 016) |
| Смена ключа объекта на схему без `userId` в пути (`REVIEW-FINDINGS.md` BE-FILE-05) | Не в объёме; presigned URL S3 скрывает ключ в подписи — частично снимается само |

## Поведение

- `docker compose up -d` (без профиля) → поднялись `postgres`, `redis`, `mailhog`, `minio` (+ `minio-init`
  создал бакет и вышел); `api` — нет. `pnpm dev:api` снаружи работает как раньше.
- `docker compose --profile full up -d` → дополнительно поднялся `api`, дождавшись здоровья зависимостей;
  при старте применил миграции; `curl http://localhost:3000/health` → `200`, `/ready` → `200 status:ok`.
- `STORAGE_DRIVER=s3`, MinIO поднят, конвертация с `save=true` → объект появился в бакете; `GET
  /v1/files/{id}/download` → `302` на presigned URL хоста MinIO; переход по ссылке отдаёт файл с верным
  `Content-Type` и `Content-Disposition: attachment`; ссылка после `SIGNED_URL_TTL_SECONDS` → `403` от MinIO.
- `STORAGE_DRIVER=local` (умолчание) → всё как до 016: `LocalDiskStorage`, `GET /v1/storage/local/raw`
  на месте, подпись HMAC, тот же `FILE_NOT_FOUND` на подделку/истечение/отсутствие.
- `STORAGE_DRIVER=s3` без одной из `S3_*` → процесс падает на старте с внятным сообщением (не на первом
  запросе), как любая нехватка env (`ARCHITECTURE.md` §4.3).
- `docker compose --profile full up` при пустой БД → миграции накатились, приложение поднялось; повторный
  старт — миграции идемпотентны, приложение поднялось.

## Ошибочные сценарии

| Ситуация | Что видит клиент | Код |
|---|---|---|
| `STORAGE_DRIVER=s3`, presigned URL истёк | Ответ хранилища (MinIO/R2), не наш | `403` |
| `STORAGE_DRIVER=s3`, объект удалён из бакета вручную, ссылка ещё жива | Ответ хранилища | `404` |
| `S3Storage.put` не смог (хранилище недоступно) при `save=true` | Конвертация всё равно отдаётся клиенту (побочный сбой не 500, как и у `LocalDiskStorage`, спека 003/010) | `200` + `X-Save-Skipped-Reason` не ставится — `status: 'failed'` внутри, файл просто не сохранён |
| `/ready`, объектное хранилище недоступно (драйвер `s3`) | `{ status: degraded, checks: { …, storage: "down" } }` — запросы обслуживаются, `save` тихо не работает | `200` |
| Сборка образа: `pnpm install` не по локу | CI job `docker` красный | — |

## Критерии приёмки

- [ ] `docker build -f docker/api.Dockerfile .` проходит на чистом клоне; образ стартует, `prisma migrate deploy` в логе, `node dist/main` поднялся
- [ ] `docker compose up -d` → `docker compose ps` показывает `postgres`/`redis`/`mailhog`/`minio` healthy, `api` отсутствует; `pnpm dev:api` снаружи по-прежнему запускается
- [ ] `docker compose --profile full up -d` → `api` healthy; `curl :3000/health` → `200 {"status":"ok"}`, `curl :3000/ready` → `200 status:ok`
- [ ] `STORAGE_DRIVER=s3` + MinIO: `curl -F file=@sample.jpg -F target=png -F save=true -H "Authorization: Bearer <jwt>" :3000/v1/convert` → `200`; `mc ls local/<bucket>/<userId>/` показывает объект; `curl -sI` по `download` → `302`, `Location` на `:9000`; переход отдаёт `image/png`
- [ ] Та же команда после `SIGNED_URL_TTL_SECONDS` по старой ссылке → `403` от MinIO
- [ ] `STORAGE_DRIVER=local` (умолчание): полный прогон 003/010 руками — регрессии нет, `GET /v1/storage/local/raw` работает
- [ ] `git diff` не трогает `apps/api/src/modules/conversion/conversion.service.ts` и `apps/api/src/modules/files/files.service.ts` — ни строки
- [ ] `docker compose exec minio ...` или `mc` — presigned URL не содержит `S3_SECRET_ACCESS_KEY` в открытом виде (стандартная подпись v4, проверка глазами)
- [ ] CI: job `docker` зелёный (сборка + smoke `/health` `/ready`); джобы `check` и `e2e` не изменились по смыслу
- [ ] `pnpm typecheck` и `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

---

## План

### Решения владельца (2026-09-02)

1. **Стадия 10 = 016 + 018 в одной ветке `docker`.** Имя от владельца, отступает от `NNN-slug` (ветка
   покрывает два номера реестра) — отметить сноской в `SPECS.md`. Коммиты строго по частям: сначала всё 016,
   потом всё 018; 🔒-файлы 018 — отдельными коммитами под построчную читку.
2. **Ветвление от `main`** после мержа 015 (не от `backend` — бэкенд-фаза стадий 4–9 уже в `main`).
3. **Storage — переключатель `STORAGE_DRIVER`**, не жёсткий флип. `LocalDiskStorage` и `LocalDiskRawController`
   остаются. Причина: юнит/e2e/Playwright и `pnpm dev` не должны начать требовать поднятый MinIO.
4. **api — под профилем compose**, `web` в compose не заводится. `docker compose up -d` продолжает поднимать
   только инфраструктуру; горячая перезагрузка dev не ломается.

### Подход

**`docker/api.Dockerfile` — multi-stage, `node:22-bookworm-slim`** (не Alpine: prebuilt-бинарники `sharp`
собраны под glibc). Три стадии:

- `deps` — корневые `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` + `package.json` каждого workspace,
  `pnpm install --frozen-lockfile --prod=false` (нужны dev-зависимости для сборки).
- `build` — исходники `packages/shared` и `apps/api`; `pnpm --filter @convert-hub/shared build`,
  `pnpm --filter api exec prisma generate` (схема — `apps/api/src/prisma/schema.prisma`),
  `pnpm --filter api exec nest build` → `apps/api/dist/`.
- `runtime` — slim + `python3` + `python3-pip` + `libreoffice`? **Нет** — LibreOffice только в контейнере
  Gotenberg (018). Здесь: `python3`, симлинк `python → python3` (код зовёт именно `python`,
  `pdf-to-docx.engine.ts:12`), `pip install --no-cache-dir -r requirements.txt`
  (`pdf2docx==0.5.13`, `pymupdf==1.28.2`). Копируем прод-`node_modules` (отдельный `pnpm install --prod` или
  `pnpm deploy`), `apps/api/dist/`, `apps/api/python/`, `packages/shared/dist/`, `apps/api/prisma/`
  (schema + migrations + сгенерированный клиент). `WORKDIR /app/apps/api` (код зовёт `process.cwd()/python/...`
  и `process.cwd()/...` для Prisma). `USER node`. `ENTRYPOINT` — `docker/api-entrypoint.sh`:
  `pnpm exec prisma migrate deploy && exec node dist/main`.

**`STORAGE_DRIVER` + `S3Storage`.**

- `config/env.ts`: `STORAGE_DRIVER: z.enum(['local', 's3']).default('local')`. Новые: `S3_ENDPOINT` (url),
  `S3_REGION` (default `us-east-1`), `S3_BUCKET` (min 1), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_FORCE_PATH_STYLE` (`z.coerce.boolean().default(true)` — MinIO требует path-style; R2 тоже поддерживает).
  Условная обязательность через `superRefine`: `driver === 's3'` → `S3_*` обязательны; `driver === 'local'` →
  `LOCAL_STORAGE_DIR`/`SIGNED_URL_SECRET` обязательны (сейчас они безусловно обязательны — станут условными).
- `modules/storage/s3.storage.ts implements Storage` — интерфейс не трогаем (`storage.interface.ts` докблок
  прямо: «`S3Storage` (спека 016) реализует её без единой правки в местах вызова»):
  - `put(key, body, mime)` → `PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: mime })` —
    закрывает известный пробел `LocalDiskStorage` («на диске нет слота под content-type»).
  - `getSignedUrl(key, ttlSeconds)` → `getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key,
    ResponseContentDisposition: 'attachment' }), { expiresIn: ttlSeconds })` из `@aws-sdk/s3-request-presigner`.
  - `delete(key)` → `DeleteObjectCommand`. `list(prefix)` → `ListObjectsV2Command` постранично
    (`ContinuationToken`), `yield` каждого `Key`.
  - Ошибки наружу не транслируем спец-кодами — вызывающий (`files.service.ts`) уже трактует любой сбой `put`
    как `status: 'failed'` (спека 010), `getDownloadUrl` — как `FILE_NOT_FOUND`.
- `modules/storage/storage.module.ts`: `{ provide: STORAGE, useFactory: () => env.STORAGE_DRIVER === 's3' ?
  new S3Storage() : new LocalDiskStorage() }`. `controllers`: `LocalDiskRawController` только при `local`
  (`env.STORAGE_DRIVER === 's3' ? [] : [LocalDiskRawController]`). `S3Storage` тянет `@aws-sdk/client-s3`
  клиент — создаётся в конструкторе из `env`.
- `modules/health/health.service.ts` (014): при `STORAGE_DRIVER=s3` добавить `checkStorage()` —
  `HeadBucketCommand` в `Promise.race` с таймаутом; хранилище вниз → `degraded` (как redis), не `down`.
  При `local` — проверка не добавляется (папка локальная, «недоступность» не сетевая — 014 это уже
  проговорил).

**`docker-compose.yml`.**

- `minio` (`quay.io/minio/minio` или `minio/minio`): `command: server /data --console-address ":9001"`,
  порты `${MINIO_PORT:-9000}:9000` и `${MINIO_CONSOLE_PORT:-9001}:9001`, `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`
  из корневого `.env`, volume `minio-data`, healthcheck `mc ready` или `curl -f /minio/health/live`.
- `minio-init` (`minio/mc`, `restart: "no"`): ждёт `minio` healthy, `mc alias set` + `mc mb --ignore-existing`
  бакета, выходит.
- `api`: `build: { context: ., dockerfile: docker/api.Dockerfile }`, `profiles: ["full"]`, `depends_on`
  postgres/redis/minio по `condition: service_healthy`, `environment` с контейнерными хостами
  (`DATABASE_URL=...@postgres:5432/...`, `REDIS_URL=redis://redis:6379`, `S3_ENDPOINT=http://minio:9000`,
  `STORAGE_DRIVER=s3`), `ports: "3000:3000"`, healthcheck `wget -q -O- localhost:3000/health`.
- Корневой `.env.example`: += `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`,
  `MINIO_BUCKET`. `apps/api/.env.example`: += `STORAGE_DRIVER=local` (закомментированный блок `S3_*` с
  примерами для MinIO).

**CI.** `.github/workflows/ci.yml` — новый job `docker` (рядом с `check`/`e2e`, без `needs`):
`docker/setup-buildx-action` → `docker build -f docker/api.Dockerfile -t converthub-api:ci .` (без push) →
поднять `postgres`/`redis`/`minio` как `services` → `docker run` образа с env на них → в цикле `curl`
`/health` и `/ready` до `200` или таймаут. Джобы `check`/`e2e` не трогаются.

### Затрагиваемые файлы

Новые: `docker/api.Dockerfile`, `docker/api-entrypoint.sh`, `docker/.dockerignore` (или корневой), 
`apps/api/src/modules/storage/s3.storage.ts`, `apps/api/src/modules/storage/s3.storage.spec.ts`.
Изменённые: `docker-compose.yml`, `.env.example`, `apps/api/.env.example`, `apps/api/src/config/env.ts`,
`apps/api/src/modules/storage/storage.module.ts`, `apps/api/src/modules/health/health.service.ts`,
`apps/api/src/modules/health/health.module.ts` (импорт `StorageModule` при необходимости), `apps/api/package.json`
+ `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `docs/SETUP.md` (профиль, MinIO, `STORAGE_DRIVER`, строка про
`web` в compose).
**Не трогаются:** `conversion.service.ts`, `files.service.ts` (проверочное свойство §3.2), `storage.interface.ts`.

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| Жёсткий флип на `S3Storage`, удалить `LocalDiskStorage`/raw-контроллер (буквально `TECH-SPEC.md` §3.2) | Весь тестовый стек (`pnpm test:e2e`, Playwright, CI job `e2e`) и `pnpm dev` начали бы требовать поднятый MinIO; регрессия DX ради «чистоты» | Если MinIO окажется в стандартном `docker compose up` и не мешает — драйвер `local` можно объявить только для оффлайн-режима |
| `node:22-alpine` | `sharp` prebuilt под glibc; musl-сборка libvips — отдельная морока и частый источник «работает у меня» | Если размер образа станет проблемой и найдётся стабильная musl-сборка |
| LibreOffice прямо в образе `api` (без Gotenberg) | `ARCHITECTURE.md` §2 граница 2: конвертер недоверенного ввода — отдельный контейнер без сети/БД; LibreOffice в процессе API это ломает | Никогда для прода; для локальной проверки 018 есть `soffice` на хосте |
| `web` сервисом в `docker-compose.yml` | Фронт — статика на Vercel (`ARCHITECTURE.md` §10); контейнер ради `ng serve` не нужен и убивает hot reload | Если понадобится e2e против прод-сборки в контейнере (не сейчас) |
| Миграции отдельным job деплоя, не при старте контейнера | Для одного инстанса `prisma migrate deploy` при старте — норма (`ARCHITECTURE.md` §10); отдельный шаг нужен при нескольких инстансах, чтобы не гонять параллельно | 017, если инстансов станет больше одного |
| `MINIO`-инициализация бакета кодом приложения при старте | Приложение не должно уметь создавать себе бакет (лишние права, размывает границу); одноразовый `mc` в compose честнее | — |
| Свой клиент S3 поверх `fetch` вместо `@aws-sdk/client-s3` | Подпись v4 и presigned URL руками — ровно тот велосипед, который SDK делает; `TECH-SPEC.md` §3 уже закладывал `@aws-sdk/client-s3` | — |

### Риски и границы

- **`WORKDIR` и `process.cwd()`.** Код завязан на `process.cwd()`: `pdf-to-docx.engine.ts` ищет
  `python/pdf_to_docx.py`, Prisma — схему. `WORKDIR` в рантайм-образе обязан быть `.../apps/api`, иначе
  `PDF→DOCX` и миграции сломаются не на сборке, а на первом запросе.
- **`sharp` в multi-stage.** Если `node_modules` копируется между стадиями с разной libc/арх — нативный
  бинарник не подхватится. Ставить прод-зависимости в самой `runtime`-стадии или через `pnpm deploy`, не
  копировать `node_modules` из `build`.
- **Размер образа.** node + libvips + PyMuPDF — сотни МБ. Приемлемо; `--no-cache-dir` для pip,
  `pnpm store prune`, `--frozen-lockfile`, только прод-зависимости в рантайме.
- **`prisma migrate deploy` в entrypoint** упадёт, если БД недоступна — контейнер не стартует. Это верно
  (без схемы работать нельзя), но в compose `depends_on: condition: service_healthy` обязателен.
- **`STORAGE_DRIVER` условный `superRefine`** — легко забыть ветку и уронить `local`-режим требованием
  `S3_*`. Критерий приёмки про полный прогон 003/010 на `local` это ловит.
- **MinIO path-style vs virtual-hosted.** `S3_FORCE_PATH_STYLE=true` для MinIO обязателен; R2 работает с
  обоими. Дефолт `true` безопаснее.
- **presigned URL и `S3_ENDPOINT` внутри compose vs снаружи.** Приложение в контейнере знает MinIO как
  `http://minio:9000`, а браузер клиента — как `http://localhost:9000`. Presigned URL сгенерится с
  внутренним хостом и не откроется из браузера. Нужен отдельный `S3_PUBLIC_ENDPOINT` (или генерить ссылку
  от публичного хоста) — **решить при реализации**, критерий приёмки про `download` → `302` это вскроет.

### Мои тест-кейсы

*(владелец пишет свои прозой до кода)*

- `docker build` на чистом `git clone` (без `node_modules`, без `dist/`) — проходит; `docker run` образа
  против внешних postgres/redis/minio — `/health` `200` за < 10 с после старта.
- `docker compose up -d` без профиля → `api` не поднят; `curl :3000/health` — connection refused; `pnpm dev:api`
  запускается и отвечает.
- `docker compose --profile full up -d` → миграции в логе `api`, `/ready` `200 ok`; `docker compose restart api`
  → миграции идемпотентны, снова `200`.
- `STORAGE_DRIVER=s3`: гость конвертирует `JPG→PNG` `save=false` → `200`, объекта в бакете нет (гость не
  сохраняет). Пользователь — `save=true` → объект в `mc ls`, `download` → `302` на MinIO, файл открывается.
- Остановить `minio` (`docker compose stop minio`), `STORAGE_DRIVER=s3`, пользователь конвертирует `save=true`
  → `200`, файл не сохранён, 500 нет; `/ready` → `200 degraded storage:down`.
- `STORAGE_DRIVER=local`: полный e2e-слой `apps/api` (`pnpm --filter api test:e2e`) и Playwright (`pnpm e2e`)
  — зелёные без MinIO.
- `STORAGE_DRIVER=s3` без `S3_BUCKET` → процесс не стартует, в логе понятная строка про `S3_BUCKET`.
- `git diff main..HEAD -- apps/api/src/modules/conversion/conversion.service.ts apps/api/src/modules/files/files.service.ts`
  — пусто.

---

## Чек-лист

- [ ] `specs/016-containerization.md` + план (этот файл) — коммит-гейт перед кодом
- [ ] `apps/api`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- [ ] `config/env.ts` — `STORAGE_DRIVER` + `S3_*` с условным `superRefine`; `.env.example` (оба), `docs/SETUP.md`
- [ ] `modules/storage/s3.storage.ts` — `put`/`getSignedUrl`/`delete`/`list`; `storage.module.ts` — фабрика по драйверу, raw-контроллер только при `local`
- [ ] `s3.storage.spec.ts` — юнит с мокнутым клиентом S3 (форма команд, `ContentType`, `expiresIn`, постраничный `list`)
- [ ] `modules/health/health.service.ts` — `checkStorage()` при `s3` → `degraded` при недоступности
- [ ] `docker/api.Dockerfile` — 3 стадии, `node:22-bookworm-slim`, python + `pdf2docx`/`pymupdf`, prisma generate, `WORKDIR .../apps/api`, `USER node`
- [ ] `docker/api-entrypoint.sh` — `prisma migrate deploy && exec node dist/main`
- [ ] `docker-compose.yml` — `minio` + `minio-init` (основной набор), `api` (profile `full`), контейнерные хосты в env
- [ ] `.github/workflows/ci.yml` — job `docker` (buildx build без push + smoke `/health` `/ready`)
- [ ] Ручная проверка по критериям приёмки: build на чистом клоне; `up` без профиля не поднимает `api`; `--profile full` → `/health`/`/ready` `200`; `s3` — объект в бакете, `download` → `302`, скачивание; `local` — регрессия 003/010 и весь тестовый стек зелёные; `git diff` не трогает `conversion.service.ts`/`files.service.ts`
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm e2e` — зелёные

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### После мержа

- [ ] Решения-долгожители → `TECH-SPEC.md` §3.2/§13: `STORAGE_DRIVER` как переключатель (а не жёсткий флип), `@aws-sdk/client-s3` + presigned URL как канон, профиль compose для `api`, `web` не в compose
- [ ] `ARCHITECTURE.md` §1.1/§10 — MinIO в основном наборе compose, `api` под профилем, миграции при старте
- [ ] `docs/SETUP.md` — строка «сервисы api и web в docker-compose.yml» приведена к реальности
- [ ] Статус в реестре обновлён (016 + сноска про совмещённую с 018 ветку)
- [ ] Ошибки агента записаны в `AI-JOURNAL.md`
