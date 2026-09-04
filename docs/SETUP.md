# SETUP.md

Поднятие проекта с нуля. Документ описывает **фактическое состояние репозитория на 2026-08-30**, а не целевую
конфигурацию: ниже нет ни одной команды и ни одной переменной, которых сейчас нет в коде. Чего ещё нет —
перечислено в конце отдельным разделом, чтобы отсутствие не выглядело упущением документации.

## Что уже работает

| Компонент | Состояние |
|---|---|
| `apps/web` — Angular 22, Tailwind 4 | Главная и страница конвертации на моках, тема, три языка |
| `apps/api` — NestJS 11 | `POST /v1/convert` — все четыре направления (`JPG⇄PNG`, `PNG→JPG`, `PDF→DOCX` через Python, `DOCX→PDF` через Gotenberg; 002, 005, 018), `GET /v1/files/{id}/download` (003), единый формат ошибок (026), `/v1/auth/*` — email+пароль, JWT access+refresh (007), восстановление/смена пароля, удаление аккаунта (009, `docs/AUTH.md`) |
| `apps/api` — Prisma 6 / PostgreSQL | Схема `users`/`files`/`conversions`/`identities`/`api_keys`/`refresh_tokens`/`password_reset_tokens`, миграции в `apps/api/src/prisma/migrations/` |
| `packages/shared` | Реестр направлений конвертации, коды ошибок, лимиты; собирается в `dist/` |
| `docker-compose.yml` | Инфраструктура: `postgres:17-alpine`, `redis:7-alpine` (healthcheck), `mailhog`, `minio` + `minio-init` (спека 016), `gotenberg` (спека 018, изолированная сеть). Собранный `api` — под профилем `full` (спека 016). `web` — не в compose (Vercel, `ARCHITECTURE.md` §10) |
| `docker/api.Dockerfile` | Multi-stage образ бэкенда (спека 016): node + libvips + Python/`pdf2docx`, `prisma migrate deploy` в entrypoint |
| Тесты (спека 015) | Vitest: юнит во всех трёх пакетах (🔒-валидаторы, автомат зоны загрузки, pipes, квота) + e2e-слой `apps/api` (`supertest` + `convert_hub_test`). Playwright: браузерный минимум (`apps/web/e2e/`). Раздел «Тесты» ниже |
| CI (`.github/workflows/ci.yml`) | job `check` — `typecheck`/`lint`/`test` (юнит), без сервисов; job `e2e` — postgres+redis, `apps/api` supertest + Playwright. На push/PR в `main`/`backend` |

## Требования

- Node.js 22 (`.nvmrc`), pnpm 10.34.5 (поле `packageManager` в корневом `package.json`)
- Docker и Docker Compose — нужны начиная со стадии 4 (`tasks.md`); для фронтенд-стадий 0–3 не требуются
- Python (доступен как `python` на `PATH`) + зависимости из `apps/api/python/requirements.txt` — только для
  `PDF → DOCX` (спека 005): `pdf2docx` вызывается как дочерний процесс из `apps/api`, отдельного сервиса не поднимает
  ```bash
  python -m pip install -r apps/api/python/requirements.txt
  ```

## Первый запуск

```bash
pnpm install
cp .env.example .env                      # переменные docker compose, если файла ещё нет
cp apps/api/.env.example apps/api/.env    # переменные API, если файла ещё нет
pnpm --filter @convert-hub/shared build   # apps/web и apps/api импортируют из dist/, который не в репозитории
pnpm dev:web                              # http://localhost:4200
```

Бэкенд и базы:

```bash
docker compose up -d                      # инфраструктура: postgres, redis, mailhog, minio(+init), gotenberg
pnpm --filter api exec prisma migrate dev # применить миграции к пустой БД (спека 003)
pnpm dev:api                              # http://localhost:3000
```

`docker compose up -d` поднимает только инфраструктуру — собранный `api` под профилем: `docker compose --profile
full up -d` (спека 016; так `api` запускается в контейнере с `STORAGE_DRIVER=s3` против MinIO). Для разработки с
горячей перезагрузкой — `pnpm dev:api` снаружи, без профиля.

**Профилю `full` нужны настоящие секреты в корневом `.env`** — `JWT_SECRET`, `SIGNED_URL_SECRET`,
`METRICS_TOKEN`. Контейнер `api` работает с `NODE_ENV=production`, а `config/env.ts` в этом режиме отказывается
стартовать, если в секрете виден маркер плейсхолдера (`change-me` и т.п.) — иначе стенд поднялся бы с ключом
подписи JWT, лежащим в публичном репозитории (`REVIEW-FINDINGS.md`, INFRA-01). Сгенерировать:

```bash
openssl rand -base64 32   # для JWT_SECRET и SIGNED_URL_SECRET, по одному на каждый
openssl rand -base64 16   # для METRICS_TOKEN
```

На базовый `docker compose up -d` (только инфраструктура) это не влияет — контейнер `api` там не запускается.

`LOCAL_STORAGE_DIR` (см. переменные ниже) должна существовать и лежать вне репозитория — `LocalDiskStorage` падает
на старте, если это не так. При `STORAGE_DRIVER=local` (умолчание) файлы результатов идут на диск; `s3` — в MinIO
(`docker compose up -d` его уже поднял и создал бакет).

**`DOCX → PDF` локально (спека 018):** Gotenberg портов наружу не публикует (изоляция, `ARCHITECTURE.md` §2/§13),
поэтому `pnpm dev:api` снаружи его не видит. Варианты: `docker compose --profile full up -d` (конвертация внутри
контейнера `api`) либо локальный `docker-compose.override.yml`, публикующий порт:

```yaml
# docker-compose.override.yml (не коммитить — ослабляет изоляцию)
services:
  gotenberg:
    ports: ["127.0.0.1:3001:3000"]
```

и `GOTENBERG_URL=http://localhost:3001` в `apps/api/.env`. Без Gotenberg `DOCX→PDF` даёт `CONVERSION_FAILED`,
остальные три направления работают.

Проверки перед тем, как считать работу законченной:

```bash
pnpm typecheck
pnpm lint
```

`pnpm typecheck` в чистом клоне падает, пока не выполнена сборка `packages/shared`: `dist/` в `.gitignore`,
а `apps/web` импортирует пакет по `main`/`types`.

## Переменные окружения

### Корневой `.env` — читается только docker compose

| Имя | Обязательна | Пример | Что ломается, если не задать |
|---|---|---|---|
| `POSTGRES_USER` | да | `convert_hub` | `docker compose up` падает: подстановка в `environment` пустая |
| `POSTGRES_PASSWORD` | да | `change-me` | то же |
| `POSTGRES_DB` | да | `convert_hub` | то же |
| `POSTGRES_PORT` | нет | `5432` | по умолчанию `5432`; менять при занятом порте (на некоторых машинах Windows + Docker Desktop порт 5432 сам по себе ненадёжен для Prisma — см. `docker-compose.yml`) |
| `REDIS_PORT` | нет | `6379` | по умолчанию `6379` |
| `MAILHOG_SMTP_PORT` | нет | `1025` | по умолчанию `1025` — этот порт указывает `SMTP_HOST`/`SMTP_PORT` в `apps/api/.env` |
| `MAILHOG_WEB_PORT` | нет | `8025` | по умолчанию `8025` — веб-интерфейс, см. «Где смотреть письма» |
| `MINIO_ROOT_USER` `MINIO_ROOT_PASSWORD` | нет | `minioadmin` | по умолчанию `minioadmin`/`minioadmin` (спека 016). Совпадает с `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` в `apps/api/.env` при `STORAGE_DRIVER=s3` |
| `MINIO_PORT` `MINIO_CONSOLE_PORT` `MINIO_BUCKET` | нет | `9000` / `9001` / `convert-hub` | по умолчанию как в примере; `minio-init` создаёт бакет на старте |
| `DATABASE_URL` | пока нет | `postgresql://convert_hub:change-me@localhost:5432/convert_hub` | Ничего: читает только `docker compose`/Prisma CLI при прямом вызове из корня; приложение и `prisma migrate` читают одноимённую переменную из `apps/api/.env` (ниже) |
| `REDIS_URL` | нет | `redis://localhost:6379` | Ничего для docker compose; переменную с тем же значением читает `apps/api` (спека 012) — см. таблицу `apps/api/.env` ниже |

### `apps/api/.env` — валидируется Zod-схемой при старте

Схема — [`apps/api/src/config/env.ts`](../apps/api/src/config/env.ts). Значение вне схемы роняет процесс на старте,
а не на первом запросе. Тот же файл читает Prisma CLI (`pnpm --filter api exec prisma ...`) — рабочая директория
у `pnpm --filter` всегда `apps/api/`.

| Имя | Обязательна | Пример | Что ломается, если не задать |
|---|---|---|---|
| `NODE_ENV` | нет | `development` | По умолчанию `development`; значение вне `development` / `test` / `production` роняет старт |
| `PORT` | нет | `3000` | По умолчанию `3000`; нечисловое или отрицательное значение роняет старт |
| `CORS_ORIGIN` | **да** | `http://localhost:4200` | Старт падает: схема требует валидный URL. Строка `*` не проходит валидацию — это осознанное ограничение |
| `DATABASE_URL` | **да** | `postgresql://convert_hub:change-me@localhost:5432/convert_hub` | Старт падает: схема требует валидный URL. Читает Prisma (спека 003) |
| `REDIS_URL` | **да** | `redis://localhost:6379` | Старт падает: схема требует валидный URL. Rate limit и идемпотентность (спека 012). Сам Redis необязателен в рантайме — если он лёг, обе подсистемы fail-open; но переменная нужна, чтобы клиент знал, куда подключаться |
| `SIGNED_URL_SECRET` | **да** | 32+ случайных символа | Старт падает: подпись ссылок на скачивание (`LocalDiskStorage.getSignedUrl`, спека 003) без секрета невозможна — дефолта нет намеренно |
| `LOCAL_STORAGE_DIR` | **да** | `E:\convertedHub-local-storage` (абсолютный путь вне репозитория) | Старт падает: `LocalDiskStorage` явно проверяет, что путь не лежит внутри репозитория (спека 003) |
| `JWT_SECRET` | **да** | 32+ случайных символа | Старт падает: подпись access-JWT (`TokenService`, спека 007) без секрета невозможна — дефолта нет намеренно |
| `SMTP_HOST` | **да** | `localhost` | Старт падает: `MailService` (спека 009) не может создать транспорт без хоста |
| `SMTP_PORT` | **да** | `1025` | Старт падает: нечисловое/неположительное значение не проходит схему |
| `SMTP_SECURE` | нет | `false` | По умолчанию `false` — так принимает MailHog; реальному провайдеру на 465/587 понадобится `true` |
| `SMTP_FROM` | **да** | `noreply@convert-hub.local` | Старт падает: схема требует валидный email |
| `SMTP_USER` | нет локально, **да в проде** | не задавать | MailHog принимает анонимно. Задаётся только парой с `SMTP_PASSWORD` — на половине пары старт падает в любом окружении. При `NODE_ENV=production` обязательна вся пара: анонимную отправку не принимает ни один провайдер (`INFRA-12`) |
| `SMTP_PASSWORD` | нет локально, **да в проде** | не задавать | То же. У Resend это API-ключ при `SMTP_USER=resend` |
| `GOOGLE_CLIENT_ID` | **да** | `xxx.apps.googleusercontent.com` | Старт падает: `GoogleOauthService` (спека 008) не может собрать authorize URL |
| `GOOGLE_CLIENT_SECRET` | **да** | из Google Cloud Console | Старт падает: без него не пройдёт обмен `code` на токен |
| `GOOGLE_REDIRECT_URI` | **да** | `http://localhost:3000/v1/auth/google/callback` | Старт падает: схема требует валидный URL. Должен буквально совпадать с authorized redirect URI в настройках Client ID — иначе Google отказывает с `redirect_uri_mismatch`, не наш код |
| `LOG_LEVEL` | нет | `info` | По умолчанию `info` (спека 014, `pino`). Значение вне `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent` роняет старт |
| `METRICS_TOKEN` | **да** | 16+ случайных символов | Старт падает: `GET /metrics` (спека 014) закрыт `Authorization: Bearer <этот токен>`, дефолта нет намеренно |
| `STORAGE_DRIVER` | нет | `local` | По умолчанию `local` (`LocalDiskStorage` + `GET /v1/storage/local/raw`). `s3` — `S3Storage` (MinIO / R2, спека 016). Значение вне `local`/`s3` роняет старт |
| `S3_ENDPOINT` `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | при `s3` | `http://localhost:9000` / `convert-hub` / `minioadmin` / `minioadmin` | При `STORAGE_DRIVER=s3` старт падает, если хоть одна не задана. При `local` игнорируются. `LOCAL_STORAGE_DIR`/`SIGNED_URL_SECRET` остаются обязательными и в режиме `s3` (держите заглушками) |
| `S3_PUBLIC_ENDPOINT` | нет | `http://localhost:9000` | Хост в presigned URL для браузера. Не задан → `S3_ENDPOINT`. Нужен, когда приложение видит хранилище под другим именем, чем клиент (например `minio:9000` в compose) |
| `S3_REGION` | нет | `us-east-1` | По умолчанию `us-east-1` |
| `S3_FORCE_PATH_STYLE` | нет | `true` | По умолчанию `true` (MinIO требует path-style; R2 — оба варианта) |
| `GOTENBERG_URL` | нет | `http://localhost:3001` | По умолчанию `http://localhost:3001`. Адрес Gotenberg для `DOCX→PDF` (спека 018). Недостижим → это направление даёт `CONVERSION_FAILED`, остальные работают. В `--profile full` — `http://gotenberg:3000` |

`NODE_ENV=production` отключает `pino-pretty` — логи в stdout сырым JSON (одна запись — одна строка), как ждёт
сборщик. В деве — человекочитаемый формат.

## Тесты

Спека 015 (`specs/015-testing.md`). Testcontainers сознательно заменён второй БД на общем контейнере Postgres.
Vitest — юнит во всех трёх пакетах + e2e-слой `apps/api` (`supertest` поверх `AppModule`). Playwright — браузерный
e2e-минимум (`apps/web/e2e/`).

```
pnpm test        юнит-тесты всех трёх пакетов, без внешних сервисов — безопасно запускать всегда
pnpm test:e2e     apps/api (supertest) против реальной convert_hub_test (см. ниже)
pnpm e2e          Playwright: chromium против поднятого стека (см. «Playwright» ниже)
```

**Юнит.** `packages/shared` и `apps/web` — без внешних сервисов. `apps/api` — `unplugin-swc` (Vitest не умеет
`emitDecoratorMetadata` через дефолтный esbuild-транспайлер, NestJS держится на декораторах) — конфиг сам грузит
`apps/api/.env`, тот же файл, что `pnpm dev:api`.

**E2E** (`apps/api` — `supertest` поверх настоящего `AppModule`) требует вторую БД `convert_hub_test` на том же
контейнере `postgres`, что и dev (не отдельный контейнер/Testcontainers — решение владельца). Разовая настройка:

```
docker compose up -d postgres            # если ещё не поднят
# convert_hub_test создаётся автоматически только на СВЕЖЕМ volume
# (docker/postgres-init/01-create-test-db.sql) — на уже существующем:
docker compose exec postgres psql -U convert_hub -d convert_hub -c "CREATE DATABASE convert_hub_test;"
pnpm --filter api db:migrate:test        # применяет все миграции к convert_hub_test
```

Переменная `TEST_DATABASE_URL` (`apps/api/.env`, не в схеме `config/env.ts` — это тестовая инфраструктура, не
рантайм-конфиг) — та же строка подключения, что `DATABASE_URL`, только другое имя БД. `test/setup-e2e.ts`
подменяет `DATABASE_URL` на неё до импорта Prisma; без `TEST_DATABASE_URL` тесты падают явно, не бьют по dev-БД
тихо. Каждый e2e-тест удаляет за собой созданные строки (`test/utils/test-db.ts#cleanupUser`) — не глобальный
rollback транзакций.

### Playwright (`pnpm e2e`)

Браузерный e2e-минимум (`ARCHITECTURE.md` §11): гость конвертирует, вошедший видит файл, файл > 10 МБ отклоняется,
при полной квоте файл не сохраняется. Config — `apps/web/playwright.config.ts`.

Playwright сам поднимает стек (`webServer`): `nest start` с `DATABASE_URL` = `TEST_DATABASE_URL` (та же
`convert_hub_test`, что supertest-слой — сценарии создают и убирают своих `e2e-pw-*` пользователей) и `ng serve`.
Разовая настройка:

```
docker compose up -d postgres redis           # оба нужны: rate limit / идемпотентность
pnpm --filter api db:migrate:test             # если convert_hub_test ещё не мигрирована
pnpm --filter web exec playwright install chromium
```

Прогон:

```
# останови pnpm dev:api, если запущен: локальный dev смотрит в convert_hub,
# а Playwright-API и его сидинг квоты (apps/api/scripts/e2e-db.mjs) — в convert_hub_test;
# они не должны расходиться, поэтому порт 3000 должен быть свободен
pnpm e2e
```

`apps/web/e2e/e2e:typecheck` (`tsconfig.e2e.json`) — отдельный `tsc` для `e2e/`: каталог вне `src/`, обычный
`pnpm --filter web typecheck` его теперь тоже гоняет.

## Где смотреть письма

Локально — MailHog: `docker compose up -d` поднимает его вместе с остальными сервисами, `apps/api` шлёт письма на
`SMTP_HOST:SMTP_PORT` (по умолчанию — сам MailHog, `localhost:1025`), веб-интерфейс с входящими —
[http://localhost:8025](http://localhost:8025). Никуда наружу ничего не уходит.

Первый реальный отправитель — `AccountService` (спека 009): восстановление/смена пароля шлют письма через
`MailModule` (`apps/api/src/modules/auth/auth.module.ts` его импортирует).

В проде — любой SMTP-провайдер через те же переменные плюс `SMTP_USER`/`SMTP_PASSWORD`: анонимную
отправку не принимает никто, поэтому вне `development` пара обязательна (`INFRA-12`). Конкретный выбор
провайдера — спека 017 (deployment).

## OAuth credentials

**Решение владельца (`AUTH-RULES.md` §5): пока реализуется только Google**, Telegram отложен, GitHub не
рассматривается. Спека 008: Google — OAuth 2.0 Authorization Code с PKCE, идентификация по `sub`, не по email.
Контракт Telegram Login Widget описан в `TECH-SPEC.md` §8.3 на будущее, но не реализуется, пока спека к нему не
вернётся.

Настоящий Client ID заводится в [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
Create OAuth client ID → Web application. Authorized redirect URI — буквально значение `GOOGLE_REDIRECT_URI` выше
(`http://localhost:3000/v1/auth/google/callback` локально). `apps/api/.env` без реального `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` (только placeholder) запускает приложение, но сам вход через Google возвращает ошибку от
Google (`invalid_client`), не `500` у нас — это ожидаемо, не баг.

## Чего ещё нет

| Что | Где появится |
|---|---|
| Сиды | Отдельного решения нет; сущностей для сида пока не существует |
| Реальный деплой (Railway, Vercel, R2, домены, публикация образа) | Спека 017 |
| Оптимизация размера образа `api` (~1.5 ГБ: node + libvips + PyMuPDF) | Отдельно / спека 017 |
| Публикация порта Gotenberg для `pnpm dev:api` без `--profile full` | Локальный `docker-compose.override.yml` (см. «Первый запуск») |
