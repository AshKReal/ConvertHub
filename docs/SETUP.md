# SETUP.md

Поднятие проекта с нуля. Документ описывает **фактическое состояние репозитория на 2026-08-30**, а не целевую
конфигурацию: ниже нет ни одной команды и ни одной переменной, которых сейчас нет в коде. Чего ещё нет —
перечислено в конце отдельным разделом, чтобы отсутствие не выглядело упущением документации.

## Что уже работает

| Компонент | Состояние |
|---|---|
| `apps/web` — Angular 22, Tailwind 4 | Главная и страница конвертации на моках, тема, три языка |
| `apps/api` — NestJS 11 | `POST /v1/convert` (`JPG⇄PNG`, `PNG→JPG`, `PDF→DOCX`; 002, 005), `GET /v1/files/{id}/download` (003), единый формат ошибок (026) |
| `apps/api` — Prisma 6 / PostgreSQL | Схема `users`/`files`/`conversions`, миграции в `apps/api/src/prisma/migrations/` (спека 003) |
| `packages/shared` | Реестр направлений конвертации, коды ошибок, лимиты; собирается в `dist/` |
| `docker-compose.yml` | `postgres:17-alpine`, `redis:7-alpine` — оба с healthcheck |

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

Бэкенд и базы поднимаются отдельно и на текущем этапе не нужны фронтенду — сеть в стадиях 0–3 не используется:

```bash
docker compose up -d                      # postgres, redis
pnpm --filter api exec prisma migrate dev # применить миграции к пустой БД (спека 003)
pnpm dev:api                              # http://localhost:3000
```

`LOCAL_STORAGE_DIR` (см. переменные ниже) должна существовать и лежать вне репозитория — `LocalDiskStorage` падает
на старте, если это не так.

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
| `DATABASE_URL` | пока нет | `postgresql://convert_hub:change-me@localhost:5432/convert_hub` | Ничего: читает только `docker compose`/Prisma CLI при прямом вызове из корня; приложение и `prisma migrate` читают одноимённую переменную из `apps/api/.env` (ниже) |
| `REDIS_URL` | пока нет | `redis://localhost:6379` | Ничего: кодом ещё не читается, объявлена под rate limit и идемпотентность (спека 012) |

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
| `SIGNED_URL_SECRET` | **да** | 32+ случайных символа | Старт падает: подпись ссылок на скачивание (`LocalDiskStorage.getSignedUrl`, спека 003) без секрета невозможна — дефолта нет намеренно |
| `LOCAL_STORAGE_DIR` | **да** | `E:\convertedHub-local-storage` (абсолютный путь вне репозитория) | Старт падает: `LocalDiskStorage` явно проверяет, что путь не лежит внутри репозитория (спека 003) |

## Где смотреть письма

Отправки почты в проекте нет: SMTP-клиент не подключён, MailHog в `docker-compose.yml` отсутствует, переменных
почты в схеме окружения нет. Канал доставки писем не выбран в `TECH-SPEC.md` — это открытый вопрос спеки 009.

## OAuth credentials

Ни одной OAuth-переменной и ни одного callback-маршрута в коде нет, поэтому redirect URI назвать нельзя: он
определяется маршрутом, которого ещё не существует. Раздел заполняется в рамках спеки 008 одновременно с кодом,
по правилу из `AUTH-RULES.md`: новая переменная окружения — обновление `.env.example` и этого файла тем же изменением.

Что известно из `TECH-SPEC.md` §8.3 уже сейчас: провайдеров два — Google (OAuth 2.0 Authorization Code + PKCE,
идентификация по `sub`) и Telegram Login Widget (серверная проверка HMAC-SHA256, `auth_date` не старше 24 часов).
GitHub в спецификации не значится.

## Чего ещё нет

| Что | Где появится |
|---|---|
| Сиды | Отдельного решения нет; сущностей для сида пока не существует |
| `GET /v1/files` (список, пагинация), квота, автоснятие `save` | Спека 010 |
| Реальное объектное хранилище вместо `LocalDiskStorage` | Спека 016 |
| Аутентификация: эндпоинты, guard'ы, JWT, cookie | Спеки 007–009, инварианты — `AUTH-RULES.md` |
| Почта и MailHog | Спека 009, канал доставки не выбран |
| Сервисы `api` и `web` в `docker-compose.yml`, Dockerfile | Спека 016 |
| Gotenberg и MinIO | Спека 016 |
| Тесты и тестовый раннер | Спека 015 |
