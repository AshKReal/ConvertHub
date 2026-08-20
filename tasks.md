# tasks.md

Гранулярный чек-лист поверх реестра `SPECS.md`. Один пункт верхнего уровня = одна строка реестра = один цикл спека→план→чек-лист (`SPECS.md`, раздел «Цикл»). Подпункты — не замена цикла, а разбивка «что вообще входит», на которую опирается раздел «Входит» будущей спеки.

**Правило CLAUDE.md:** новая сессия на каждую задачу из этого файла. Длинная сессия после сжатия контекста теряет вложенные правила из `.claude/rules/*.md`.

Перед стартом любого пункта — `docker compose up -d` (postgres, redis подняты с 1 стадии, `ARCHITECTURE.md` §1.1). 🔒 — план сначала, код после, построчная проверка владельцем (`.claude/rules/critical-zones.md`).

---

## Стадия 0 — проверка движков

- [ ] **000** `engine-quality-check`
  - [ ] sharp: JPG↔PNG на 20–30 реальных файлах, зафиксировать качество и время
  - [ ] `soffice --headless --convert-to pdf` на 20–30 реальных docx, зафиксировать проблемные случаи (пароль, кастомные шрифты, макросы)
  - [ ] PDF→JPG (pdfjs либо poppler) на 20–30 файлах, DPI 72/150/300, лимит 50 страниц
  - [ ] Решение по PDF-движку (pdfjs vs poppler) зафиксировать в TECH-SPEC.md

## Стадия 1 — вертикальный срез `JPG → PNG` без авторизации

- [ ] **001** `upload-dropzone`
  - [ ] Контракт `POST /v1/convert` на клиенте, `FormData` без ручного `Content-Type`
  - [ ] Состояния `empty → dragover → selected`
  - [ ] Счётчик глубины `dragenter`/`dragleave` против мигания
  - [ ] На мобильных — кнопка вместо `dragover`
- [ ] **002** 🔒 `convert-jpg-png`
  - [ ] Приём файла потоком во временный каталог
  - [ ] Определение типа по magic bytes, не по расширению/`Content-Type`
  - [ ] Decompression bomb: проверка заявленных размеров до декодирования, лимит 50 Мп
  - [ ] `ConversionEngine.convert()` для sharp: `JPG↔PNG`, `quality`, `background`
  - [ ] Удаление временных файлов в `finally`
- [ ] **003** 🔒 `file-storage`
  - [ ] Интерфейс `Storage` (`put`/`getSignedUrl`/`delete`/`list`)
  - [ ] `LocalDiskStorage implements Storage`, папка вне репозитория
  - [ ] Таблицы `files` и `conversions`, ULID
  - [ ] Транзакция: insert `files` + update `users.storage_used_bytes`
  - [ ] `GET /v1/files/{id}/download` → `302` на подписанную ссылку (TTL 15 мин)
- [ ] **004** `error-contract`
  - [ ] `packages/shared/src/constants/error-codes.ts` — `as const`, поля `status`/`retryable`
  - [ ] `AllExceptionsFilter` → `problem+json` + `request_id`
  - [ ] `errorInterceptor` на клиенте → единый тип `AppError`
  - [ ] i18n-словарь текстов по коду ошибки (ru/en), с конкретными числами, не «Ошибка загрузки»

## Стадия 2 — направления без Gotenberg, полный автомат зоны

- [ ] **005** `conversion-engines` (`PNG→JPG`, `PDF→JPG`)
  - [ ] `PNG→JPG`: `quality` 60–100, `background`
  - [ ] `PDF→JPG`: движок по итогам 000, `dpi` 72/150/300, лимит 50 страниц
  - [ ] Лимит одновременных конвертаций на пользователя (3)
  - [ ] `ConversionEngine` проектируется под HTTP-движок заранее (018 не должен потребовать менять интерфейс)
- [ ] **006** `dropzone-full-states`
  - [ ] Полный автомат: `uploading`, `converting`, `done`, `error`, `quotaFull`
  - [ ] Прогресс через `HttpEventType`, переход в «конвертируем» по 100% загрузки, не по `Response`
  - [ ] Отмена загрузки (обрыв HTTP); конвертация не отменяется
  - [ ] Полное покрытие кодов ошибок из 004 по местам показа (зона / тост / баннер / инлайн)

## Стадия 3 — аутентификация

- [ ] **007** 🔒 `auth-native`
  - [ ] Регистрация email + пароль
  - [ ] Вход, единое сообщение «Неверный email или пароль» на любую причину отказа
  - [ ] JWT access (15 мин, в памяти) + refresh (30 дней, `HttpOnly`/`Secure`/`SameSite=Lax`)
  - [ ] Ротация refresh при обновлении; повторное предъявление использованного токена → завершение всех сессий
  - [ ] Клиентская очередь на параллельные `401` (не тройной вызов `/auth/refresh`)
  - [ ] Выход
- [ ] **008** 🔒 `auth-providers`
  - [ ] Google OAuth 2.0 Authorization Code + PKCE, идентификация по `sub`, не по email
  - [ ] Telegram Login Widget: серверная проверка HMAC-SHA256 подписи, `auth_date` не старше 24 ч
  - [ ] Таблица `identities` (`provider` + `provider_uid`)
  - [ ] Привязка внешнего аккаунта только при подтверждённом email от провайдера
  - [ ] Запрет отвязки последнего способа входа
- [ ] **009** 🔒 `account-recovery`
  - [ ] Восстановление пароля: одинаковый ответ независимо от существования аккаунта
  - [ ] Токен ≥32 случайных байт, в БД хеш, TTL 30 мин, одноразовый; Telegram-код — TTL 10 мин, ≤5 попыток
  - [ ] Смена пароля из профиля → завершение всех сессий + уведомление
  - [ ] Удаление аккаунта

## Стадия 4 — хранилище, квота, публичный API

- [ ] **010** `user-files-quota`
  - [ ] Страница файлов, курсорная пагинация (`WHERE id < :cursor ORDER BY id DESC`, ULID)
  - [ ] Переключатель `save`, автоснятие при заполненной квоте с предупреждением
  - [ ] Индикатор занятого места (`storage_used_bytes`)
  - [ ] TanStack Query: список файлов + инвалидация `['me']` после мутаций
- [ ] **011** 🔒 `api-keys`
  - [ ] Выпуск: `ch_` + `live`/`test` + 32 случайных символа
  - [ ] В БД — только SHA-256 хеш + префикс для отображения (`ch_live_a1b2`)
  - [ ] Полный ключ показывается один раз, при выпуске и перевыпуске
  - [ ] Перевыпуск инвалидирует предыдущий ключ; `last_used_at`
- [ ] **012** 🔒 `public-api`
  - [ ] Bearer-аутентификация по API-ключу
  - [ ] Rate limit token bucket в Redis: гость 5/час (по хешу IP), пользователь 100/сутки, 60 запросов/мин к API
  - [ ] `Idempotency-Key` (UUID, 24 часа) через Redis
  - [ ] Redis недоступен → fail-open для rate limit, fail-closed для проверки сессии/ключа

## Стадия 5 — документация, наблюдаемость, тесты

- [ ] **013** `api-docs`
  - [ ] OpenAPI-схема, сгенерированная из Zod-схем `packages/shared`
  - [ ] Страница `/api-docs`, примеры интеграции (`curl -o`, заголовок `Bearer`)
- [ ] **014** `observability`
  - [ ] `GET /health` и `GET /ready`
  - [ ] `request_id` генерируется на клиенте, интерцептор пробрасывает в заголовок и в лог
  - [ ] Метрики: конвертации по направлению/статусу, гистограмма длительности, доля ошибок по коду, заполненность пула, объём хранилища
- [ ] **015** `testing`
  - [ ] Vitest: валидаторы, автомат зоны загрузки, pipes, расчёт квоты
  - [ ] Testcontainers: транзакции и миграции на настоящем PostgreSQL (Docker уже доступен с 1 стадии)
  - [ ] Playwright: гость конвертирует; пользователь входит и видит файл; файл >10 МБ отклоняется; конвертация при заполненной квоте не сохраняет файл

## Стадия 6 — полный docker compose, `DOCX → PDF`

- [ ] **016** `containerization`
  - [ ] Расширить `docker-compose.yml`: `gotenberg` (без сети наружу, `read_only`, `tmpfs /tmp`, `cap_drop: ALL`, лимит памяти), `minio`
  - [ ] `S3Storage implements Storage`, привязка в DI вместо `LocalDiskStorage` (проверочное свойство: ноль строк в `conversion.service.ts`)
  - [ ] `docker/api.Dockerfile`, multi-stage
  - [ ] `.github/workflows/ci.yml`
- [ ] **018** 🔒 `docx-pdf`
  - [ ] `DocumentEngine implements ConversionEngine` — HTTP POST в Gotenberg
  - [ ] Таймаут `CONVERSION_TIMEOUT`, семафор пула документов (8), ожидание до 10 с → `503` + `Retry-After`
  - [ ] Подключение второй реализации `ConversionEngine` без изменения сигнатуры интерфейса (005) и без изменения `conversion.service.ts`

## Стадия 7 — развёртывание

- [ ] **017** `deployment`
  - [ ] Railway: `api` + `gotenberg` (без публичного домена) + managed Postgres/Redis
  - [ ] Vercel: Angular, Output Directory `dist/web/browser`
  - [ ] `CORS_ORIGIN` — конкретный домен, не `*`
  - [ ] `prisma migrate deploy` при старте контейнера
  - [ ] README для внешнего читателя
