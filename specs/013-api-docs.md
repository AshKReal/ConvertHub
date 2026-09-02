# 013 — api-docs

| | |
|---|---|
| Статус | draft — план ждёт ревью владельца |
| Зависит от | 012, 023 |
| Источник | ТЗ п. 6.7, `TECH-SPEC.md` §7.1 («`securitySchemes: http/bearer`»), `packages/shared` |
| Критичность | обычная |

## Задача

Разработчик, интегрирующий публичный API, должен получить машиночитаемое описание: какие эндпоинты есть,
что принимают и возвращают, как аутентифицироваться, какие коды ошибок бывают. Сейчас страница `/api-docs`
(023) рисует это по локальному стаб-списку из восьми строк — половина которых (`/v1/conversions`, `/v1/formats`,
`/v1/me`, `DELETE /v1/files/{id}`) в коде не существует. Схема должна генерироваться из тех же Zod-схем
(`packages/shared`), что валидируют запросы, — тогда правка контракта не расходится с документацией.

## Входит

- OpenAPI 3.1 документ, собранный из Zod-схем `packages/shared` (тела запросов/ответов, параметры) + поимённый
  каталог операций (путь, метод, заголовки, коды ответов — этого в Zod нет)
- `GET /v1/openapi.json` — публичный, без аутентификации; отдаёт этот документ
- Покрыты только **реально смапленные** маршруты публичного API, которыми пользуется владелец ключа:
  `POST /v1/convert`, `GET /v1/files`, `GET /v1/files/{id}/download`. Веб-сессионные потоки (`/v1/auth/*`,
  `/v1/api-keys/*`) и ещё не построенные эндпоинты (`/v1/conversions`, `/v1/formats`, …) в схему не входят
- `securitySchemes: { bearerAuth: { type: http, scheme: bearer } }`; заголовки `Idempotency-Key`,
  `X-RateLimit-*`, `Retry-After`, `X-File-Id`, `X-Save-Skipped-Reason`, `X-Idempotent-Replay` описаны на
  соответствующих операциях
- Ответ-ошибка (`application/problem+json`, RFC 9457) — переиспользуемый компонент схемы, на него ссылаются все
  операции; перечень кодов — из `ERROR_CODES`
- Страница `/api-docs` (023) грузит `/v1/openapi.json` и рисует список эндпоинтов из него вместо стаб-файла;
  таблица ошибок, лимиты и `curl`-примеры остаются как в 023

## Не входит

| Что | Где будет |
|---|---|
| Готовый просмотрщик (Swagger UI / Scalar / Redoc) на своём маршруте | Не в этой задаче — 023 уже своя страница; при желании отдельным номером |
| Интерактивный «Try it» — выполнение запросов из документации | Не заявлено; отдельная задача при необходимости |
| Документация `/v1/auth/*`, `/v1/api-keys/*` в OpenAPI | Веб-сессионные потоки, не публичный API; ключ выпускается в вебе (`info.description` даёт ссылку) |
| `/v1/conversions`, `/v1/formats`, `DELETE /v1/files/{id}`, top-level `/v1/me` | Эндпоинты не построены — появятся в схеме, когда появятся в коде |
| `/health`, `/ready` в схеме | Их вводит 014; допишет туда же |
| Клиентские SDK, сгенерированные из схемы | Не заявлено |

## Поведение

- `GET /v1/openapi.json` без заголовков → `200`, `application/json`, валидный OpenAPI 3.1 (проверяется
  сторонним валидатором).
- Схема содержит ровно три операции публичного API; у `POST /v1/convert` — `requestBody` `multipart/form-data`
  с `file`/`target`/`save`/`quality`/`background`, необязательный заголовок `Idempotency-Key`, бинарный
  `200`-ответ и `4xx/5xx` со ссылкой на компонент ошибки.
- Правка Zod-схемы в `packages/shared` (например, добавили поле в `convertRequestSchema`) → поле появляется в
  `/v1/openapi.json` без правки модуля OpenAPI.
- Открываю `/api-docs` → список эндпоинтов и их краткие описания приходят из `/v1/openapi.json` (загрузка →
  список; сбой загрузки → короткая плашка «схема недоступна», остальная страница рисуется).
- Меняю язык/тему на `/api-docs` → статичный текст переводится, содержимое схемы (пути, имена полей) — нет
  (протокол, не UI-текст — то же решение, что в 023).

## Ошибочные сценарии

| Ситуация | Что видит клиент | Код |
|---|---|---|
| `GET /v1/openapi.json` любым методом кроме `GET` | Стандартный `404`/`405` фреймворка | — |
| Страница `/api-docs`: `/v1/openapi.json` недоступен (сеть/сервер) | Плашка «схема недоступна», таблица ошибок/лимиты/`curl` — на месте | — (не `AppError`, страница деградирует) |

## Критерии приёмки

- [ ] `GET /v1/openapi.json` → `200 application/json`; документ проходит валидатор OpenAPI 3.1 (напр. `@redocly/cli lint` или `swagger-cli validate`)
- [ ] В `paths` ровно `POST /v1/convert`, `GET /v1/files`, `GET /v1/files/{id}/download` — ни `/v1/conversions`, ни `/v1/formats`, ни `/v1/auth/*`
- [ ] `components.schemas` содержит формы из Zod (`ConvertRequest` поля, `ListFilesResponse`, `Problem`); добавление поля в `convertRequestSchema` (`packages/shared`) меняет `openapi.json` без правки `modules/openapi/**`
- [ ] `components.securitySchemes.bearerAuth` = `{ type: http, scheme: bearer }`; операции публичного API её `security` перечисляют
- [ ] `POST /v1/convert`: `requestBody` `multipart/form-data`, необязательный header-параметр `Idempotency-Key` (uuid), ответ `200` `application/octet-stream`, ответы `422/429` → `$ref` на `Problem`; `429` описывает `Retry-After` + `X-RateLimit-*`
- [ ] Все коды из `ERROR_CODES` перечислены в описании компонента `Problem` (enum поля `code`)
- [ ] `/api-docs` в браузере: список эндпоинтов — из `/v1/openapi.json` (проверить, что три, не восемь); сбой загрузки схемы → плашка, страница не пустая; обе темы, три языка, 320px
- [ ] `pnpm typecheck` и `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

---

## План

### Открытые решения владельца

1. **Зависимость.** `@asteasolutions/zod-to-openapi` — **версия `^7.3.4`**, не `9.x`: девятая линейка требует
   `zod@^4`, проект на `zod@^3.24.1`. Седьмая линейка — `zod ^3.20.2`, совместима. Ставится в `apps/api`
   (единственная зависимость `openapi3-ts`, обе — pure-TS, без рантайма).
2. **Каталог = реальность, не §7.2.** Схема документирует только смапленные маршруты (три). Не построенные
   эндпоинты из `TECH-SPEC.md` §7.2 в неё не входят; на странице `/api-docs` их станет три вместо восьми —
   осознанная замена «списка-пожелания» на честную схему.
3. **Только JSON, без готового UI.** `GET /v1/openapi.json`; рисует своя страница 023. (Решение владельца.)

### Подход

**Бэкенд — новый модуль `modules/openapi/`** (свой маршрут `GET /v1/openapi.json` → условие `backend.md` для
модуля выполнено):

- `openapi.registry.ts` — `extendZodWithOpenApi(z)` (один раз), создаёт `OpenAPIRegistry`, регистрирует
  компоненты из `packages/shared`: `convertRequestSchema` → `ConvertRequest`, `listFilesResponseSchema` →
  `ListFilesResponse`, `listFilesQuerySchema` параметры, `idempotencyKeySchema`, а также вручную собранный
  `Problem` (RFC 9457: `type`/`title`/`status`/`code` (enum из `Object.keys(ERROR_CODES)`)/`detail`/`instance`/
  `request_id`/`meta?`). `.openapi({ description, example })`-аннотации навешиваются здесь, обёрткой, **не** в
  `packages/shared` (тот не должен знать про OpenAPI).
- `openapi.paths.ts` — поимённо три операции: путь, метод, `security`, параметры, заголовки, коды ответов,
  `$ref` на компоненты. Это и есть та часть, которой в Zod нет.
- `openapi.document.ts` — `OpenApiGeneratorV31(registry.definitions).generateDocument({ openapi: '3.1.0',
  info: { title, version, description (ссылка на веб-UI за ключом) }, servers: [{ url: '/v1' }] })`. Собирается
  один раз при инициализации модуля, кешируется.
- `openapi.controller.ts` — `@Get('v1/openapi.json')`, без guard, `res.json(document)`. `Cache-Control: public,
  max-age=300`.
- `app.module.ts` — `OpenapiModule`.

**Фронтенд — 023 переводится со стаба на схему:**

- `features/api-docs/data/api-docs.api.ts` — `injectOpenApiQuery()` (TanStack Query, `['openapi']`,
  `firstValueFrom(http.get('/v1/openapi.json'))`). Тип ответа — узкий локальный интерфейс (нужны `paths` →
  `{ method, path, summary }`), не весь OpenAPI.
- `api-docs-page.ts` — `endpoints` вычисляется из `openApiQuery.data()?.paths`; на `isPending` — скелетон/«…»,
  на `isError` — плашка. Таблица ошибок (`ERROR_CODES`), лимиты, `curl`-примеры, `authExample` — без изменений.
- Удаляются `model/endpoint.ts`, `API_ENDPOINT_DESCRIPTION_KEYS` и i18n-ключи `apiDocs.endpoints.*` (описания
  теперь из `summary` схемы — английский, «протокол, не UI-текст», как уже обосновано в 023).
- `api-docs-page.html` — секция эндпоинтов рендерит `@for` по вычисленному списку + состояния загрузки/ошибки;
  добавляется строка-ссылка на `/v1/openapi.json` («полная схема»).

### Затрагиваемые файлы

Бэкенд, новые: `modules/openapi/{openapi.module,openapi.controller,openapi.registry,openapi.paths,openapi.document}.ts`.
Бэкенд, изменённые: `app.module.ts`, `apps/api/package.json` (+`@asteasolutions/zod-to-openapi`), `pnpm-lock.yaml`,
`main.ts` (`exposedHeaders` не нужен — `/v1/openapi.json` без кастомных заголовков; проверить, что CORS `GET`
проходит), `docs/AUTH.md` (строка про `GET /v1/openapi.json`).
Фронт, новые: `features/api-docs/data/api-docs.api.ts`.
Фронт, изменённые: `features/api-docs/pages/api-docs-page/api-docs-page.{ts,html}`; удаление `model/endpoint.ts`;
`core/i18n/messages/{en,ru,uk}.ts` (удаление `apiDocs.endpoints.*`, +`apiDocs.schema.unavailable`/`apiDocs.schema.link`).
`packages/shared` — **не изменяется**, только импортируется.

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| `@nestjs/swagger` + `nestjs-zod` (`createZodDto`) | Тянет swagger-слой и DTO-подобный паттерн; `AGENTS.md` прямо запрещает DTO-классы руками. Ручная сборка через `zod-to-openapi` от Zod-схем ближе к «одному источнику правды» | — |
| `@asteasolutions/zod-to-openapi@9` | Требует `zod@^4`; апгрейд Zod — отдельная крупная работа вне 013 | Когда проект перейдёт на Zod 4 |
| `.openapi()`-аннотации прямо в `packages/shared` | `shared-package.md`: только `zod` и стандартная библиотека; фронт не должен тянуть `zod-to-openapi` в бандл ради типа. Аннотации — обёрткой в `modules/openapi/` | — |
| Документировать все восемь маршрутов §7.2 (стаб как есть) | Пять из них не существуют — схема-обманка хуже, чем короткая честная. `client-gen` по такой схеме сгенерировал бы вызовы в никуда | Каждый эндпоинт добавляется в схему вместе со своим кодом |
| Отдавать OpenAPI как статический `.json` из сборки | Тогда он не «из Zod» в рантайме — разойдётся с реальными схемами при следующей правке; генерация на старте модуля дешева (один раз) | — |
| Готовый Scalar/Redoc UI на `/v1/docs` | Решение владельца — только JSON, рисует 023 | Отдельный номер при желании |

### Риски и границы

- БД и Redis не затрагиваются. `GET /v1/openapi.json` — чистое чтение закешированного объекта, без нагрузки.
- Каталог операций (`openapi.paths.ts`) — рукописный; риск расхождения с реальными контроллерами, если маршрут
  изменят, не тронув его. Смягчение: в приёмке — построчная сверка `paths` с выводом `RouterExplorer` в логе
  старта; тела/параметры от этого риска избавлены (из Zod).
- `extendZodWithOpenApi(z)` монки-патчит общий инстанс `zod` — добавляет только `.openapi()`, поведение схем не
  меняет; `packages/shared` его не вызывает и не зависит от него.
- Фронт: страница перестаёт быть полностью статичной — добавляется сетевой вызов и его состояния. Сбой вызова
  не должен ронять страницу (плашка + остальной контент).

### Мои тест-кейсы

- Прогнать `/v1/openapi.json` через `npx @redocly/cli lint` (или `swagger-cli validate`) — ноль ошибок.
- Добавить временно `dummy: z.string().optional()` в `convertRequestSchema` — поле появляется в
  `components.schemas.ConvertRequest` без правки `modules/openapi/**`; убрать.
- Удалить временно `RATE_LIMIT_EXCEEDED` из `ERROR_CODES` — enum `code` в `Problem` синхронно теряет строку
  (компилятор + вывод схемы); вернуть.
- `curl -X POST /v1/openapi.json` → `404`/`405`, не `200`.
- Фронт: заблокировать `/v1/openapi.json` (DevTools request blocking) → страница `/api-docs` показывает плашку,
  таблица ошибок и `curl`-блоки на месте; снять блокировку → список эндпоинтов появляется.
- Список на странице — ровно три строки, пути совпадают с `RouterExplorer`-логом.

---

## Чек-лист

- [ ] `apps/api`: `@asteasolutions/zod-to-openapi@^7.3.4` в зависимостях
- [ ] `modules/openapi/openapi.registry.ts` — `extendZodWithOpenApi`, регистрация компонентов из `packages/shared` + `Problem`
- [ ] `modules/openapi/openapi.paths.ts` — три операции (`POST /v1/convert`, `GET /v1/files`, `GET /v1/files/{id}/download`)
- [ ] `modules/openapi/openapi.document.ts` — `OpenApiGeneratorV31`, кеш; `openapi.controller.ts` — `GET /v1/openapi.json`; `openapi.module.ts` → `app.module.ts`
- [ ] `docs/AUTH.md` — строка про `GET /v1/openapi.json`
- [ ] Фронт: `data/api-docs.api.ts` (`injectOpenApiQuery`), `api-docs-page.{ts,html}` на схему, удаление `model/endpoint.ts` и `apiDocs.endpoints.*`
- [ ] Ручная проверка: валидатор OpenAPI 3.1 + curl (`/v1/openapi.json`, изменение Zod-схемы) + браузер (три эндпоинта, плашка при сбое, обе темы, три языка, 320px)

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### После мержа

- [ ] Решения-долгожители → `TECH-SPEC.md`: `zod-to-openapi@7` как генератор, `GET /v1/openapi.json` как канон схемы
- [ ] Статус в реестре обновлён
- [ ] Ошибки агента записаны в `AI-JOURNAL.md`
