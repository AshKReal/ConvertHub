# 018 — docx-pdf 🔒

| | |
|---|---|
| Статус | код написан, приёмка владельцем построчно не пройдена (🔒) |
| Зависит от | 016 (образ, compose, инфраструктура), 005 (`ConversionEngine`, оркестрация) |
| Источник | ТЗ п. 2, п. 9.4, `TECH-SPEC.md` §2.1 (`DOCX → PDF` / Gotenberg), §6 (пул документов 8, ожидание 10 с), §9 (ZIP-бомба DOCX), §14, `ARCHITECTURE.md` §2 (граница 2 — изоляция конвертера), §9 |
| Критичность | 🔒 — впервые пускает ZIP-архив недоверенного пользователя в парсер (LibreOffice) и в распаковщик. План до кода, приёмка построчная (`.claude/rules/critical-zones.md`) |

## Задача

Четвёртое и последнее направление — `DOCX → PDF`. Оно единственное требует LibreOffice, поэтому и Docker:
LibreOffice запускается в отдельном контейнере (Gotenberg), без сети и без доступа к базе — если в его
парсере сработает эксплойт на недоверенном документе, злоумышленник окажется в контейнере без состояния и без
выхода наружу (`ARCHITECTURE.md` §2, граница 2). До сих пор `docx-to-pdf` был явно вычеркнут из списка
поддерживаемых направлений, и реальный DOCX получал `UNSUPPORTED_FILE_TYPE`. Эта спека снимает исключение — а
значит, впервые обязана защитить точку входа: DOCX — это ZIP, и его нужно проверить на бомбу распаковки до
того, как отдать движку.

## Входит

- Контейнер конвертера документов (Gotenberg 8) в `docker-compose.yml`: без публикации портов наружу, только
  во внутренней сети; `read_only`, `tmpfs` на `/tmp`, `cap_drop: ALL`, без новых привилегий, лимиты памяти и
  процессов (`ARCHITECTURE.md` §2)
- Вторая реализация `ConversionEngine` — HTTP-клиент к Gotenberg: шлёт документ, получает PDF; сигнатура
  интерфейса не меняется (`TECH-SPEC.md` §14, проверочное свойство)
- Пул одновременных документных конвертаций (8): запрос сверх лимита ждёт до 10 секунд, затем `503` с
  `Retry-After` (`TECH-SPEC.md` §6, `ARCHITECTURE.md` §9). Сейчас такого пула нет вообще — есть только лимит
  «3 на пользователя» (005), это другое
- Таймаут конвертации документа (60 с) → `CONVERSION_TIMEOUT`; недоступность/ошибка Gotenberg →
  `CONVERSION_FAILED`, изображения при этом продолжают работать (`ARCHITECTURE.md` §9)
- 🔒 Снятие исключения `docx-to-pdf` из списка поддерживаемых направлений — и в том же изменении валидатор
  ZIP-бомбы для DOCX: лимит коэффициента распаковки (100:1) и абсолютного размера несжатого содержимого
  (`TECH-SPEC.md` §9). Такого валидатора в кодовой базе нет
- Настоящая `.docx`-фикстура для тестов (в 015 её не было — в `apps/api` нет zip-райтера) + фикстура-бомба

## Не входит

| Что | Где будет |
|---|---|
| `PDF → DOCX` изменения | Уже сделано (005), не трогается |
| Параметры конвертации документа (`dpi`, поля, ориентация) | Не заявлено; Gotenberg отдаёт дефолт LibreOffice |
| Другие форматы Gotenberg (HTML→PDF, Markdown→PDF, merge) | Не в объёме v1 (`TECH-SPEC.md` §2.3) |
| Общий лимит на **размер результата** конвертации (`REVIEW-FINDINGS.md` BE-CONV-01) | Отдельная задача; здесь — только вход (ZIP-бомба) |
| Ретрай при сбое Gotenberg | `CONVERSION_FAILED` `retryable: true` — повтор на стороне клиента, не сервера |
| Изоляция контейнера `pdf2docx` (`PDF → DOCX`) | Движок — обычная библиотека в процессе API (`TECH-SPEC.md` §14, решение 000), не самостоятельный сервис; контейнерная изоляция ему не нужна |
| Health-проверка Gotenberg в `/ready` | Опционально — решить при реализации; сбой Gotenberg и так деградирует только документы, изображения живут |
| Метрика заполненности документного пула | 014-долг; 014 явно оставил это на 018 — добавить хук в `conversionsInFlight` или новый gauge, решить при реализации |

## Поведение

- `POST /v1/convert` с настоящим `.docx` и `target=pdf` → `200`, тело — валидный PDF; `X-File-Id`/`save`
  работают как для остальных направлений.
- Тот же запрос, но файл — не DOCX по сигнатуре (например PDF переименован в `.docx`) → `UNSUPPORTED_FILE_TYPE`
  или `FILE_TYPE_MISMATCH` (тип по magic bytes, не по расширению — `critical-zones.md`).
- DOCX, у которого суммарный несжатый размер содержимого / размер файла > 100, либо несжатый размер превышает
  абсолютный лимит → `FILE_TOO_LARGE` с обоими числами в `detail` (ТЗ п. 12.5). Движок не вызывается.
- Битый/обрезанный ZIP под именем `.docx` → `FILE_CORRUPTED`. Не `CONVERSION_FAILED` — различаем причину
  (`critical-zones.md`: каждый `catch` вокруг парсера ставит конкретный код).
- 9 одновременных `DOCX → PDF`: восемь идут, девятая ждёт; освободился слот в пределах 10 с → пошла; не
  освободился → `503 SERVICE_OVERLOADED` + `Retry-After`. Изображения (`JPG→PNG`) в это время — `200`, они не
  в этом пуле.
- Gotenberg не отвечает дольше 60 с → `504 CONVERSION_TIMEOUT`. Gotenberg вернул не-2xx или сеть отвалилась →
  `500 CONVERSION_FAILED`. `POST /v1/convert` с `JPG` в это же время → `200`.
- `docker compose exec gotenberg wget https://example.com` → отказ (сети наружу нет). `curl localhost:<любой
  порт gotenberg>` с хоста → отказ (порт не опубликован).

## Ошибочные сценарии

| Ситуация | Что видит пользователь | Код |
|---|---|---|
| DOCX-бомба (ratio > 100 или несжатый размер > лимита) | «Файл распаковывается в N, максимум M» (числа + способ решения) | `FILE_TOO_LARGE` (413) |
| Битый/обрезанный ZIP как `.docx` | «Файл повреждён или не читается» | `FILE_CORRUPTED` (422) |
| Не DOCX по сигнатуре | «Формат не поддерживается» / «тип не совпадает с целевым» | `UNSUPPORTED_FILE_TYPE` / `FILE_TYPE_MISMATCH` (415) |
| Документный пул полон, слот не освободился за 10 с | «Сервис перегружен, повторите через N с» | `SERVICE_OVERLOADED` (503) + `Retry-After` |
| Gotenberg не ответил за 60 с | «Конвертация не уложилась во время» | `CONVERSION_TIMEOUT` (504) |
| Gotenberg вернул ошибку / недоступен | «Конвертация не удалась» | `CONVERSION_FAILED` (500, `retryable`) |
| DOCX с макросами / внешними ссылками | Конвертируется как есть (LibreOffice их не исполняет в headless), либо `CONVERSION_FAILED` если LibreOffice споткнулся | `200` / `500` |

## Критерии приёмки

- [ ] `docker compose --profile full up -d` (или `up -d` + Gotenberg в основном наборе — решить в плане) → `gotenberg` healthy; `docker compose port gotenberg 3000` → пусто (порт не опубликован)
- [ ] `docker compose exec gotenberg sh -c "wget -T 3 https://example.com || echo NO-NET"` → `NO-NET`
- [ ] `curl -F file=@real.docx -F target=pdf -H "Authorization: Bearer <jwt>" :3000/v1/convert -o out.pdf` → `200`, `file out.pdf` = `PDF document`, открывается
- [ ] `curl -F file=@zip-bomb.docx -F target=pdf ... :3000/v1/convert` → `413 FILE_TOO_LARGE`, `detail` содержит два числа; в логе движок не вызывался
- [ ] `printf 'PK\x03\x04garbage' > broken.docx; curl -F file=@broken.docx -F target=pdf ...` → `422 FILE_CORRUPTED`
- [ ] `cp sample.pdf fake.docx; curl -F file=@fake.docx -F target=pdf ...` → `415` (тип по сигнатуре)
- [ ] 9 параллельных `DOCX→PDF` (медленный документ) → 8 в работе, 9-я ждёт; при занятости > 10 с → `503` + `Retry-After: <n>`; одновременный `JPG→PNG` → `200`
- [ ] Убить Gotenberg на время запроса → `504 CONVERSION_TIMEOUT` или `500 CONVERSION_FAILED`; `JPG→PNG` в этот момент → `200`
- [ ] `git grep -n "docx-to-pdf" apps/api/src` — исключающего `.filter(d => d.id !== 'docx-to-pdf')` в `conversion-direction.validator.ts` больше нет
- [ ] `conversion-direction.validator.spec.ts` — тест «реальный DOCX → `UNSUPPORTED_FILE_TYPE`» переписан на «реальный DOCX → направление `docx-to-pdf`»
- [ ] `pnpm test` — новые юнит-тесты (валидатор ZIP-бомбы, пул документов) зелёные; `pnpm typecheck` / `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

### Для 🔒 — дополнительно

- [ ] Найдены все места, где DOCX попадает в систему: `POST /v1/convert` (единственный путь); валидатор ZIP-бомбы стоит **до** `engine.convert` и до `DocumentPoolService.acquire`
- [ ] Тип файла — по magic bytes (ZIP-сигнатура + структура docx), не по расширению / `Content-Type`
- [ ] Имя файла от клиента нигде не путь — multipart во временный каталог с системным именем (уже так, 002); в Gotenberg уходит поле формы, не путь
- [ ] Каждый `catch` вокруг разбора ZIP/ответа Gotenberg различает причины: битый архив → `FILE_CORRUPTED`, таймаут → `CONVERSION_TIMEOUT`, не-2xx → `CONVERSION_FAILED`; единого `CONVERSION_FAILED` на всё нет
- [ ] В лог не попадают: содержимое документа, полные IP; ошибка Gotenberg логируется без тела запроса
- [ ] Ресурсы освобождаются в `finally`: слот пула, временные файлы, `AbortController`/соединение с Gotenberg — при исключении тоже
- [ ] ZIP-бомба считается по центральному каталогу архива (заявленные несжатые размеры), архив не распаковывается на диск ради подсчёта

---

## План

### Решения владельца (2026-09-02)

1. Стадия 10 = 016 + 018 в одной ветке `docker`; 018 идёт **после** всего 016. 🔒-файлы 018
   (`conversion-direction.validator.ts`, `docx-zip-bomb.validator.ts`) — отдельными коммитами.
2. Приёмка построчная (`.claude/rules/critical-zones.md`), спека помечена 🔒 в `SPECS.md`.

### Открытые вопросы — решено при реализации

- **Gotenberg в основном наборе compose**, не под профилем. НО без публикации портов и в
  `internal: true`-сети — `pnpm dev:api` снаружи его не видит (изоляция важнее DX). Для docx→pdf локально —
  `--profile full` либо `docker-compose.override.yml` с портом (`docs/SETUP.md`).
- **`S3_PUBLIC_ENDPOINT`** решён в 016 — presigned URL подписывается от публичного хоста.
- **Health-проверка Gotenberg в `/ready` — НЕ добавлена.** Локально без `--profile full` Gotenberg
  недостижим, `/ready` был бы вечно `degraded` — шум. Сбой docx-конвертации даёт `CONVERSION_FAILED` + лог,
  этого достаточно (014 её тоже не требовал).
- **Метрика — отдельный gauge `converthub_document_pool_active`** (не переиспользуем `conversionsInFlight` —
  другая семантика). 014 явно отложил её сюда.
- **Playwright — пятый сценарий НЕ добавлен.** UI-путь конвертации уже покрыт (`jpg→png`);
  `docx→pdf` через браузер потребовал бы Gotenberg в Playwright-джобе CI. Вместо этого —
  `apps/api/test/docx-pdf.e2e-spec.ts` за флагом `E2E_DOCX=1`.

### Подход

**Gotenberg в `docker-compose.yml` — изоляция это и есть содержание.** `gotenberg/gotenberg:8`:

- отдельная сеть `converter` с `internal: true`; `api` — в обеих сетях (`default` + `converter`), Gotenberg —
  только в `converter`. Портов наружу нет (`ports:` не задаём).
- `read_only: true`, `tmpfs: { /tmp: "rw,noexec,nosuid,size=512m" }`, `environment: HOME=/tmp` (LibreOffice
  требует writable HOME), `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `mem_limit: 512m`,
  `pids_limit: 256`, `restart: unless-stopped`.
- `command: ["gotenberg", "--chromium-disable-javascript=true", "--libreoffice-disable-routes=false"]` —
  включаем только `/forms/libreoffice/*`, отключаем chromium-маршруты (нам не нужны).
- healthcheck: `curl -f http://localhost:3000/health` внутри контейнера.

**`DocumentEngine implements ConversionEngine` — `engines/document.engine.ts`.**

- `supports(from, to)` → `from === 'DOCX' && to === 'PDF'`.
- `convert(input, opts)` → `FormData` с полем `files` (`input` как `Blob`, имя `document.docx`), `fetch(
  \`${env.GOTENBERG_URL}/forms/libreoffice/convert\`, { method: 'POST', body, signal:
  AbortSignal.timeout(CONVERSION_TIMEOUT_SECONDS * 1000) })`. `2xx` → `Buffer.from(await res.arrayBuffer())`.
  `AbortError`/timeout → `throw new AppException('CONVERSION_TIMEOUT')`. не-2xx / сетевой сбой →
  `throw new AppException('CONVERSION_FAILED')` (лог без тела). `finally` — ничего копить не нужно, `fetch`
  сам закрывается по сигналу.
- Регистрация — одна строка в фабрике `CONVERSION_ENGINES` (`conversion.module.ts`), `inject` += `DocumentEngine`.
  Сигнатура `ConversionEngine` не меняется.
- `env.ts` += `GOTENBERG_URL: z.string().url()` (в compose — `http://gotenberg:3000`; для локального `pnpm
  dev:api` — `http://localhost:<порт>` если Gotenberg в основном наборе, иначе фича доступна только в
  `--profile full`).

**`DocumentPoolService` — `modules/conversion/document-pool.service.ts`.**

- Семафор на `DOCUMENT_POOL_SIZE` (8). `acquire(): Promise<void>` — если есть свободный слот, берёт сразу;
  иначе встаёт в очередь `Promise` с таймером на `DOCUMENT_POOL_WAIT_SECONDS` (10 с); по таймеру —
  `reject(new AppException('SERVICE_OVERLOADED', { retry_after_seconds: DOCUMENT_POOL_WAIT_SECONDS }))` и
  снятие из очереди. `release()` — отдаёт слот следующему в очереди (снимая его таймер) либо уменьшает счётчик.
- Вызывается в `ConversionService.convert` **только для направления `docx-to-pdf`**, вокруг `engine.convert`,
  с `release()` в `finally`. Это единственная правка `conversion.service.ts` — и она осознанная (новый рубеж
  нагрузки, `TECH-SPEC.md` §6), не протечка абстракции хранилища. Отметить в диффе.
- `AllExceptionsFilter` — `Retry-After` сейчас ставится только для `RATE_LIMIT_EXCEEDED`; расширить условие на
  `SERVICE_OVERLOADED` (оба несут `retry_after_seconds` в `meta`).

**🔒 `validators/docx-zip-bomb.validator.ts` + снятие исключения.**

- `conversion-direction.validator.ts:17` — убрать `.filter((d) => d.id !== 'docx-to-pdf')`. Теперь
  `SUPPORTED_MIMES` включает
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (и, возможно, `application/zip` —
  `file-type` на .docx может отдавать любой из двух; проверить и внести оба в маппинг направления).
- Новый `assertDocxWithinUnzipLimit(filePath)`:
  - Читает **центральный каталог** ZIP (в конце файла: EOCD → записи), берёт заявленный несжатый размер
    (`uncompressed size`) каждой записи. Не распаковывает.
  - `totalUncompressed / fileSize > MAX_DOCX_UNZIP_RATIO` (100) → `FILE_TOO_LARGE` с `detail`
    (`{ actual: totalUncompressed, max: fileSize * ratio }` или абсолютные числа — как в остальных валидаторах).
  - `totalUncompressed > MAX_DOCX_UNZIP_BYTES` (абсолютный предел, например 100 МБ) → `FILE_TOO_LARGE`.
  - EOCD не найден / запись каталога не парсится / ZIP64 без EOCD64 → `FILE_CORRUPTED`.
  - Реализация — руками по формату (сигнатуры `PK\x05\x06`, `PK\x01\x02`), без zip-библиотеки: нам нужен
    только один заголовочный числовой факт, распаковщик тащить незачем (тот же принцип, что
    `pixel-count`/`pdf-page-count` — читаем заявленное, не декодируем).
  - Вызывается в конвейере (`conversion.service.ts` или его валидационный шаг — где сейчас
    `assertPdfPageLimit`/`assertWithinPixelLimit`) **для направления `docx-to-pdf`, до `DocumentPoolService`
    и до `engine.convert`**.
- ZIP64: настоящие .docx почти всегда обычный ZIP; если запись помечена ZIP64 (`0xFFFFFFFF` в размере) и
  нет EOCD64 — `FILE_CORRUPTED`, не пытаться угадать.

### Затрагиваемые файлы

Новые: `apps/api/src/modules/conversion/engines/document.engine.ts` (+ `.spec.ts`),
`apps/api/src/modules/conversion/document-pool.service.ts` (+ `.spec.ts`),
`apps/api/src/modules/conversion/validators/docx-zip-bomb.validator.ts` 🔒 (+ `.spec.ts`),
фикстуры `apps/api/test/fixtures/sample.docx`, `zip-bomb.docx` (+ логика в `generate.mjs`).
Изменённые: `docker-compose.yml` (Gotenberg + сеть `converter`), `apps/api/src/config/env.ts` (`GOTENBERG_URL`),
`apps/api/.env.example`, `apps/api/src/modules/conversion/conversion.module.ts` (регистрация `DocumentEngine`,
`DocumentPoolService`), `apps/api/src/modules/conversion/conversion.service.ts` (пул вокруг документного
движка — единственная осознанная правка), `apps/api/src/modules/conversion/validators/conversion-direction.validator.ts` 🔒,
`apps/api/src/modules/conversion/validators/conversion-direction.validator.spec.ts`,
`apps/api/src/common/filters/all-exceptions.filter.ts` (`Retry-After` для `SERVICE_OVERLOADED`),
`packages/shared/src/constants/limits.ts` (`DOCUMENT_POOL_SIZE`, `DOCUMENT_POOL_WAIT_SECONDS`,
`CONVERSION_TIMEOUT_SECONDS`, `MAX_DOCX_UNZIP_RATIO`, `MAX_DOCX_UNZIP_BYTES`),
`packages/shared/src/constants/error-codes.ts` (проверить, что `SERVICE_OVERLOADED` есть — есть, 503),
`docs/SETUP.md`, `.github/workflows/ci.yml` (Gotenberg-сервис для e2e-джобы, если e2e документов добавляется).

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| LibreOffice прямо в образе `api`, `soffice --headless` дочерним процессом | `ARCHITECTURE.md` §2 граница 2: недоверенный парсер — отдельный контейнер без сети/БД; в процессе API это RCE-поверхность на весь бэкенд. Gotenberg ещё и решает конфликт параллельных профилей LibreOffice и зависания на защищённых файлах (`TECH-SPEC.md` §3.1) | Никогда для прода |
| Распаковать DOCX zip-библиотекой и померить реальные размеры | Тащит распаковщик как зависимость и сам может стать вектором (zip-slip, память на распаковке); заявленный несжатый размер в каталоге для проверки бомбы достаточен и дешевле | Если понадобится валидировать содержимое (`word/document.xml` well-formed) — тогда с потоковым парсером и лимитом |
| Переиспользовать `ConcurrencyLimiterService` (3 на пользователя) как пул документов | Другая семантика: тот — на ключ идентичности, глобального предела ресурсов LibreOffice не даёт; `TECH-SPEC.md` §6 требует именно пул на 8 с очередью и `503` | — |
| `503` сразу, без ожидания 10 с | ТЗ / `TECH-SPEC.md` §6: «ждут до 10 секунд, затем 503» — короткий всплеск не должен отбиваться | — |
| Gotenberg с публикацией порта (для отладки) | Наружу выставлен конвертер, принимающий произвольные файлы без аутентификации (`ARCHITECTURE.md` §13, третья частая ошибка) | Только `docker compose exec` для отладки |
| Не снимать исключение `docx-to-pdf`, а завести отдельный «движок-заглушку» | Половинчато: направление либо работает и защищено, либо честно `UNSUPPORTED_FILE_TYPE`; заглушка даёт `CONVERSION_FAILED` вместо понятного отказа | — |

### Риски и границы

- **`read_only` + LibreOffice** — без writable `HOME` и `/tmp` Gotenberg поднимется (healthcheck зелёный), а
  упадёт на **первой** конвертации. Проверять именно конвертацией, не healthcheck'ом. `HOME=/tmp` + `tmpfs
  /tmp` обязательны.
- **Сеть `internal: true`** отрезает Gotenberg от DNS. Нам это и нужно, но если LibreOffice полезет за
  шрифтом/ресурсом — конвертация зависнет до 60-секундного таймаута, а не упадёт явно. Смягчение: базовый
  набор шрифтов уже в образе Gotenberg; следить за `CONVERSION_TIMEOUT` в метриках.
- **ZIP-бомба — ядро 🔒.** Заявленные размеры в каталоге ZIP врут ровно так же, как размеры в заголовке PNG
  (тот же класс, что `pixel-count.validator`). Считать по каталогу, не по локальным заголовкам записей
  (локальные можно подделать иначе, чем центральные), не распаковывая.
- **`file-type` на .docx** может вернуть `application/zip` вместо docx-MIME (docx — это ZIP). Проверить на
  реальной фикстуре; в маппинг направления внести оба MIME, иначе валидный DOCX получит `UNSUPPORTED_FILE_TYPE`.
- **Правка `conversion.service.ts`** — впервые в этой ветке. Это не протечка `Storage`, а новый рубеж
  нагрузки для одного направления. Держать её одним маленьким коммитом, критерий приёмки 016 про
  «`conversion.service.ts` не тронут» относится к 016, не к 018.
- **`AbortSignal.timeout` и `fetch`** — Node 22 поддерживает; проверить, что `AbortError` реально прерывает
  соединение с Gotenberg, а не только отбрасывает промис (иначе слот пула держится до реального ответа).
- **`DocumentPoolService` таймер** — по `SERVICE_OVERLOADED` обязательно снять `Promise` из очереди, иначе
  `release()` позже отдаст слот «призраку» и реальный счётчик разъедется.

### Мои тест-кейсы

*(владелец пишет свои прозой до кода)*

- Настоящий `.docx` (текст + таблица) → `200`, PDF открывается, текст извлекается.
- `zip-bomb.docx` (каталог заявляет 5 ГБ несжатого при 5 КБ файла) → `413 FILE_TOO_LARGE`, оба числа в
  `detail`; в логе `DocumentEngine.convert` не вызывался, слот пула не занимался.
- `printf 'PK\x03\x04\x00\x00' > x.docx` (обрезанный ZIP) → `422 FILE_CORRUPTED`.
- `cp sample.pdf x.docx` → `415` (тип по сигнатуре, не по расширению).
- Пустой файл `.docx` → `422 FILE_CORRUPTED` (нет EOCD).
- 8 медленных `DOCX→PDF` заняли пул; 9-я: освободился слот за 3 с → `200`; не освободился за 10 с → `503`,
  `Retry-After: 10`. Параллельный `JPG→PNG` всё это время → `200`.
- `docker compose stop gotenberg` во время запроса → `504` или `500`; `JPG→PNG` → `200`.
- `docker compose exec gotenberg wget -T 3 https://example.com` → таймаут/refused (сети нет).
- `docker compose port gotenberg 3000` → пусто.
- ZIP64-запись (`0xFFFFFFFF` размер) без EOCD64 → `FILE_CORRUPTED`, не угадывание.
- `conversion-direction.validator.spec.ts` — реальный DOCX теперь даёт направление `docx-to-pdf`, не `UNSUPPORTED_FILE_TYPE`.

---

## Чек-лист

- [x] `specs/018-docx-pdf.md` + план (этот файл) — коммит-гейт перед кодом, 🔒 в `SPECS.md`
- [x] `packages/shared`: `DOCUMENT_POOL_SIZE`, `DOCUMENT_POOL_WAIT_SECONDS`, `CONVERSION_TIMEOUT_SECONDS`, `MAX_DOCX_UNZIP_RATIO`, `MAX_DOCX_UNZIP_BYTES` (дубль `TIMEOUT_MS` в `pdf-to-docx.engine.ts` убран)
- [x] `docker-compose.yml` — `gotenberg` (сеть `converter` `internal`, `read_only`, `tmpfs /tmp` + `HOME=/tmp`, `cap_drop ALL`, `no-new-privileges`, `mem_limit`/`pids_limit`, без портов); `env.ts` += `GOTENBERG_URL`; `.env.example`; `docs/SETUP.md`
- [x] `engines/document.engine.ts` — `supports('DOCX','PDF')`, `fetch` в Gotenberg с `AbortSignal.timeout`, `TimeoutError` → `CONVERSION_TIMEOUT`, не-2xx/сеть → `CONVERSION_FAILED`; регистрация в `conversion.module.ts`
- [x] `document-pool.service.ts` — семафор 8 + очередь + ожидание 10 с → `SERVICE_OVERLOADED` + `retry_after_seconds`; вызов в `conversion.service.ts` только для `DOCX`, `release()` во вложенном `finally`; `all-exceptions.filter.ts` — `Retry-After` для `SERVICE_OVERLOADED`; метрика `converthub_document_pool_active`
- [x] 🔒 `validators/conversion-direction.validator.ts` — снят `.filter(docx-to-pdf)` (`file-type` на реальном .docx отдаёт docx-MIME, не `application/zip` — проверено фикстурой) — **отдельный коммит**
- [x] 🔒 `validators/docx-zip-bomb.validator.ts` — разбор центрального каталога ZIP, `> MAX_DOCX_UNZIP_BYTES` ИЛИ `> fileSize*RATIO` → `FILE_TOO_LARGE` (`actual_size_bytes`/`max_size_bytes` в `meta`), EOCD не найден / запись не парсится / ZIP64-sentinel → `FILE_CORRUPTED`; вызов до пула и до движка — **отдельный коммит**
- [x] `output-mime.ts` — `target: 'pdf'` → `application/pdf`
- [x] Фикстуры: `test/fixtures/zip-writer.mjs`+`.d.mts` (общий ZIP-райтер), `sample.docx` (LibreOffice его конвертирует), `zip-bomb.docx`; `conversion-direction.validator.spec.ts` переписан
- [x] Юнит: `docx-zip-bomb.validator.spec.ts` (валиден / бомба / ровно на границе ratio / +1 байт / не-zip / обрезанный / ZIP64-sentinel), `document-pool.service.spec.ts` (8 проходят, 9-я ждёт, таймаут → `SERVICE_OVERLOADED`, `release` передаёт слот / декрементит гейдж), `document.engine.spec.ts` (маршрут/форма/маппинг таймаута/не-2xx/сети)
- [x] `apps/api/test/docx-pdf.e2e-spec.ts` за `E2E_DOCX=1` — реальный docx → PDF, zip-bomb → `413` (проверено с поднятым Gotenberg: 2/2)
- [x] Ручная проверка функциональная: настоящий docx → `200` PDF; бомба → `413 FILE_TOO_LARGE` с числами; `jpg→png` без регрессий; standalone Gotenberg с `read_only`+`tmpfs`+`HOME=/tmp` конвертирует (изоляция не мешает); порт не опубликован, сети наружу нет
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` (shared 5 / api 68 / web 19) / `pnpm test:e2e` (6, docx-спек skipped без флага) / `pnpm e2e` — зелёные

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### Для 🔒 — дополнительно (приёмка)

- [ ] Найдены **все** места, где DOCX попадает в систему
- [ ] Тип файла по сигнатуре, не по расширению и `Content-Type`
- [ ] Имя файла от клиента нигде не используется как путь
- [ ] Каждый `catch` вокруг парсера/Gotenberg различает причины и ставит конкретный `code`
- [ ] В лог не попадают: содержимое файлов, полные IP
- [ ] Ресурсы (слот пула, temp, соединение) освобождаются в `finally`, а не после успешного пути
- [ ] ZIP-бомба проверяется по заявленным размерам (центральный каталог), архив не распаковывается

### После мержа

- [ ] Решения-долгожители → `TECH-SPEC.md` §2.1/§3.1: Gotenberg 8 как движок `DOCX→PDF`, `DOCUMENT_POOL_SIZE`/ожидание, `MAX_DOCX_UNZIP_RATIO` как канон
- [ ] `ARCHITECTURE.md` §2 (граница 2) / §9 — реальные параметры изоляции контейнера Gotenberg
- [ ] Статус в реестре обновлён (018)
- [ ] Ошибки агента записаны в `AI-JOURNAL.md`
