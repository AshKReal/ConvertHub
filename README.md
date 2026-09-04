# ConvertHub

Сервис конвертации файлов: **JPG⇄PNG**, **DOCX→PDF**, **PDF→DOCX**. Веб-интерфейс и публичный HTTP API
по ключу.

Файлы до 10 МБ, хранилище пользователя 300 МБ, конвертация синхронная. Интерфейс на английском, русском и
украинском, светлая и тёмная темы.

> **Статус:** учебный проект. Код написан целиком, бэкенд и фронтенд работают, но приёмка владельцем по
> большинству спек не пройдена, а `REVIEW-FINDINGS.md` содержит 86 открытых находок враждебного ревью
> (критичных среди них нет). Продакшен-гарантий это не даёт и не обещает.

---

## Что внутри

Монорепозиторий на pnpm workspaces:

| Пакет | Что это |
|---|---|
| `apps/api` | NestJS 11, Prisma, PostgreSQL, Redis |
| `apps/web` | Angular 22, standalone-компоненты, сигналы, Tailwind 4 |
| `packages/shared` | Zod-схемы, коды ошибок, лимиты — единственный источник правды для обеих сторон |

Конвертацию выполняют: **sharp** (изображения), **Gotenberg/LibreOffice** в отдельном контейнере без выхода
в сеть (`DOCX→PDF`), **pdf2docx** дочерним процессом Python (`PDF→DOCX`).

Ошибки API — RFC 9457 (`application/problem+json`) с машиночитаемым полем `code`. Тип загруженного файла
определяется по сигнатуре (magic bytes), не по расширению и не по `Content-Type`.

---

## Быстрый старт

Нужны Node 22, pnpm 10 и Docker.

```bash
pnpm install
cp .env.example .env                 # для docker compose
cp apps/api/.env.example apps/api/.env
docker compose up -d                 # postgres, redis, mailhog, minio
pnpm --filter @convert-hub/shared build
pnpm --filter api db:migrate
pnpm dev:api                         # http://localhost:3000
pnpm dev:web                         # http://localhost:4200
```

Подробности, включая направление `DOCX→PDF` (требует профиля `full`), почту и OAuth —
[docs/SETUP.md](docs/SETUP.md).

## Проверки

```bash
pnpm typecheck     # обязательно перед «готово»
pnpm lint          # внимание: у apps/api скрипт с --fix, он правит исходники
pnpm test          # юнит-тесты всех пакетов, внешние сервисы не нужны
pnpm test:e2e      # apps/api против реальной БД, нужен docker compose up -d postgres
pnpm e2e           # Playwright
```

## Публичный API

Ключ передаётся как `Authorization: Bearer ch_live_...`. Схема — `GET /v1/openapi.json`, генерируется из тех
же Zod-схем, что валидируют запросы, поэтому разойтись с реальностью не может. Живая страница
документации — `/api-docs`.

```bash
curl -X POST https://<host>/v1/convert \
  -H "Authorization: Bearer $CONVERT_HUB_KEY" \
  -F file=@photo.jpg -F target=png -o photo.png
```

---

## Документация

| Вопрос | Документ |
|---|---|
| Локальный запуск, переменные окружения | [docs/SETUP.md](docs/SETUP.md) |
| Развёртывание | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Границы системы, потоки, режимы отказа | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Почему выбрана эта технология | [TECH-SPEC.md](TECH-SPEC.md) |
| Реестр фич и их статус | [SPECS.md](SPECS.md) |
| Цвета, темы, типографика | [DESIGN.md](DESIGN.md) |
| Решения по безопасности и отступления | [docs/SECURITY.md](docs/SECURITY.md) |
| Инварианты аутентификации | [AUTH-RULES.md](AUTH-RULES.md) |
| Открытые находки ревью | [REVIEW-FINDINGS.md](REVIEW-FINDINGS.md) |
| Правила для агентов | [AGENTS.md](AGENTS.md) |
