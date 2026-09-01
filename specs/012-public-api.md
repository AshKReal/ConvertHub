# 012 — public-api

| | |
|---|---|
| Статус | код написан, приёмка владельцем не пройдена |
| Зависит от | 011 |
| Источник | ТЗ п. 6, `TECH-SPEC.md` §6, §7.1, §7.3, §8.1, `ARCHITECTURE.md` §9 |
| Критичность | 🔒 (`apps/api/src/modules/**` обработка ключа/лимитов; сравнение секретов, отказоустойчивость) |

## Задача

Ключи из 011 должны реально что-то открывать: клиент отправляет файл по HTTP с `Authorization: Bearer ch_live_…`
и получает результат, не заходя на сайт. Одновременно сервис обязан защититься от злоупотребления — ограничить
частоту запросов гостя, пользователя и интеграции по ключу — и не выполнять одну и ту же конвертацию дважды,
если клиент повторил запрос из-за обрыва связи.

## Входит

- Аутентификация по API-ключу на публичных маршрутах: `ch_live_…`/`ch_test_…` в `Authorization: Bearer` →
  пользователь, чей это ключ; отметка «ключ использован». Тот же заголовок с токеном сессии продолжает работать.
- Невалидный/отозванный ключ — явный отказ (`401`), не тихий откат к гостю (в отличие от протухшего токена сессии).
- Ограничение частоты, переживающее рестарт процесса и общее между экземплярами: гость — 5 запросов в час,
  пользователь — 100 в сутки, интеграция по ключу — дополнительно 60 запросов в минуту. Ответ несёт заголовки
  остатка лимита; превышение — `429` с указанием, через сколько повторять.
- Существующее ограничение частоты на вход/регистрацию/сброс пароля (007) переносится на тот же механизм —
  временное внутрипроцессное больше не используется.
- Идемпотентность `POST /v1/convert`: заголовок `Idempotency-Key` (UUID). Повтор с тем же ключом в течение
  24 часов возвращает ранее полученный результат, повторной конвертации не происходит.
- Поведение при недоступности хранилища счётчиков: ограничение частоты и идемпотентность отключаются (запрос
  проходит как обычный), проверка ключа и сессии — нет (они не зависят от этого хранилища).

## Не входит

| Что | Где будет |
|---|---|
| `GET /v1/conversions`, `GET /v1/formats`, отдельный `GET /v1/me`, `DELETE /v1/files/{id}` из `TECH-SPEC.md` §7.2 | Не заведены; отдельные задачи, не в 012 |
| Ответ `POST /v1/convert` в виде JSON с `download_url` при `Accept: application/json` (`TECH-SPEC.md` §7.3) | Формат ответа, не аутентификация/лимиты — отдельно, не в 012 |
| Отклонение запросов по HTTP (только HTTPS, `TECH-SPEC.md` §7) | 017 (деплой) |
| Разные лимиты для `test`- и `live`-ключей | 011 отложил различие поведения окружений; не здесь |
| `OpenAPI` / `securitySchemes: http bearer` | 013 |
| Перенос лимита одновременных конвертаций (`ConcurrencyLimiterService`, 005) в общее хранилище | Не в чек-листе 012; один экземпляр (017) — внутрипроцессный счётчик пока корректен. Отдельная задача при мультиэкземплярном развёртывании |

## Поведение

- `POST /v1/convert` с `Authorization: Bearer ch_live_<32>` от действующего ключа → конвертация выполняется от
  имени владельца ключа; если запрос содержит `save=true` — файл сохраняется по квоте владельца (авто-сохранение
  делает только веб-UI на фронте, сервер сохраняет по явному `save=true`, 010). `last_used_at` ключа обновляется.
- Тот же запрос с отозванным, несуществующим или искажённым ключом → `401 INVALID_API_KEY`, конвертации нет.
- `POST /v1/convert` без `Authorization` → гость, как раньше.
- `POST /v1/convert` с токеном сессии (JWT) → как раньше (010): вошедший пользователь, авто-сохранение.
- Гость сделал 6-й запрос за час → `429 RATE_LIMIT_EXCEEDED`, `Retry-After` и `X-RateLimit-*` в ответе.
- Пользователь (сессия или ключ) сделал 101-й запрос за сутки → `429`.
- Интеграция по ключу сделала 61-й запрос за минуту → `429`, даже если суточный лимит ещё не выбран.
- `POST /v1/convert` с `Idempotency-Key: <uuid>` дважды подряд (одинаковый файл или нет — ключ решает) → второй
  ответ идентичен первому (те же байты, те же `X-*`), повторной конвертации нет, счётчик частоты за второй
  запрос не списывается.
- Повтор с тем же `Idempotency-Key`, пока первый запрос ещё выполняется → `409`, не параллельная вторая конвертация.
- `Idempotency-Key` не в формате UUID → `422 INVALID_PARAMETER`.
- Хранилище счётчиков недоступно → запросы проходят без учёта частоты и без идемпотентности; ключи и сессии
  проверяются как обычно.

## Ошибочные сценарии

| Ситуация | Что видит клиент | Код |
|---|---|---|
| Отозванный / несуществующий / искажённый API-ключ в `Authorization` | `401`, тело `problem+json` | `INVALID_API_KEY` |
| Превышен любой из лимитов частоты | `429`, `Retry-After` + `X-RateLimit-*` | `RATE_LIMIT_EXCEEDED` |
| `Idempotency-Key` есть, первый запрос с ним ещё выполняется | `409` | `IDEMPOTENCY_KEY_CONFLICT` |
| `Idempotency-Key` не UUID | `422` | `INVALID_PARAMETER` |
| Хранилище счётчиков недоступно | Запрос обрабатывается штатно (fail-open), в логах — предупреждение | — |

## Критерии приёмки

- [ ] `POST /v1/convert` с `Authorization: Bearer <действующий ch_live_…>` → `200`, файл в `/v1/files` владельца
  ключа; в БД у ключа обновился `last_used_at`
- [ ] Тот же запрос с отозванным ключом и со строкой `ch_live_` + мусор → оба `401 INVALID_API_KEY`, неотличимы
- [ ] `POST /v1/convert` без заголовка → по-прежнему работает как гость; с валидным JWT → как вошедший (010 не сломан)
- [ ] 6 запросов гостя с одного IP за час: 6-й → `429`, `Retry-After` > 0, `X-RateLimit-Remaining: 0`
- [ ] Ключ: 61 запрос за минуту → `429` (минутный лимит), при этом суточный счётчик показывает остаток
- [ ] Лимит auth (`login`/`register`/`forgot-password`) считается тем же механизмом; поведение из 007 не изменилось
  (10 попыток / 10 минут по IP, отдельно по email)
- [ ] `Idempotency-Key` UUID: два одинаковых `POST /v1/convert` подряд → тело второго байт-в-байт равно первому,
  в `conversions` одна запись, второй запрос не списал квоту лимита
- [ ] Повтор с тем же ключом во время выполнения первого → `409 IDEMPOTENCY_KEY_CONFLICT`
- [ ] `Idempotency-Key: not-a-uuid` → `422 INVALID_PARAMETER`
- [ ] Redis остановлен (`docker compose stop redis`): `POST /v1/convert` с валидным ключом → `200` (fail-open),
  в логе предупреждение; `login` с неверным паролем → по-прежнему `401` (проверка не зависит от Redis)
- [ ] `pnpm typecheck` и `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

---

## План

### Решено с владельцем

1. **Область API-ключа** — `POST /v1/convert` + `GET /v1/files` + `GET /v1/files/:id/download`.
   `PATCH /v1/files/:id` (тумблер `save`) остаётся только под сессией (`TECH-SPEC.md` §8.1).
2. **Минутный лимит `API_RATE` (60/мин)** — на пользователя (`rl:api:<userId>`), не на ключ.
3. **Новый код `IDEMPOTENCY_KEY_CONFLICT` (409).**
4. **Хранение ответа идемпотентности** — байты результата в Redis, TTL 24ч, потолок `MAX_FILE_SIZE_BYTES`.
5. **Невалидный/отозванный API-ключ на любом маршруте → `401 INVALID_API_KEY`**, не тихий откат к гостю.
   Протухший/отсутствующий JWT — по-прежнему тихий гость.

### Подход

**Разбор `Authorization` — одна точка.** Новый `common/auth/resolve-request-identity.ts` (чистая функция +
тонкий сервис-обёртка над `ApiKeyService`/`TokenService`): берёт заголовок, различает по префиксу.
`ch_live_`/`ch_test_` → API-ключ: `sha256(значение)` → `apiKey.findFirst({ where: { keyHash, revokedAt: null }, select: { id, userId } })`. Найден → `{ userId, via: 'api-key', apiKeyId }`, плюс fire-and-forget
`update last_used_at` (глушит свои ошибки, как `ConversionHistoryService`). Не найден → `INVALID_API_KEY`.
Иначе → существующий `TokenService.verifyAccessToken` (тихий гость на любой сбой). `ApiKeyService` экспортируется
из `ApiKeyModule` (сейчас нет `exports` — 011 это и предвидел).

**Redis.** `common/redis/redis.module.ts` — единственный клиент `ioredis` как провайдер (`REDIS_CLIENT` токен),
`new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: false })`.
`enableOfflineQueue: false` — команды падают сразу, когда Redis лёг, а не висят: fail-open обязан быть быстрым.
`REDIS_URL` → `config/env.ts` (`z.string().url()`), `apps/api/.env.example`, `docs/SETUP.md` (из «пока не читается»
в активные).

**Ограничение частоты — token bucket в Redis, атомарно (Lua `EVAL`).** `common/rate-limit/rate-limiter.service.ts`
заменяет `fixed-window-rate-limiter.service.ts` целиком, сохраняя сигнатуру `consume(key, { max, windowSeconds })`
(её docblock старого файла это и обещал). Внутри — Lua-скрипт «capacity = max, refill = max/windowSeconds в
секунду»: читает `{tokens, ts}`, доливает по времени, если `< 1` — возвращает `retryAfter`, иначе списывает 1 и
пишет назад с `PEXPIRE`. Ошибка соединения → `catch` → тихо разрешить (fail-open) + `logger.warn` раз в N секунд.
`auth.controller.ts` не меняется (тот же `consume`). На `/v1/convert` guard вызывает `consume` 1–3 раза по
идентичности:

| Кто | Ключи бакетов | Лимиты (`packages/shared`) |
|---|---|---|
| гость | `rl:guest:<ipHash>` | `GUEST_CONVERT_RATE` — 5 / 3600с |
| пользователь (JWT или ключ) | `rl:user:<userId>` | `USER_CONVERT_RATE` — 100 / 86400с |
| ключ дополнительно | `rl:api:<userId>` | `API_RATE` — 60 / 60с |

Ответ (успех и `429`) несёт `X-RateLimit-Limit`/`-Remaining`/`-Reset` по самому узкому бакету; `429` —
`Retry-After` + `AppException('RATE_LIMIT_EXCEEDED', { retry_after_seconds })` (код уже есть). Заголовки — в
`main.ts` `exposedHeaders`.

**Идемпотентность — `IdempotencyService` + вызовы из `ConversionController`.** Заголовок `Idempotency-Key`
валидируется `z.string().uuid()` (в `packages/shared`), scope-ключ `idem:<userId ?? ipHash>:<uuid>`.
На входе: `SET key "processing" NX EX 86400`.
- `NX` прошёл → выполнить конвертацию, затем `SET key <сериализованный ответ> EX 86400` (перезапись
  «processing»), вернуть; за этот запрос лимит частоты списан обычным порядком.
- `NX` не прошёл → `GET key`. `"processing"` → `IDEMPOTENCY_KEY_CONFLICT` (409). Иначе → десериализовать
  `{ mime, fileId?, saveSkippedQuota, bodyBase64 }`, выставить те же заголовки + `X-Idempotent-Replay: true`,
  `res.send(buffer)`; лимит частоты за replay **не** списывается (проверка идемпотентности — до `consume`).
- Redis недоступен на входе → идемпотентность пропускается, обычная обработка (fail-open, принятый риск «двойная
  конвертация», `ARCHITECTURE.md` §9).
Тело — в контроллере (у него уже `result.buffer` и формирование заголовков), не в интерцепторе: `@Res()`-ответ
бинарный, перехватывать поток сложнее, чем вызвать сервис до и после.

**Порядок в конвейере `/v1/convert`:** Multer-интерцептор (уже есть, лимит `MAX_FILE_SIZE_BYTES` он же и держит) →
тело обработчика: resolve identity → (idempotency: replay? → выход, temp-файл чистится в `finally`) → rate-limit
`consume` → существующая обработка → (idempotency: store) → ответ. Идемпотентная проверка после Multer, а не до:
Multer — интерцептор, выполняется раньше тела; guard до него не читает `Idempotency-Key` из тела и не делает
«store после». Цена — на replay клиент зря догружает файл (≤10 МБ); при ретрае из-за обрыва он его пересылает
всё равно, так что это не лишняя работа сверх самого ретрая. Отмечено в рисках.

### Затрагиваемые файлы

Бэкенд, новые: `common/redis/redis.module.ts`, `common/auth/request-identity.ts` (+ сервис),
`common/rate-limit/rate-limiter.service.ts` (замена `fixed-window-rate-limiter.service.ts`),
`modules/conversion/idempotency.service.ts`, `common/rate-limit/rate-limit-headers.ts`.
Бэкенд, изменённые: `config/env.ts` (`REDIS_URL`), `apps/api/.env.example`, `docs/SETUP.md`, `docs/AUTH.md`
(API-ключ как второй Bearer + таблица лимитов), `docs/SECURITY.md` (снять §3 про временный лимитер),
`app.module.ts` (`RedisModule` глобально), `modules/auth/auth.module.ts` (+ `exports: [ApiKeyService]` в
`ApiKeyModule`, импорт в нужные модули), `modules/conversion/conversion.controller.ts` +
`conversion.module.ts`, `modules/files/files.controller.ts` + `files.module.ts` (combined guard — по решению 1),
`main.ts` (`exposedHeaders`), `common/rate-limit/*` (удаление старого файла).
`packages/shared`: `constants/limits.ts` (`GUEST_CONVERT_RATE`/`USER_CONVERT_RATE`/`API_RATE`/`IDEMPOTENCY_TTL_SECONDS`),
`constants/error-codes.ts` (`IDEMPOTENCY_KEY_CONFLICT`), `schemas/convert.ts` (`idempotencyKeySchema`).
Фронт: не затрагивается (веб ходит с сессией, лимиты для него уже действуют через ту же механику; заголовки
`X-RateLimit-*` веб не читает).

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| Отдельный `passport`-стратегия для API-ключа | Разбор — три строки (префикс, `sha256`, `findFirst`); стратегия и зависимость ради этого не нужны, тот же довод, что 007 привёл против `@nestjs/passport` | — |
| Для идемпотентности хранить `{conversionId, storageKey, mime}`, до-стримить из `Storage` | Гостевой и `save:false` результат живёт 1ч (`ARCHITECTURE.md` §11), окно идемпотентности — 24ч: replay после истечения отдал бы `404`. Байты в Redis — единственный способ выдержать все 24ч | Если появится долгоживущее хранение всех результатов |
| Оставить `FixedWindowRateLimiterService` для auth, Redis — только для `/v1/convert` | Два механизма лимита в одном сервисе; `docs/SECURITY.md` §3 прямо помечает внутрипроцессный как временный «до 012». Одна замена с той же сигнатурой проще | — |
| Rate limit как `@Injectable()` guard с метаданными на маршруте | `/v1/convert` уже `@Res()` + фильтры + интерцептор; ещё один guard с чтением `Reflector` усложняет и без того плотный конвейер. Явный вызов `consume()` в теле (как в `auth.controller.ts`) виден по месту | Если лимит понадобится на десятке маршрутов с разными конфигами |
| Идемпотентность как глобальный интерцептор | `@Res()`-ответ бинарный: перехват исходящего потока сложнее и хрупче, чем вызвать `IdempotencyService` до/после в контроллере, где `buffer` уже на руках | — |
| `redis` (node-redis) вместо `ioredis` | Решение владельца — `ioredis`: зрелее для Lua/`eval` и пайплайнов, больше готовых примеров token bucket | — |
| Скользящее окно (sorted set) вместо token bucket | ТЗ §6 и docblock старого лимитера прямо называют token bucket; sorted set дороже по памяти (запись на каждый запрос) без выигрыша здесь | — |

### Риски и границы транзакций

- **Token bucket — atomic Lua**, иначе два параллельных запроса оба прочитают «1 токен» и оба спишут. Скрипт
  делает read-modify-write внутри одного `EVAL`.
- **Идемпотентность — `SET NX` как замок.** Гонка двух одновременных первых запросов: `NX` выиграет один,
  второй получит `"processing"` → `409`. Если процесс упадёт между `NX` и записью ответа — замок висит до
  `EX 86400`, все 24ч повторы будут `409`. Принятый компромисс (лучше, чем повторная конвертация); альтернатива
  (короткий TTL на «processing», отдельный на ответ) усложняет без явной надобности — отметить в `docs/SECURITY.md`.
- **`last_used_at`** — fire-and-forget `update`, не в транзакции с конвертацией: потеря этой записи при сбое БД
  не должна ронять успешный ответ клиенту (тот же приём, что `ConversionHistoryService`).
- **Fail-open** осознанно ослабляет защиту от перебора при недоступном Redis (`ARCHITECTURE.md` §9: «отсутствие
  проверки частоты допустимо»). Проверка ключа/пароля — Postgres/argon2/JWT, Redis не на пути, fail-closed
  соблюдается по построению.
- **Замена лимитера auth** — тот же вызов `consume(key, {max, windowSeconds})`, но семантика fixed-window →
  token bucket: «10 за 10 минут» станет «капля 1 токен каждые 60с, ёмкость 10». Всплеск в 10 подряд по-прежнему
  проходит, дальше — по refill. Поведенчески близко, но не тождественно; отметить в критерии приёмки 007.

### Мои тест-кейсы

*(владелец пишет свои прозой до кода)*

- Действующий ключ: `POST /v1/convert` → `200`, файл на `/v1/files` владельца, `last_used_at` не `null`.
- Отозвать ключ (`DELETE /v1/api-keys/:id`), тот же запрос → `401 INVALID_API_KEY`. `ch_live_` + мусор → тот же `401`.
- Без заголовка → гость (старое поведение), с JWT → вошедший (010 не сломан).
- Гость, 6 запросов за час с одного IP → 6-й `429`, `X-RateLimit-Remaining: 0`, `Retry-After` в диапазоне (0, 3600].
- Ключ, 61 запрос за минуту → `429` по `rl:api`, при этом `rl:user` (суточный) ещё не выбран.
- `login` неверным паролем 11 раз за 10 минут → 11-й `429` (auth-лимит на новом механизме).
- Два `POST /v1/convert` с одинаковым `Idempotency-Key` подряд → тела равны байт-в-байт, `X-Idempotent-Replay: true`
  на втором, в `conversions` одна строка, `rl:user` уменьшился на 1, не на 2.
- `Idempotency-Key` во время выполнения первого (медленный `PDF→DOCX`) → второй сразу `409`.
- `Idempotency-Key: 123` → `422 INVALID_PARAMETER`.
- `docker compose stop redis` → `POST /v1/convert` действующим ключом `200` + `logger.warn`; `login` неверным
  паролем → `401` (не `500`, не «пропустило»). `docker compose start redis` → лимиты снова считаются.
- Redis лёг ровно между `SET NX` и записью ответа (убить контейнер в нужный момент / мок) → replay даёт `409`
  все 24ч; задокументировано.

---

## Чек-лист

- [x] `common/redis/redis.module.ts` (`ioredis@6`, `REDIS_CLIENT`, `enableOfflineQueue: false`, `error`-handler, `onApplicationShutdown`), `REDIS_URL` в `env.ts`/`.env.example`/`docs/SETUP.md`
- [x] `packages/shared`: `GUEST_CONVERT_RATE`/`USER_CONVERT_RATE`/`API_RATE`/`IDEMPOTENCY_TTL_SECONDS`, `IDEMPOTENCY_KEY_CONFLICT` (409), `idempotencyKeySchema`
- [x] `common/rate-limit/rate-limiter.service.ts` — token bucket на Lua `EVAL`, `consume()` совместим (возвращает `RateLimitResult`), fail-open; `fixed-window-rate-limiter.service.ts` удалён; `auth.module.ts`/`auth.controller.ts` (`await consume`) на новый сервис
- [x] `ApiKeyModule` экспортирует `ApiKeyService` + `RequestIdentityService`; `common/auth/request-identity.service.ts` — `resolve(header)` → guest ∨ session ∨ api-key, `INVALID_API_KEY` на плохой ключ, fire-and-forget `markUsed`
- [x] `conversion.controller.ts` — resolve identity, `consume()` 1–3 бакета, `X-RateLimit-*` (в т.ч. на `429`); `main.ts` `exposedHeaders`; `conversion-failure.filter.ts` не пишет в историю `RATE_LIMIT_EXCEEDED`/`IDEMPOTENCY_KEY_CONFLICT`/`INVALID_API_KEY`; `all-exceptions.filter.ts` — заголовок `Retry-After`
- [x] `idempotency.service.ts` + вызовы из `conversion.controller.ts` (replay до `consume`, store после), `409` на `processing`, fail-open; `try/finally` в контроллере чистит temp-каталог на путях replay/`409`/`429`
- [x] `files.controller.ts` (`GET /v1/files` — жёстко, download — опционально) на `RequestIdentityService`; `PATCH` остаётся под `JwtGuard`; `files.module.ts` + `ApiKeyModule`
- [x] `docs/AUTH.md` (раздел «Ключ в публичном API», таблица бакетов), `docs/SECURITY.md` (§3 «закрыто спекой 012», §7 замок идемпотентности)
- [x] Ручная проверка: curl (ключ/JWT/гость, guest 429, минутный лимит по 80 параллельным, auth-лимит, идемпотентность replay/409/422, Redis stop/start) + SELECT `last_used_at`/`conversions` — 10/10 групп

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### Для 🔒 — дополнительно

- [x] Найдены **все** места, где данные попадают в систему: `Authorization` (ключ/JWT), `Idempotency-Key` из
  заголовка (Zod UUID, иначе `INVALID_PARAMETER`), `req.ip` для `ipHash` (через `hashIp`), тело/файл `/v1/convert` (без изменений)
- [x] Сравнение секретов постоянно по времени: ключ ищется `WHERE keyHash = ?` по `@unique` индексу (точный
  индексированный матч, тайминг не о содержимом — довод `RefreshToken`/`ApiKey`, 007/011); argon2/JWT — без изменений
- [x] Тип файла по сигнатуре — без изменений (002/005)
- [x] Имя файла от клиента как путь — не относится
- [x] Каждый `catch` различает причины: `INVALID_API_KEY` (ключ) ≠ гость (нет заголовка) ≠ `429` ≠ `409`;
  ошибка Redis в лимитере/идемпотентности → fail-open (лог `warn`), не 500 — проверено `docker compose stop redis`
- [x] В лог не попадают: полное значение ключа, содержимое ответа; `ipHash`, не полный IP. `RateLimiterService`/
  `IdempotencyService` логируют только текст ошибки соединения
- [x] Ошибка не раскрывает существование: `INVALID_API_KEY` одинаков для отозванного и несуществующего ключа — проверено
- [x] Ресурсы освобождаются в `finally` — temp-каталог `/v1/convert` теперь в `try/finally` контроллера (покрывает
  replay/`409`/`429`, где `ConversionService` не вызывается); Redis-клиент один долгоживущий, `onApplicationShutdown` → `quit()`

### После мержа

- [ ] Решения-долгожители → `TECH-SPEC.md`: `ioredis` как клиент, token bucket + fail-open + замок идемпотентности
  (значения лимитов уже в §6); `ARCHITECTURE.md` §4.3 — `REDIS_URL` теперь реально читается
- [ ] Статус в реестре обновлён
- [ ] Ошибки агента записаны в `AI-JOURNAL.md`
