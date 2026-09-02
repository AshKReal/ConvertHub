# REVIEW-FINDINGS.md

Враждебное ревью всего кода, написанного к текущему моменту (фронтенд-фаза стадии 0–3, бэкенд-фаза стадии 4–8 + инфраструктура тестов 015). Дата: 2026-09-01. Метод: чтение исходников с недоверием + точечные проверки curl/psql/redis-cli против живого API.

**Не входит:** 000 (скрипты проверки движков), 013/014/016–018 (ещё не начаты), 023 приёмка.

Статус всех бэкенд-задач в `SPECS.md` — `~` («код написан, приёмка владельцем не пройдена»). Этот файл — рабочий бэклог к той приёмке.

## Легенда

- 🔴 критично — эксплуатируемо/ломает сценарий, чинить до мержа в `main`
- 🟠 серьёзно — реальный дефект или дыра в отказоустойчивости, чинить в ближайший проход
- 🟡 стоит поправить — корректность в краю, безопасность-в-глубину, UX-регресс
- 🟢 мелочь — чистота, микро-оптимизация, косметика

Каждая находка: `[ ]` не сделано · `[x]` закрыто. ID стабильны для ссылок из коммитов/задач.

---

## Что проверено и работает (контекст)

Нет `innerHTML`/`eval`/`bypassSecurityTrust`/`any`/забытых `console.*` (кроме bootstrap). Сравнение секретов — `timingSafeEqual` (подпись ссылок) и argon2 + dummy-hash (тайминг входа). Тип файла — по magic bytes, не по расширению. Имя файла от клиента нигде не путь (случайные `randomUUID`). `state` OAuth и refresh-ротация с окном терпимости. Курсорная пагинация без `OFFSET`. Единый формат ошибок RFC 9457. Модульные границы без циклов. Fail-open rate limit / идемпотентности при `docker compose stop redis` проверен — не 500.

---

## Бэкенд — конвейер конвертации (002/005)

### BE-CONV-01 · 🟠 · Нет предела на размер результата
`apps/api/src/modules/conversion/{conversion.service.ts, engines/*}` — `MAX_FILE_SIZE_BYTES` ограничивает только **вход**. Маленький JPG в пределах 50 Мп → PNG на сотню МБ; `pdf2docx` из хитрого PDF → раздутый DOCX. Уходит телом ответа и, при `save=true`, в `Storage`. Идемпотентный стор капается `MAX_FILE_SIZE_BYTES`, сам ответ — нет.
**Фикс:** проверять `buffer.byteLength` после `engine.convert`, отклонять `FILE_TOO_LARGE`/`CONVERSION_FAILED` с понятным `detail`.
- [ ]

### BE-CONV-02 · 🟠 · `pdf-page-count.validator` без ограничения ресурсов
`validators/pdf-page-count.validator.ts` — `readFile` весь PDF + `PDFDocument.load` (полный разбор pdf-lib) до Python-таймаута. Хитрый PDF (глубокая вложенность, циклы xref) стопорит или OOM'ит этот «дешёвый» пре-чек. Таймаута/лимита глубины нет.
**Фикс:** таймаут вокруг `PDFDocument.load` (Promise.race), либо парсить число страниц более скупо (regex по `/Type /Page`), либо ловить и мапить в `FILE_CORRUPTED` по таймауту отдельно.
- [ ]

### BE-CONV-03 · 🟠 · `ConversionFailureFilter` пишет `userId: null` для всех неуспешных конвертаций
`filters/conversion-failure.filter.ts:51` — `userId: null, // TODO(007)`. 012 сделал API-ключевых пользователей реальными; их упавшие конвертации в `conversions` не атрибутированы. Плюс `INVALID_PARAMETER` (нет файла) пишется как FAILED-конвертация.
**Фикс:** класть `req.convertUserId` в контроллере после `requestIdentity.resolve`, фильтр читает оттуда (как уже читает `req.convertStartedAt`).
- [ ]

### BE-CONV-04 · 🟡 · PDF под паролем → `FILE_CORRUPTED`, а не `FILE_PASSWORD_PROTECTED`
`validators/pdf-page-count.validator.ts` — `PDFDocument.load` бросает на зашифрованном PDF, ловится общим `catch → FILE_CORRUPTED`. В `TECH-SPEC.md` §7.5 есть отдельный код.
**Фикс:** `PDFDocument.load(bytes, { ignoreEncryption: true })` → если `document.isEncrypted` → `FILE_PASSWORD_PROTECTED`.
- [ ]

### BE-CONV-05 · 🟡 · Python-процесс не гарантированно умирает по таймауту
`engines/pdf-to-docx.engine.ts:runPython` — `child.kill()` (SIGTERM), без эскалации в SIGKILL и без убийства детей процесса. Застрявший `pdf2docx` переживает таймаут зомби, держа CPU/память.
**Фикс:** `child.kill('SIGTERM')`, через ~2с `child.kill('SIGKILL')`; на Linux — `spawn(..., { detached: true })` + `process.kill(-child.pid)` для группы.
- [ ]

### BE-CONV-06 · 🟡 · Квота при сохранении из конвертации проверяется вне транзакции
`files.service.ts:saveConversionResult` — пред-чтение `storageUsedBytes` вне `$transaction` (010 «принятая гонка»), тогда как `updateSaveFlag(save=true)` ту же проверку делает **внутри** транзакции. Непоследовательно; путь конвертации тоже можно завести в транзакцию.
- [ ]

### BE-CONV-07 · 🟡 · Нет уборщика осиротевших `os.tmpdir()/convert-hub*`
Падение между загрузкой и `cleanupConvertTempDir` оставляет каталог навсегда. Уборщик 014 нацелен на `Storage`/`files.expiresAt`, не на OS-tmp.
**Фикс:** при старте или по таймеру удалять поддиректории `convert-hub*` старше N часов.
- [ ]

### BE-CONV-08 · 🟢 · `FileInterceptor` без `limits: { files, parts, fields, fieldSize }`
Два поля `file` или флуд мелких полей → `MulterError` (не `LIMIT_FILE_SIZE`) → общий `INTERNAL_ERROR` (500), а не чистый 4xx.
- [ ]

### BE-CONV-09 · 🟢 · Тройная копия файла на диске для `PDF→DOCX`
multer-temp → буфер сервиса → temp движка → Python. Ограничено 10 МБ; сигнатура `ConversionEngine(Buffer)` этого требует. Мелочь, отметить.
- [ ]

### BE-CONV-10 · 🟢 · `stderr` дочернего Python копится без предела
`runPython` — `stderr += chunk`. Патологический вывод растит строку до exit/таймаута. Обрезать после N КБ.
- [ ]

### BE-CONV-11 · 🟢 · `width * height` может превысить `MAX_SAFE_INTEGER`
`validators/pixel-count.validator.ts` — для абсурдных заголовков `actual_pixels` в `meta` будет неточным (сравнение с лимитом всё равно верное).
- [ ]

### BE-CONV-12 · 🟢 · Поле `dpi` (`TECH-SPEC.md` §7.3) молча игнорируется
Нет в `convertRequestSchema`. Ни одного направления с `dpi` пока нет — но контракт расходится с ТЗ.
- [ ]

---

## Бэкенд — хранилище и файлы (003/010)

### BE-FILE-01 · 🟡 · Скачанный файл называется `<ulid>.<ext>`, не оригинальным именем
`storage/local-disk-raw.controller.ts` — `Content-Disposition: filename="${basename(filePath)}"`, а `basename` — системный ключ. Контроллер БД-агностичен и не видит `files.originalFilename`. Реальный S3 presigned URL ставил бы `response-content-disposition`. UX-регресс.
**Фикс:** прокинуть имя параметром подписанной ссылки (в подписи!), либо принять как известный гэп интерим-`LocalDiskStorage` и записать это.
- [ ]

### BE-FILE-02 · 🟡 · `Storage.put` до транзакции БД → возможен осиротевший объект
`files.service.ts:saveConversionResult` — при падении между `put` и `$transaction` объект остаётся (best-effort `delete` в catch не покрывает краш). ARCHITECTURE §9 «ночная сверка» — не построена.
- [ ]

### BE-FILE-03 · 🟡 · `storageUsedBytes` денормализован, сверки нет
`TECH-SPEC.md` §10 обещает ночную сверку `SUM(size_bytes)` — не построена (014). Любой путь, забывший скорректировать поле, тихо уводит квоту.
- [ ]

### BE-FILE-04 · 🟡 · `deleteAccount`: тихо упавший `storage.delete` → объект осиротел навсегда
`auth/account.service.ts:deleteAccount` — best-effort по одному, потом каскад `user.delete()`. Упавшее удаление логируется, но `storageKey` уходит вместе со строкой.
- [ ]

### BE-FILE-05 · 🟢 · Ключ хранилища (`<userId>/<ulid>`) виден в redirect-URL
`getDownloadUrl` возвращает `/v1/storage/local/raw?key=<userId>/...` — раскрывает `userId` владельца. Артефакт интерим-хранилища.
- [ ]

### BE-FILE-06 · 🟢 · «Папка вне репозитория» проверяет только «вне `apps/api`»
`storage/local-disk.storage.ts` — сравнение с `process.cwd()` (= `apps/api`). `LOCAL_STORAGE_DIR=<repo>/storage` пройдёт проверку, но лежит в репозитории.
- [ ]

### BE-FILE-07 · 🟢 · Любой гость с ULID скачает любой гостевой файл
`files.service.ts:getDownloadUrl` — `file.userId === null && requesterId === null` проходит проверку владения. 128-бит ULID + TTL 1ч делают неперебираемым; возможно, так и задумано (шаринг-ссылка), но привязки к сессии нет.
- [ ]

### BE-FILE-08 · 🟢 · Мусорный `cursor` на `GET /v1/files` → пустая страница вместо ошибки
`listFilesQuerySchema.cursor` — `z.string().optional()`, формат ULID не проверяется. Prisma возвращает `[]`. Клиент в замешательстве.
- [ ]

---

## Бэкенд — аутентификация (007/009); 008 — отдельный блок ниже

### BE-AUTH-01 · 🟡 · Остаточный тайминг-оракул в `requestPasswordReset`
`auth/account.service.ts` — существующий email делает 2 лишних записи (`updateMany` + `create`) до ответа; несуществующий — только `findUnique`. `docs/SECURITY.md` §5 закрывает тайминг **письма**, не БД.
**Фикс:** создание токена тоже fire-and-forget, либо компенсирующая задержка, либо всегда «пустая» запись.
- [ ]

### BE-AUTH-02 · 🟡 · `changePassword` без rate limit
`auth/account.service.ts` — украденный 15-мин access-токен перебирает **текущий** пароль (~18k argon2-попыток в окне). `AUTH-RULES.md` §4.3 спорно применим.
- [ ]

### BE-AUTH-03 · 🟡 · `deleteAccount` без повторной аутентификации
Решение владельца (спека 009). Отметка остаточного риска: украденный 15-мин токен = необратимое удаление аккаунта.
- [ ]

### BE-AUTH-04 · 🟢 · `requestPasswordReset`: гашение старых + создание нового не в транзакции
Краш между → у пользователя нет рабочей ссылки (нужен повторный запрос). Параллельные вызовы → 2 живые ссылки.
- [ ]

### BE-AUTH-05 · 🟢 · Нет `.max()` на полях пароля/email
`packages/shared/src/schemas/auth.ts` — опирается на дефолтный лимит тела (~100 КБ). argon2 c Blake2b-prehash делает стоимость ~постоянной. Низко.
- [ ]

---

## Бэкенд — 008 auth-providers (из отдельного враждебного ревью, всё открыто)

### BE-OAUTH-01 · 🔴 · Неподтверждённый Google-email создаёт аккаунт → безусловная цель авто-привязки
`auth/auth.service.ts:loginOrLinkIdentity` — ветка `existingUser === null` создаёт `User` из `profile.email` без проверки `emailVerified`; ветка «email занят» позже безусловно привязывает к нему verified-identity. Pre-hijacking. Детали — в истории ревью 008.
**Фикс:** на ветке создания тоже требовать `emailVerified`, иначе отказ.
- [ ]

### BE-OAUTH-02 · 🟠 · Нет rate limit на `google/start` + неограниченный `OauthStateService` Map
`auth/auth.controller.ts:googleStart` — безавторизационный GET с in-memory побочным эффектом, без `consume()`. **Теперь дёшево:** `RateLimiterService` уже на Redis.
- [ ]

### BE-OAUTH-03 · 🟠 · `fetch()` к Google token/userinfo без таймаута
`auth/google-oauth.service.ts` — зависший эндпоинт Google держит `google/callback` открытым.
- [ ]

### BE-OAUTH-04 · 🟡 · `state` сверяется `===`, отступление не записано в `docs/SECURITY.md`
`auth/auth.controller.ts:resolveGoogleCallback` — комментарий ссылается на SECURITY.md, записи там нет. Либо `timingSafeEqual`, либо §7 в SECURITY.md.
- [ ]

### BE-OAUTH-05 · 🟡 · `?oauthError=` не вычищается из URL (фронт)
`apps/web/.../login-page/login-page.ts` — перезагрузка/закладка `/login?oauthError=failed` перевыдаёт тост.
- [ ]

### BE-OAUTH-06 · 🟡 · `issueSession` всегда делает `identity.findMany`, в т.ч. на `register`
`auth/auth.service.ts` — на `register` результат гарантированно пуст.
- [ ]

---

## Бэкенд — 011 api-keys (из самопроверки, открыто)

### BE-KEY-01 · 🟡 · `reissue` ничем не ограничен → рост отозванных строк
`modules/api-keys/api-keys.service.ts:reissue` — `MAX_ACTIVE_API_KEYS` капает только активные. Цикл reissue плодит отозванные строки без предела.
- [ ]

### BE-KEY-02 · 🟢 · `revoke()` — 2 запроса (`findFirst` + `updateMany`)
Нужен для различения 404/204; можно одним `update … RETURNING`.
- [ ]

### BE-KEY-03 · 🟢 · `markUsed` переписывает `last_used_at` на каждый запрос
Row-lock на горячем ключе. Обновлять условно (`WHERE last_used_at < now() - interval '1 minute'`).
- [ ]

### BE-KEY-04 · 🟢 · Дубль литерала `'ch_live_'` (`KEY_ENV_PART` vs `KEY_PREFIXES[0]`)
- [ ]

---

## Бэкенд — 012 public-api (из отдельного враждебного ревью, всё открыто)

### BE-PUB-01 · 🔴 · `Idempotency-Key` блокируется на 24ч при `429` или неуспешной конвертации
`conversion.controller.ts` + `idempotency.service.ts` — `begin()` ставит `processing` до rate-limit и до конвертации; перезаписывался только на успехе. **Было проверено:** битый файл → ключ застрял → повтор с хорошим файлом → `409` на 24ч. Гостевой `429` тоже оставлял `processing`-замок.
**Фикс:** `IdempotencyService.discard()` (DEL) + `try/catch` вокруг секции после `begin`: на throw, если `holdsLock` — `discard`, затем rethrow; `holdsLock=false` после `complete`.
- [x] Сделано (коммит `012: BE-PUB-01/02 — discard замка на отказе + короткий TTL processing`). Live re-verify — при поднятом Docker в батч-приёмке.

### BE-PUB-02 · 🟠 · Даже с фиксом BE-PUB-01 краш между `begin` и `complete` держит замок 24ч
`idempotency.service.ts` — `ttlMs` (24ч) и для `processing`, и для ответа.
**Фикс:** `PROCESSING_TTL_MS = 90_000` на замок `processing` (≥ таймаут конвертации 60с + запас), 24ч — только на сохранённый ответ (`complete`). `docs/SECURITY.md` §7 переписан («короткий TTL + discard», остаточный риск ≤ 90с).
- [x] Сделано (тот же коммит).

### BE-PUB-03 · 🟠 · Хранилище идемпотентности не ограничено в совокупности
`idempotency.service.ts:complete` — ~13 МБ base64 на результат × 24ч, тот же Redis, что rate limit. Нужно `maxmemory`/eviction при деплое (017) + gzip для документных результатов.
- [ ]

### BE-PUB-04 · 🟡 · Ошибка `JSON.parse` в `deserialize` рапортуется как «Redis недоступен»
`idempotency.service.ts:begin` — `deserialize` внутри общего `try/catch`. Битая/старая запись → неверный лог + тихая переконвертация. Разнести парсинг и Redis-I/O.
- [ ]

### BE-PUB-05 · 🟡 · Реплей отдаёт `X-File-Id` на протухший файл
`conversion.controller.ts:sendResult` — сохранённый `fileId` живёт 1ч, окно идемпотентности 24ч.
- [ ]

### BE-PUB-06 · 🟡 · `RedisModule` логирует каждую попытку переподключения
`common/redis/redis.module.ts:34` — устойчиво лежачий Redis = поток `warn`. Дедуп/бэкофф.
- [ ]

### BE-PUB-07 · 🟡 · fail-open рапортует `X-RateLimit-Remaining: <max>`
`common/rate-limit/rate-limiter.service.ts:96` — при Redis-сбое клиент думает, что квота целая.
- [ ]

### BE-PUB-08 · 🟢 · `raw as [number,number,number,number]` без проверки формы
`rate-limiter.service.ts` — баг Lua-скрипта → `NaN` в `retry_after_seconds`.
- [ ]

### BE-PUB-09 · 🟢 · Альтитуда `conversion.controller.ts` (215 строк + 5 функций)
Identity + идемпотентность + rate limit — кандидат в pipeline/policy-сервис.
- [ ]

### BE-PUB-10 · 🟢 · Двойная уборка temp-каталога (контроллер `finally` + сервис `finally`)
- [ ]

### BE-PUB-11 · 🟢 · Семантика auth-лимита сменилась fixed-window → token bucket
Строже при устойчивом переборе, эквивалент для всплеска. Перечитать критерий приёмки 007.
- [ ]

### BE-PUB-12 · 🟢 · Устаревший docblock `ConcurrencyLimiterService` («Redis зарезервирован под 012»)
Теперь это последний in-memory лимитер, осознанно.
- [ ]

---

## Фронтенд — сессия / auth (007/019/020)

### FE-AUTH-01 · 🟠 · `logout()` не «прилипает» при сетевом сбое
`core/services/auth.ts:logout` — локальное состояние сброшено, `/logout` fire-and-forget. Если запрос упал (офлайн) — HttpOnly refresh-cookie жива → следующий F5 `restoreSession` логинит обратно.
**Фикс:** `await` logout с индикатором, либо очередь на повтор, либо явный «вы вышли, но сервер не подтвердил».
- [ ]

### FE-AUTH-02 · 🟠 · App-init блокирует первую отрисовку на `/refresh` без таймаута
`app.config.ts:provideAppInitializer` — API медленный/лежит → пустой экран на весь HTTP-таймаут (~30с+).
**Фикс:** `Promise.race([restoreSession(), timer(2000)])`.
- [ ]

### FE-AUTH-03 · 🟡 · `restoreSession` и `ensureFreshToken` независимо шлют `/refresh`
`core/services/auth.ts` — запрос, поймавший 401 во время app-init, шлёт второй параллельный `/refresh`; спасает окно ротации сервера (10с). Single-flight это не покрывает.
- [ ]

### FE-AUTH-04 · 🟡 · Кнопка Telegram (`loginAsMockOAuth`) мутирует реальное состояние auth фейковым юзером
`core/services/auth.ts:loginAsMockOAuth` — `authGuard` проходит, юзер на защищённой странице без серверной сессии → 401 → форс-логаут. «Визуальная заглушка» не инертна.
**Фикс:** отключить кнопку (`disabled`) до реальной спеки Telegram, либо вести на «скоро».
- [ ]

### FE-AUTH-05 · 🟡 · Истечение токена посреди `/v1/convert` → интерцептор повторяет исходный `req`
`core/interceptors/auth-interceptor.ts` — полная перезагрузка файла на ретрае.
- [ ]

### FE-AUTH-06 · 🟢 · Полное истечение сессии на защищённой странице не редиректит
Guard срабатывает только на навигации; страница показывает ошибку/пустоту.
- [ ]

### FE-AUTH-07 · 🟢 · `currentAccessToken()` публичен на root-синглтоне
Любой инжектор читает (шаблоны — нет; допустимо по `AUTH-RULES.md`).
- [ ]

---

## Фронтенд — зона загрузки / конвертация (001/006/005)

### FE-CONV-01 · 🟠 · `download()` вызывает `URL.revokeObjectURL` синхронно сразу после `link.click()`
`features/convert/components/dropzone/dropzone.ts:download` — blob-URL инвалидируется до того, как браузер начнёт скачивание; в части браузеров/таймингов скачивание молча не происходит.
**Фикс:** `setTimeout(() => URL.revokeObjectURL(url), 0)` или revoke по событию, `link` добавить в DOM перед `click()`.
- [ ]

### FE-CONV-02 · 🟠 · Поток конвертации не инвалидирует `['me']`
`dropzone.ts` / `convert.api.ts` — после авто-сохранённой конвертации `storageUsedBytes` устаревает → `quotaFull` и полоса квоты врут, пока `['me']` не обновит что-то другое. 010-инвалидация есть только в `files.api.ts`.
**Фикс:** в `handleConvertEvent` на `Response` (или обернуть convert в мутацию) — `queryClient.invalidateQueries({ queryKey: ['me'] })`.
- [ ]

### FE-CONV-03 · 🟡 · Состояние `error` — тупик для `select()`
`dropzone.ts:select` — пока показана ошибка `FILE_TOO_LARGE`, дроп нового валидного файла игнорируется; нужен «повторить».
- [ ]

### FE-CONV-04 · 🟢 · `cancel()` рвёт XHR, но сервер может дозавершить и сохранить файл
Нет сигнала клиент→сервер кроме закрытия сокета → возможен осиротевший сохранённый файл.
- [ ]

### FE-CONV-05 · 🟢 · `Response` с `event.body === null` → `done` с нерабочей кнопкой скачивания
- [ ]

### FE-CONV-06 · 🟢 · `progress` = `NaN%` при `event.total === 0` (гард только на `undefined`)
- [ ]

---

## Фронтенд — каркас / i18n (024/025/027)

### FE-SHELL-01 · 🟡 · `theme-init.js` — внешний `<script src>`, не инлайн
`apps/web/src/index.html` — спека 025 говорит «инлайн-скрипт в index.html». Внешний добавляет блокирующий round-trip до отрисовки → слабее гарантия против мелькания темы. Плюс файл продублирован в двух местах.
**Фикс:** заинлайнить содержимое в `<head>`.
- [ ]

### FE-SHELL-02 · 🟢 · `document.title` зависит от локали, но не от маршрута
`core/services/i18n.ts` — все страницы с одинаковым заголовком; нет `Title`-сервиса.
- [ ]

### FE-SHELL-03 · 🟢 · `formatDate` на невалидной ISO-строке → «Invalid Date»
`core/i18n/format.ts` — нет гарда на `isNaN(date)`.
- [ ]

---

## Не построено (контекст, не дефекты — но несколько находок выше это симптомы)

- **013** OpenAPI из Zod.
- **014** `/health` `/ready`, структурные логи, `request_id` сквозной, метрики, **фоновая уборка истёкших файлов/объектов**, **ночная сверка `storageUsedBytes`**, **сметание осиротевших объектов**. Смягчает: BE-CONV-07, BE-FILE-02, BE-FILE-03, BE-FILE-04.
- **015** реальное покрытие тестами. Сейчас только «раннер работает». **Ноль юнит-тестов** на валидаторы, автомат зоны загрузки, расчёт квоты, auth-потоки. Вся бэкенд-фаза `~` практически без регрессионной сети.
- `environment.prod.ts` `apiUrl: ''` — TODO(017).

---

## Приоритет на первый проход

1. BE-PUB-01 (🔴 идемпотентность), BE-OAUTH-01 (🔴 pre-hijacking) — эксплуатируемо.
2. BE-CONV-01, BE-CONV-02, BE-CONV-03, BE-PUB-02, BE-PUB-03, BE-OAUTH-02/03 — отказоустойчивость/ресурсы.
3. FE-AUTH-01, FE-AUTH-02, FE-CONV-01, FE-CONV-02 — ломают пользовательские сценарии.
4. Остальные 🟡 — по ходу приёмки соответствующих спек.
5. 015 — завести юнит-тесты хотя бы на 🔒-валидаторы и автомат зоны загрузки до того, как этот список начнут разгребать (иначе правки поедут вслепую).
