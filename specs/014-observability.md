# 014 — observability

| | |
|---|---|
| Статус | код написан, приёмка владельцем не пройдена |
| Зависит от | 026 |
| Источник | ТЗ п. 9.2, `TECH-SPEC.md` §7.2 («`/health` `/ready`»), §12 («Наблюдаемость»), `ARCHITECTURE.md` §8, §9 |
| Критичность | обычная (но правит `AllExceptionsFilter` и конвейер конвертации — см. план) |

## Задача

Когда сервис задеплоен, нужно снаружи понимать три вещи: жив ли процесс и готов ли он принимать трафик
(площадка развёртывания перезапускает и переключает трафик по этим сигналам); что произошло с конкретным
запросом, который упал у пользователя (сквозной идентификатор в логе и в ответе); как ведёт себя система в
целом — сколько конвертаций, какой длительности, какая доля ошибок, сколько занято хранилища. Сейчас логи —
человекочитаемый текст без структуры, идентификатора запроса в них нет, `/health` не существует, метрик нет.

## Входит

- Маршрут проверки живости: отвечает мгновенно, ничего не проверяет — процесс отвечает, значит жив
- Маршрут готовности: проверяет базу и хранилище счётчиков; недоступна база → «не готов»; недоступно
  хранилище счётчиков → «готов, но деградировал» (запросы всё равно обслуживаются, `ARCHITECTURE.md` §9)
- Сквозной идентификатор запроса: генерируется на клиенте, уходит заголовком, попадает в каждую строку лога
  про этот запрос и возвращается заголовком ответа; если клиент не прислал — сервер генерирует свой. В теле
  ошибки он уже есть (026) — теперь совпадает с логовым
- Структурные логи: каждая строка — машиночитаемая запись с идентификатором запроса, методом, путём, статусом,
  длительностью, уровнем. В лог по-прежнему не попадают: пароли, полные ключи, токены, cookie, содержимое
  файлов, полные IP (`critical-zones.md`). Служебные маршруты (живость/готовность/метрики) в поток
  запрос-логов не пишутся — иначе опрос площадки затопит лог
- Метрики в стандартном для сбора формате, за отдельным маршрутом: число конвертаций по направлению и статусу,
  гистограмма длительности конвертации, число ответов-ошибок по коду, число конвертаций «в работе» прямо
  сейчас, суммарный объём хранилища, плюс базовые метрики процесса (память, задержка event loop)

## Не входит

| Что | Где будет |
|---|---|
| Распределённый трейсинг (OpenTelemetry spans, контекст между сервисами) | Не заявлено; отдельная задача при появлении второго сервиса |
| Дашборды, алерты, Grafana/Alertmanager | Площадка развёртывания (017) или вручную поверх `/metrics` |
| Отгрузка/ротация логов, агрегатор | Пишем в stdout — площадка собирает (`ARCHITECTURE.md` §10) |
| Аудит действий пользователя (кто что удалил) | Не про наблюдаемость инфраструктуры; отдельная задача |
| Логирование тел запросов/ответов | Намеренно нет: секреты + размер (`critical-zones.md`) |
| `request_id` в строках БД (`conversions`, `files`) | Не заявлено; лога достаточно для трассировки |
| Пул документных конвертаций (8, Gotenberg) в метрике заполненности | 018 — Gotenberg и его семафор появятся там; сейчас метрика «в работе» считает по лимитеру одновременности (005) |
| Health-проверка объектного хранилища | `LocalDiskStorage` (003) — локальная папка, «недоступность» не сетевая; `S3Storage` (016) добавит свою проверку |

## Поведение

- `GET /health` без заголовков → `200`, тело `{ "status": "ok" }`, отвечает даже если база и Redis лежат.
- `GET /ready` со всеми поднятыми подсистемами → `200`, `{ "status": "ok", "checks": { "db": "up", "redis": "up" } }`.
- `GET /ready` при остановленной базе → `503`, `{ "status": "down", "checks": { "db": "down", "redis": "up" } }`.
- `GET /ready` при остановленном Redis, база жива → `200`, `{ "status": "degraded", "checks": { "db": "up", "redis": "down" } }`.
- Любой запрос к `/v1/*` → в stdout одна структурная строка: `{ level, time, req_id, method, url, status, duration_ms }`;
  `req_id` совпадает с заголовком `X-Request-Id` ответа и с полем `request_id` в теле ошибки, если она была.
- Запрос с `X-Request-Id: <своё значение>` → это же значение в логе и в ответе; без заголовка → сервер
  подставляет `req_<…>`.
- `GET /health`, `/ready`, `/metrics` → в поток запрос-логов не попадают.
- `GET /metrics` (с токеном, см. план) → `200`, `text/plain`, метрики в формате сборщика; конвертация,
  завершившаяся за это время, отражена в счётчике и гистограмме; ответ-ошибка — в счётчике ошибок по коду.
- Grep по логам за час работы: ни `argon2`, ни `ch_live_`, ни `Bearer ey…`, ни полного IP, ни `Set-Cookie`.

## Ошибочные сценарии

| Ситуация | Что видит клиент | Код |
|---|---|---|
| `GET /ready`, база недоступна | `{ status: down, checks }` | `503` |
| `GET /ready`, Redis недоступен, база жива | `{ status: degraded, checks }` | `200` |
| `GET /metrics` без/с неверным токеном (если гейт включён) | Пусто | `401` |
| Проверка в `/ready` не уложилась в таймаут | Подсистема помечена `down` | `503`/`200` по правилу выше |

## Критерии приёмки

- [ ] `curl /health` → `200 {"status":"ok"}` и при `docker compose stop postgres redis` — тоже `200`
- [ ] `curl /ready` при поднятых сервисах → `200 status:ok`; `docker compose stop postgres` → `503 status:down`, `db:"down"`; вернуть, `docker compose stop redis` → `200 status:degraded`, `redis:"down"`
- [ ] `curl -H "X-Request-Id: test-123" /v1/formats` (или любой `/v1/*`) → ответ несёт `X-Request-Id: test-123`; в stdout строка с `req_id":"test-123"`; без заголовка — `X-Request-Id: req_<...>` и то же в логе
- [ ] Ошибочный запрос (например `POST /v1/convert` без файла) → `request_id` в теле `problem+json` = `X-Request-Id` ответа = `req_id` в строке лога
- [ ] Строки лога — валидный JSON (`... | jq .` не падает); поля `level`, `time`, `req_id`, `method`, `url`, `status`, `duration_ms` присутствуют на запрос-логах
- [ ] В логах за прогон всех остальных критериев: `grep -E "argon2\$?[a-z]|ch_live_|Bearer eyJ|refresh_token=|password"` — пусто; IP-адресов в чистом виде нет
- [ ] `/health`, `/ready`, `/metrics` не порождают строк запрос-лога
- [ ] `curl /metrics` → `text/plain`, содержит `converthub_conversions_total`, `converthub_conversion_duration_seconds`, `converthub_http_errors_total`, `converthub_conversions_in_flight`, `converthub_storage_used_bytes` и дефолтные `process_*`/`nodejs_*`
- [ ] Сделать одну конвертацию `JPG→PNG` и один упавший запрос → в `/metrics` `converthub_conversions_total{direction="jpg-to-png",status="COMPLETED"}` вырос на 1, `converthub_http_errors_total{code="INVALID_PARAMETER"}` вырос
- [ ] `converthub_storage_used_bytes` = `SELECT SUM(storage_used_bytes) FROM users`
- [ ] Фронт: `X-Request-Id` уходит с каждым API-запросом (виден в Network); `errorInterceptor` продолжает читать `request_id` из тела
- [ ] `pnpm typecheck` и `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

---

## План

### Решено с владельцем

1. **Health — руками, без `@nestjs/terminus`** (две проверки: `SELECT 1`, `PING`).
2. **`/ready` при Redis-down → `200 degraded`** (не `503`); `503` только при недоступной базе.
3. **`/metrics` за `METRICS_TOKEN`** (`Authorization: Bearer`, иначе `401`).
4. **`request_id` клиента = `req_<crypto.randomUUID()>`**; сервер при отсутствии — `req_<ulid()>`.
5. **Зависимости:** `nestjs-pino@^5.1.0` + `pino@^10` + `pino-http@^11` (рантайм), `pino-pretty@^13` (dev),
   `@prometheus-io/client@^0.16.1` (переименованный `prom-client`, тот же API — `prom-client@15` помечен
   deprecated «replaced by @prometheus-io/client»).

### Подход

**Логи — `nestjs-pino`.** `LoggerModule.forRoot({ pinoHttp: {...} })` в `AppModule`; `main.ts` —
`NestFactory.create(AppModule, { bufferLogs: true })` + `app.useLogger(app.get(Logger))`. Тогда и `pino-http`
(строка на каждый запрос), и `this.logger` во всех сервисах пишут один JSON-поток.

- `genReqId: (req, res) => { const h = req.headers['x-request-id']; const id = (typeof h === 'string' && h) || \`req_\${ulid()}\`; res.setHeader('X-Request-Id', id); return id; }` — заголовок ответа ставится здесь же.
- `customProps: (req) => ({ req_id: req.id })` — плоское поле в каждой строке (не только в объекте `req`).
- `autoLogging: { ignore: (req) => ['/health', '/ready', '/metrics'].includes(req.url.split('?')[0]) }`.
- `serializers.req` — свой: `{ method, url }` и **без** `headers`, `remoteAddress`, `remotePort`. `serializers.res` — `{ statusCode }`.
- `redact` — страховка на случай, если что-то логируется вручную с объектом запроса: `['req.headers.authorization', 'req.headers.cookie', 'req.headers["idempotency-key"]', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword']`, `censor: '[redacted]'`.
- `level: env.LOG_LEVEL ?? 'info'`.
- `transport` только при `NODE_ENV !== 'production'`: `{ target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }`. В проде — сырой JSON в stdout.
- `AllExceptionsFilter.requestId()` — сперва `req.id` (его ставит `pino-http`), потом заголовок, потом генерация. Так `request_id` в теле ошибки = `req_id` в логе гарантированно.

**Health — `modules/health/`** (свой маршрут — условие `backend.md`): `health.controller.ts` (`@Get('health')`,
`@Get('ready')`), `health.service.ts`:
- `checkDb()` — `prisma.$queryRawUnsafe('SELECT 1')` в `Promise.race` с таймаутом 1с.
- `checkRedis()` — `redis.ping()` в `Promise.race` с таймаутом 1с (нужен `RedisModule` в `imports`).
- `/ready`: `db` вниз → `503 { status: 'down' }`; `db` вверх, `redis` вниз → `200 { status: 'degraded' }`; всё вверх → `200 { status: 'ok' }`. Тело всегда `{ status, checks: { db, redis } }`.
- Оба — вне `/v1`, без guard. `@Header('Cache-Control', 'no-store')`.

**Метрики — `@Global() MetricsModule` + `MetricsService`** (как `PrismaModule`: инфраструктура нужна из
`conversion`, `exceptions`, `health`; `@Global` — тот же прецедент). `prom-client` `Registry` — один экземпляр в
сервисе, не глобальный синглтон библиотеки (тестируемость). `collectDefaultMetrics({ register })`.
- `conversionsTotal` — `Counter`, labels `direction`, `status`. `.inc()` в `ConversionHistoryService.recordConversion` (уже единая точка записи любой конвертации, успешной и нет).
- `conversionDuration` — `Histogram`, label `direction`, buckets `[0.05, 0.1, 0.3, 1, 3, 8, 30]` (с. — под §2.1 времена). Там же.
- `httpErrorsTotal` — `Counter`, label `code`. `.inc()` в `AllExceptionsFilter.catch` после `classify()` (тоже единая точка).
- `conversionsInFlight` — `Gauge`. `ConcurrencyLimiterService` получает `MetricsService` (или отдаёт число, а `MetricsService` читает через `collect`): на `acquire`/`release` — `.inc()`/`.dec()`. Проще: `collect`-колбэк гейджа спрашивает `concurrencyLimiter.totalActive()` — новый геттер, сумма `Map`.
- `storageUsedBytes` — `Gauge` с `collect` = `prisma.user.aggregate({ _sum: { storageUsedBytes: true } })`. Один запрос на скрейп.
- `metrics.controller.ts` — `@Get('metrics')`, проверка `Authorization: Bearer ${env.METRICS_TOKEN}` через `timingSafeEqual` (это сравнение секрета — `critical-zones.md`), иначе `UNAUTHENTICATED`. `res.type(register.contentType).send(await register.metrics())`.

**Фронт — `core/interceptors/request-id-interceptor.ts`:** `req.clone({ setHeaders: { 'X-Request-Id': \`req_\${crypto.randomUUID()}\` } })` для запросов на `environment.apiUrl`. Порядок в `withInterceptors` — первым (до `errorInterceptor`/`authInterceptor`), чтобы заголовок был на ретраях тоже. `errorInterceptor` не трогаем — он и так читает `request_id` из тела.

**`main.ts` / env / CORS:** `bufferLogs`, `useLogger`; `env.ts` += `LOG_LEVEL` (optional enum), `METRICS_TOKEN`
(min 16); `.env.example`/`docs/SETUP.md`; CORS `exposedHeaders` += `X-Request-Id`, `allowedHeaders` явно
включает `X-Request-Id` (кастомный request-заголовок → preflight).

### Затрагиваемые файлы

Бэкенд, новые: `common/logging/logger.config.ts` (фабрика `pinoHttp`-опций), `modules/health/{health.module,health.controller,health.service}.ts`, `modules/metrics/{metrics.module,metrics.service,metrics.controller}.ts`.
Бэкенд, изменённые: `main.ts`, `app.module.ts` (`LoggerModule`, `HealthModule`, `MetricsModule`), `config/env.ts`, `apps/api/.env.example`, `apps/api/package.json` + `pnpm-lock.yaml`, `common/filters/all-exceptions.filter.ts` (`req.id` + `httpErrorsTotal.inc`), `modules/conversion/conversion-history.service.ts` (`conversionsTotal`/`conversionDuration`), `modules/conversion/concurrency-limiter.service.ts` (`totalActive()`), `modules/conversion/conversion.module.ts` (импорт `MetricsModule` не нужен — `@Global`), `docs/SETUP.md`, `docs/AUTH.md` (строка про `/metrics` за токеном).
Фронт, новые: `core/interceptors/request-id-interceptor.ts`.
Фронт, изменённые: `app.config.ts` (`withInterceptors` порядок).
`packages/shared` — не затрагивается.

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| `@nestjs/terminus` для health | Зависимость + паттерн health-indicator ради `SELECT 1` и `PING`; `backend.md` — абстракция только когда оправдана | Если проверок станет 5+ и появятся готовые индикаторы (Prisma/Redis/disk) |
| Оставить дефолтный `Logger` Nest, добавить только request-id | ТЗ §12 требует именно структурные (машиночитаемые) логи; форматированный текст не парсится сборщиком | — |
| `pino` напрямую, без `nestjs-pino` | Пришлось бы руками писать `pino-http`-middleware, мост к `LoggerService` Nest, DI — `nestjs-pino` это ровно и делает, это его задача | — |
| Метрики как модульные синглтоны `prom-client` (глобальный `register`) | Работает, но состояние переживает между тестами и не инъектится; `@Global MetricsService` со своим `Registry` — тестируемо и в стиле `PrismaModule` | — |
| `/metrics` открытый наружу | Раскрывает объёмы (число пользователей, конвертаций, ошибок по кодам) и кардинальность лейблов; токен дёшев | Если появится приватная сеть для скрейпа (017) — токен можно снять |
| `request_id` генерирует только сервер | ТЗ §12/`ARCHITECTURE.md` §8 прямо: генерируется на клиенте — тогда трасса начинается с фронта, не с входа в API | — |
| Логировать тело запроса на ошибке (для отладки) | `critical-zones.md`: в лог не попадает содержимое; тело `/v1/convert` — файл, тело `/v1/auth/*` — пароли | — |
| `converthub_storage_used_bytes` инкрементально (счётчик в памяти) | Разъедется с БД при рестарте и при денормализации `storage_used_bytes` (010); `collect`-запрос на скрейп — источник правды | — |

### Риски и границы

- **Правки в `ConversionHistoryService` и `AllExceptionsFilter`** — только `metrics.*.inc()` рядом с уже
  существующей записью; логика ответа/истории не меняется. `AllExceptionsFilter` — 026, не 🔒, но общий для
  всего API: `.inc()` обёрнут так, чтобы сбой prom-client (не бывает, но) не мешал отдать ответ.
- **`pino-http` и `@Res()`-маршруты** (`/v1/convert`, download, `/v1/openapi.json` в 013 если смержится) — `pino-http`
  вешает `res.on('finish')`, с ручным `res.send()` это работает штатно; проверить, что `duration_ms` и `status`
  логуются на бинарных ответах.
- **`bufferLogs: true`** — логи до инициализации `LoggerModule` буферизуются и сбрасываются после; ошибка
  старта (например, `env.ts` бросил) всё равно видна.
- **`redact` пути** — если структура объекта запроса у `pino-http` иная (`req.raw.headers` vs `req.headers`),
  редакция промахнётся; проверяется критерием про `grep` по логам.
- **Health-таймаут 1с** — при медленной, но живой базе `/ready` может ложно сказать `down` и площадка
  перезапустит контейнер. 1с для `SELECT 1` с запасом; вынести в константу.
- CORS: `X-Request-Id` как request-заголовок вызовет preflight на каждый API-запрос с фронта — уже так для
  `Authorization`, лишнего раунда не добавится.

### Мои тест-кейсы

*(владелец пишет свои прозой до кода)*

- `docker compose stop postgres` → `/health` `200`, `/ready` `503 db:down`. `start` → `/ready` `200`.
- `docker compose stop redis` → `/ready` `200 degraded redis:down`, `/health` `200`, `POST /v1/convert` валидным
  ключом всё ещё `200` (fail-open не сломан).
- `curl -H "X-Request-Id: abc-123" http://localhost:3000/v1/openapi.json` → заголовок ответа `X-Request-Id: abc-123`,
  в stdout строка с `"req_id":"abc-123"`, `"url":"/v1/openapi.json"`, `"status":200`.
- `POST /v1/convert` без файла → тело `problem+json` `request_id` == `X-Request-Id` ответа == `req_id` строки лога.
- Прогнать логин с неверным паролем, выпуск ключа, конвертацию, скачивание → `cat log | jq -r '.msg,.req_id'`
  не падает; `grep -iE 'argon2|ch_live_[a-z0-9]{6}|bearer eyj|refresh_token|"password"'` по логу — пусто.
- 10 запросов к `/health` подряд → в логе ноль новых строк запрос-лога.
- Конвертация `JPG→PNG` + `POST /v1/convert` без файла → `/metrics`: `converthub_conversions_total{direction="jpg-to-png",status="COMPLETED"} 1`, `converthub_http_errors_total{code="INVALID_PARAMETER"}` ≥ 1, `converthub_conversion_duration_seconds_count{direction="jpg-to-png"} 1`.
- `/metrics` без `Authorization` → `401`; с `Bearer $METRICS_TOKEN` → `200 text/plain`.
- Три параллельных медленных `PDF→DOCX` → `converthub_conversions_in_flight` во время выполнения = 3, после = 0.
- `converthub_storage_used_bytes` == `psql -c "select coalesce(sum(storage_used_bytes),0) from users"`.
- Фронт: открыть любой экран с сетью, в Network у запроса к API есть `X-Request-Id: req_<uuid>`.

---

## Чек-лист

- [x] `apps/api`: `nestjs-pino`+`pino`+`pino-http` (рантайм), `pino-pretty` (dev), `@prometheus-io/client` (переименованный `prom-client`)
- [x] `common/logging/logger.config.ts` — фабрика `pinoHttp`-опций (`genReqId` + `X-Request-Id` ответа, `autoLogging.ignore` `/health`/`/ready`/`/metrics`, свои `serializers` без `headers`/`remoteAddress`, `redact`, `pino-pretty` только вне прода); `LoggerModule.forRoot` в `AppModule`; `main.ts` `bufferLogs`+`useLogger`
- [x] `all-exceptions.filter.ts` — `requestId()` через `req.id` (pino) → заголовок → генерация; `httpErrorsTotal.inc({ code })`
- [x] `modules/health/` — `/health` (мгновенно `ok`), `/ready` (db → `503 down` / redis → `200 degraded`), таймаут 1с; `app.module.ts`
- [x] `modules/metrics/` — `@Global`, свой `Registry` + `collectDefaultMetrics`, пять custom-метрик, `/metrics` за `METRICS_TOKEN` (`timingSafeEqual`); `env.ts` += `LOG_LEVEL`/`METRICS_TOKEN`, `.env.example`/`.env`, `docs/SETUP.md`, `docs/AUTH.md`
- [x] Хуки метрик: `ConversionHistoryService` (`conversionsTotal`/`conversionDuration`), `ConcurrencyLimiterService` inc/dec (`conversionsInFlight`), `storageUsedBytes` через `refreshDynamicGauges()` перед скрейпом (не `collect` — нужен DI `PrismaService`)
- [x] Фронт: `core/interceptors/request-id-interceptor.ts` первым в `app.config.ts`; CORS `exposedHeaders` += `X-Request-Id` (`allowedHeaders` не трогаем — `cors` отражает запрошенные)
- [x] Ручная проверка (curl + docker stop): `/health` `200` даже при лежачих БД/Redis; `/ready` `503 db:down` / `200 degraded redis:down` / `200 ok`; `X-Request-Id` эхо и генерация; `request_id` тела = заголовок = `req_id` строки лога; `/health`/`/ready`/`/metrics` не в запрос-логе; grep по логу — ноль паролей/ключей/IP; `/metrics` `401` без токена / `200 text/plain` с токеном, все пять custom + `process_*`/`nodejs_*`; `conversions_total{jpg-to-png,COMPLETED}` и `http_errors_total{INVALID_PARAMETER}` растут; `storage_used_bytes` = `SUM(storage_used_bytes)`
- [ ] Браузер: `X-Request-Id` в Network у каждого API-запроса; «валидный JSON построчно» — в `NODE_ENV=production` (в деве `pino-pretty`) — в батч-приёмку

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### После мержа

- [ ] Решения-долгожители → `TECH-SPEC.md`: `nestjs-pino` как логгер, `prom-client` + `/metrics` за токеном, `X-Request-Id` как имя сквозного заголовка, `/health` vs `/ready` семантика
- [ ] Статус в реестре обновлён
- [ ] Ошибки агента записаны в `AI-JOURNAL.md`
