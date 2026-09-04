# DEPLOYMENT.md

Пошаговый деплой ConvertHub. Целевые площадки — `TECH-SPEC.md` §13: **Railway** (бэкенд + Gotenberg +
managed Postgres/Redis), **Vercel** (Angular-статика), **Cloudflare R2** (файлы).

Документ описывает **что нажать**. Обоснование выбора площадок — `TECH-SPEC.md` §13, границы системы —
`ARCHITECTURE.md` §10. Локальная разработка — `docs/SETUP.md`, это другой документ.

> **Статус:** написан до первого реального деплоя, переписан под фактическую топологию (обратный прокси,
> §9). Спека 017 — `specs/017-deployment.md`. Всё ниже проверяемо только в момент, когда вы это делаете.

**Топология в одну строку:** браузер общается только с Vercel. Статика отдаётся оттуда же, а `/v1/*`
переписывается на Railway. Своего домена не требуется — но причина не в экономии, а в cookie: §9.

---

## 0. Что нужно завести заранее

| Что | Зачем |
|---|---|
| Аккаунт **Railway** | `api` (из `docker/api.Dockerfile`), `gotenberg`, managed Postgres, managed Redis |
| Аккаунт **Vercel** | статика `apps/web` + прокси `/v1/*` на Railway |
| Аккаунт **Cloudflare** + R2 | объектное хранилище файлов |
| Проект **Google Cloud** | боевой OAuth 2.0 Client ID (dev-креды не переиспользовать) |
| **SMTP-провайдер** | восстановление пароля (спека 009). Resend / Postmark / Amazon SES / Mailgun |

Свой домен **не нужен**: прокси делает фронт и API одним origin. Если домен всё же появится — §9 объясняет,
что тогда можно упростить.

---

## 1. Порядок, в котором добываются имена

Здесь замкнутый круг, и он единственная нетривиальная часть деплоя:

- `vercel.json` нужен **хост Railway** (куда проксировать);
- переменные Railway (`CORS_ORIGIN`, `GOOGLE_REDIRECT_URI`) нужны **домен Vercel**.

Круг разрывается тем, что Vercel выдаёт домен проекта **сразу при создании**, до первой успешной сборки.
Отсюда порядок §10: создать проект Vercel → записать домен → поднять Railway → записать хост → вписать его
в `vercel.json` → задать переменные Railway → собрать.

**`apps/web/src/environments/environment.prod.ts` править не нужно.** `apiUrl` там пуст, и это рабочее
значение: фронт и API на одном origin, запросы уходят относительными путями. Angular вшивает эту константу
на этапе сборки, читать её из переменных окружения в рантайме нечем — но при прокси и нечего.

---

## 2. Cloudflare R2

1. R2 → **Create bucket**, имя `convert-hub`. Публичный доступ **не включать** — файлы отдаются только по
   подписанным ссылкам с TTL 15 минут (`ARCHITECTURE.md` §2, граница 3).
2. R2 → **Manage API Tokens** → создать токен, права **Object Read & Write**, scope — только этот бакет.
   Сохранить `Access Key ID` и `Secret Access Key` (секрет показывается один раз).
3. Записать S3-эндпоинт: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Для R2: `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=true`, `S3_PUBLIC_ENDPOINT` **не задавать** — подписанные
ссылки генерируются по тому же эндпоинту. (Разделение public/internal нужно только локально в compose, где
приложение видит MinIO как `minio:9000`, а браузер как `localhost:9000`.)

---

## 3. Railway — managed-сервисы

New Project → **Add PostgreSQL** → **Add Redis**.

Строки подключения подставляются ссылками на переменные других сервисов, руками их копировать не нужно:
`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`.

---

## 4. Railway — Gotenberg

**Add Service → Docker Image**, образ `gotenberg/gotenberg:8`.

Start command:

```
gotenberg --chromium-disable-javascript=true --chromium-allow-list=file:///tmp/.*
```

**Публичный домен НЕ генерировать.** Это прямое требование `ARCHITECTURE.md` §13 и §2 (граница 2): наружу
выставленный Gotenberg — это конвертер, принимающий произвольные файлы без аутентификации. Внутри проекта он
доступен по приватной сети как `gotenberg.railway.internal:3000`.

Если площадка позволяет — выставить лимит памяти (локально в compose стоит `mem_limit: 1g`; см. `BE-DOCX-04`
в `REVIEW-FINDINGS.md` — этот лимит связан с `MAX_DOCX_UNZIP_BYTES` и размером пула).

---

## 5. Railway — `api`

**Add Service → GitHub Repo** → этот репозиторий. Настройки сборки:

- Builder: **Dockerfile**
- Dockerfile path: `docker/api.Dockerfile`
- Root directory: корень репозитория (Dockerfile ждёт полный контекст монорепы)

Миграции применяются сами: entrypoint делает `prisma migrate deploy` перед стартом (`ARCHITECTURE.md` §10).
**Это безопасно только при одном экземпляре** — при нескольких инстансах миграции пойдут параллельно, тогда
их надо выносить в отдельный шаг деплоя.

Домен Railway генерируется (`converthub-production.up.railway.app`) — он нужен как цель прокси. Публичным он
остаётся и напрямую: так проверяются `/health`, `/ready`, `/metrics` мимо Vercel.

### Переменные окружения (полный список — схема `apps/api/src/config/env.ts`)

Значение вне схемы роняет процесс на старте, а не на первом запросе — это задумано.
Ниже `convert-hub-api-nine.vercel.app` — реальный домен проекта на Vercel, выданный при создании (§7);
подставлен как есть, копировать можно без замены. Хост Railway
(`converthub-production.up.railway.app`) — тоже реальный и уже вписан в `vercel.json`.

| Переменная | Значение | Примечание |
|---|---|---|
| `NODE_ENV` | `production` | отключает `pino-pretty`, включает `Secure` на refresh-cookie |
| `PORT` | `3000` | |
| `CORS_ORIGIN` | `https://convert-hub-api-nine.vercel.app` | **домен Vercel**, не Railway. Больше, чем CORS, — см. ниже |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | rate limit + идемпотентность; при недоступности fail-open |
| `JWT_SECRET` | 32+ случайных символа | `openssl rand -base64 32` |
| `SIGNED_URL_SECRET` | 32+ случайных символа | в режиме `s3` не используется, но схема требует — см. `INFRA-05` |
| `LOCAL_STORAGE_DIR` | `/tmp/unused` | то же: заглушка, `LocalDiskStorage` при `s3` не создаётся |
| `METRICS_TOKEN` | 16+ случайных символов | `GET /metrics` за `Authorization: Bearer` |
| `LOG_LEVEL` | `info` | |
| `STORAGE_DRIVER` | `s3` | |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | |
| `S3_BUCKET` | `convert-hub` | |
| `S3_ACCESS_KEY_ID` | из R2-токена | |
| `S3_SECRET_ACCESS_KEY` | из R2-токена | |
| `S3_REGION` | `auto` | для R2 |
| `S3_FORCE_PATH_STYLE` | `true` | |
| `S3_PUBLIC_ENDPOINT` | *не задавать* | по умолчанию = `S3_ENDPOINT` |
| `GOTENBERG_URL` | `http://gotenberg.railway.internal:3000` | приватная сеть, не публичный домен |
| `GOOGLE_CLIENT_ID` | из Google Cloud Console | |
| `GOOGLE_CLIENT_SECRET` | из Google Cloud Console | |
| `GOOGLE_REDIRECT_URI` | `https://convert-hub-api-nine.vercel.app/v1/auth/google/callback` | **домен Vercel**, см. §6 |
| `SMTP_HOST` | хост провайдера | |
| `SMTP_PORT` | `587` или `465` | |
| `SMTP_SECURE` | `false` для 587 (STARTTLS), `true` для 465 | строка `'true'`/`'false'`, не булев — см. докблок в `env.ts` |
| `SMTP_USER` | у Resend — `resend` | **обязательна в проде.** Без пары контейнер не стартует (`INFRA-12`) |
| `SMTP_PASSWORD` | у Resend — API-ключ | то же. Задаётся только вместе с `SMTP_USER` |
| `SMTP_FROM` | `noreply@example.com` | должен пройти верификацию у провайдера |

**`CORS_ORIGIN` — это не только CORS.** Тем же значением приложение пользуется как базой фронта: редирект
после успешного входа через Google (`auth.controller.ts#googleCallback`) и ссылка в письме сброса пароля
(`account.service.ts#requestPasswordReset`). Укажете сюда домен Railway — письма поведут пользователя на
голый API. При прокси браузер и так не делает cross-origin запросов, но переменная обязана быть верной.

**Секреты генерировать реально.** При `NODE_ENV=production` контейнер **не стартует**, если `JWT_SECRET`,
`SIGNED_URL_SECRET` или `METRICS_TOKEN` содержит подстроку `change-me`, `changeme`, `unused-in-s3` или
`example`: раньше плейсхолдеры из `.env.example` проходили проверку длины, и приложение поднималось с ключом
подписи JWT, который лежит в публичном репозитории (`INFRA-01`, закрыто). В логе будет перечислено, какие
именно переменные не прошли, — деплой упадёт сразу, а не тихо заработает с чужим ключом.

Если Railway показал эту ошибку — сгенерируйте значения и перезапустите: `openssl rand -base64 32` для двух
секретов, `openssl rand -base64 16` для токена метрик. Проверка ищет подстроку, поэтому осмысленную парольную
фразу со словом `example` внутри она тоже отклонит — берите случайные байты, а не придуманную строку.

---

## 6. Google OAuth — боевой клиент

Google Cloud Console → **APIs & Services → Credentials** → OAuth client ID, тип **Web application**.

- **Authorized redirect URIs**: `https://convert-hub-api-nine.vercel.app/v1/auth/google/callback` — ровно то же, что в
  `GOOGLE_REDIRECT_URI`. Расхождение в одном символе → Google отвечает `redirect_uri_mismatch`.
- **Authorized JavaScript origins**: `https://convert-hub-api-nine.vercel.app`

**Почему домен Vercel, а не Railway — самое неочевидное место деплоя.** Кнопка «Войти через Google» — это
полная навигация браузера на `/v1/auth/google/start`, то есть на Vercel. Прокси доносит её до Railway, тот
ставит cookie `oauth_state` — и браузер приписывает эту cookie **домену Vercel**, потому что именно его он
запрашивал. Если redirect URI указать на Railway напрямую, Google вернёт браузер на другой сайт, cookie
`oauth_state` туда не поедет, `state` не сойдётся и вход упадёт. Симптом при этом невнятный: «попробуйте
ещё раз», без единой ошибки в логах Google.

---

## 7. Vercel — фронтенд и прокси

Import Project → этот репозиторий. **Root Directory: корень репозитория.**

Настройки сборки задавать в интерфейсе не нужно — они лежат в `vercel.json` и переопределяют дашборд:

```
installCommand    pnpm install
buildCommand      pnpm --filter @convert-hub/shared build && pnpm --filter web build
outputDirectory   apps/web/dist/web/browser
```

Три вещи, ради которых `vercel.json` вообще существует:

1. **Прокси** — `/v1/:path*` уходит на Railway. Идёт первым правилом. Сюда вписывается хост из §5 —
   сейчас `converthub-production.up.railway.app`. При первом деплое там стоит `REPLACE-WITH-RAILWAY-HOST`:
   хост Railway ещё не существует, когда `vercel.json` уже нужен (§1).
2. **SPA-fallback** — всё остальное на `/index.html`. Без него прямая ссылка `/login`, `/files` или
   `/reset-password/<токен>` из письма даёт 404: файлов по этим путям нет, маршрутизация клиентская.
   Правила `rewrites` применяются после проверки файловой системы, поэтому реальные ассеты не затеняются.
3. **Запрет кеширования API** — заголовок `x-vercel-enable-rewrite-caching: 0` на `/v1/:path*`. Ответы
   внешних rewrite Vercel по умолчанию кеширует, а под этим префиксом живут `/v1/auth/me` и `/v1/files`.

Две вещи, на которых спотыкаются:

- `packages/shared` **обязан собраться первым** — `apps/web` импортирует его через `main`/`types` из `dist/`,
  которого нет в репозитории. Это уже учтено в `buildCommand`.
- Output Directory — **`dist/web/browser`**, не `dist/web`. С Angular 17+ сборщик кладёт результат в
  подпапку `browser/`; при неверном пути Vercel отдаёт пустую страницу без единой ошибки в логе.

---

## 8. Домены

Собственный домен не нужен: используются выданные `convert-hub-api-nine.vercel.app` и
`converthub-production.up.railway.app`. Оба существуют, DNS настраивать нечего.

Если домен появится — прикрепить его к проекту Vercel и заменить домен Vercel во всех трёх местах:
`CORS_ORIGIN`, `GOOGLE_REDIRECT_URI` и Authorized-поля Google. Прокси при этом остаётся рабочим и менять его
не обязательно (§9).

---

## 9. Почему прокси, а не два домена — не косметика

Refresh-токен живёт в cookie `HttpOnly; Secure; SameSite=Lax; Path=/v1/auth`
(`apps/api/src/modules/auth/auth.controller.ts#setRefreshCookie`, обоснование — `TECH-SPEC.md` §8.2).

`SameSite=Lax` означает: cookie уходит на XHR только если запрос **same-site**. `convert-hub-api-nine.vercel.app` и
`converthub-production.up.railway.app` — **разные сайты**: у них нет общего регистрируемого домена. Обращайся фронт
к Railway напрямую, `POST /v1/auth/refresh` не получил бы cookie никогда, и пользователя выбрасывало бы через
15 минут — на истечении access-токена.

Выходов было три, и выбран третий:

1. **Купить домен** (`example.com` + `api.example.com`) — работает, ничего в коде не меняет. Отклонено:
   владелец не хочет заводить домен под учебный проект.
2. **`SameSite=None; Secure`** — правка в 🔒-зоне `modules/auth/**` (два `res.cookie` и два `clearCookie`,
   которым тоже пришлось бы носить новые атрибуты, иначе logout перестал бы гасить cookie), отступление от
   `AUTH-RULES.md` §35 с записью в `docs/SECURITY.md` и построчной приёмкой. И главное — **оно не работает**:
   такая cookie является сторонней, а Safari блокирует сторонние cookie по умолчанию (ITP). Правка в самой
   чувствительной зоне ради решения, ломающегося у части пользователей.
3. **Обратный прокси на Vercel** — `vercel.json` переписывает `/v1/*` на Railway. Браузер видит **один
   origin**, cookie остаётся `SameSite=Lax` и является first-party, `modules/auth/**` не тронут,
   `AUTH-RULES.md` §35 соблюдён без отступления, работает во всех браузерах.

**Чем платит вариант 3.** Весь трафик API идёт через прокси Vercel, включая заливку файлов до 10 МБ и
конвертацию длительностью до 60 секунд. Лимитов на размер тела и таймаут для внешних `rewrites` Vercel в
документации **не публикует**, а соседний продукт той же площадки — serverless-функции — имеет потолок тела
4.5 МБ, из-за которого `TECH-SPEC.md` §13 и отклонил serverless для бэкенда. Проверяется это только
эмпирически, пунктами 2 и 3 в §11.

**Если прокси не потянет** — обращаться к Railway напрямую и закрывать cookie вариантом 1 (домен) либо 2
(`SameSite=None`, с оговоркой про Safari). Тогда придётся вернуть домен API в `environment.prod.ts` и
пересобрать фронт: значение вшивается на этапе сборки.

---

## 10. Порядок первого деплоя

1. **Vercel**: Import Project, Root Directory — корень. Записать выданный домен. Сборка на этом шаге
   упадёт или отдаст нерабочий прокси — это нормально, хост Railway ещё не вписан.
2. **R2**: бакет + токен (§2).
3. **Railway**: Postgres → Redis → Gotenberg → `api` (§3–5). Записать домен `api`.
4. **Google OAuth**: боевой клиент с redirect URI на домене Vercel (§6).
5. Переменные Railway (§5) — теперь известны оба имени. Дождаться, пока `api` станет healthy:
   `curl https://converthub-production.up.railway.app/health`.
6. Заменить `REPLACE-WITH-RAILWAY-HOST` в `vercel.json`, закоммитить, запушить → Vercel пересоберёт сам.
7. Smoke (§11).

---

## 11. Smoke после деплоя

Напрямую к Railway, мимо прокси:

```bash
curl https://converthub-production.up.railway.app/health
# → 200 {"status":"ok"}

curl https://converthub-production.up.railway.app/ready
# → 200 {"status":"ok","checks":{"db":"up","redis":"up","storage":"up"}}
#   storage:"down" → неверные R2-креды или у токена нет прав на HeadBucket (INFRA-03)

curl -H "Authorization: Bearer $METRICS_TOKEN" https://converthub-production.up.railway.app/metrics
# → 200 text/plain, converthub_* и process_*/nodejs_*
curl https://converthub-production.up.railway.app/metrics
# → 401
```

Через прокси — проверяет, что `vercel.json` вообще работает:

```bash
curl https://convert-hub-api-nine.vercel.app/v1/openapi.json
# → 200 application/json — всё работает.
#
# Два отказа ниже оба дают 404, но причины у них противоположные — различай по телу:
#
# → HTML со страницей приложения — прокси не сработал вообще: запрос поймал SPA-fallback,
#   значит правило /v1/:path* не первое в rewrites — либо vercel.json вообще не прочитан
#   (Root Directory проекта не корень репозитория — Vercel ищет конфиг именно там, см. §7)
#
# → {"status":"error","code":404,"message":"Application not found"} — прокси КАК РАЗ РАБОТАЕТ.
#   Это ответ края Railway: запрос дошёл, но сервиса с таким именем нет. Обычно значит, что в
#   vercel.json остался REPLACE-WITH-RAILWAY-HOST (§10 шаг 6). Нормальное состояние до §4.
```

В браузере на `https://convert-hub-api-nine.vercel.app`:

1. Регистрация → вход. **Перезагрузить страницу** — сессия обязана пережить. Это главная проверка того, ради
   чего взят прокси (§9). Не пережила — cookie не first-party, смотреть, точно ли запрос шёл на домен Vercel.
2. `JPG → PNG` файлом **около 9 МБ** — проверяет sharp, R2 `PutObject`, presigned-ссылку и заодно потолок
   тела у прокси (§9). Отказ здесь при работающем маленьком файле = прокси режет тело, нужен откат по §9.
3. `DOCX → PDF` — самая долгая конвертация; проверяет приватную сеть до Gotenberg и таймаут шлюза Vercel.
   Отказ при работающих остальных направлениях означает, что `GOTENBERG_URL` не резолвится.
4. `PDF → DOCX` — проверяет, что Python и `pdf2docx` реально попали в образ.
5. Файл > 10 МБ — отклоняется зоной загрузки, запрос не уходит.
6. Открыть `https://convert-hub-api-nine.vercel.app/reset-password/whatever` **в новой вкладке** — должна открыться
   страница приложения, а не 404. Это проверка SPA-fallback (§7); тем же путём приходят из письма.
7. Вход через Google — полный цикл до возврата на фронт. Проверяет §6.
8. Забыли пароль → письмо реально приходит, ссылка в нём ведёт на домен Vercel (проверяет `CORS_ORIGIN`).

---

## 12. Грабли, собранные заранее

| Симптом | Причина |
|---|---|
| Сборка Vercel падает на `nest build` и десятках ошибок TS в `apps/api` | Root Directory проекта = `apps/api`. API на Vercel не собирается **по замыслу** — там только статика и прокси (§7). Сами ошибки (`@convert-hub/shared` не найден, нет типов Prisma) — шум: не отработали ни сборка `shared`, ни `prisma generate` |
| Сборка падает на `Cannot find module '@convert-hub/shared'` в десятках файлов `apps/web` | Root Directory = `apps/web`, а не корень. `packages/shared/dist` в `.gitignore` и собирается `buildCommand`'ом из `vercel.json` — а его Vercel читает **из Root Directory**, то есть не видит (§7) |
| Сборка падает на «command "build" not found» в корне | Root Directory выставлен верно, но `vercel.json` ещё не на собираемой ветке: в корневом `package.json` скрипта `build` нет вовсе |
| Пустая белая страница на Vercel | Output Directory `dist/web` вместо `dist/web/browser` |
| Все запросы фронта в 404, отдаётся HTML вместо JSON | `REPLACE-WITH-RAILWAY-HOST` не заменён, либо правило `/v1/:path*` стоит после SPA-fallback и тот его перехватывает |
| 404 на `/login`, `/files`, `/reset-password/...` при заходе по прямой ссылке | нет SPA-fallback в `vercel.json` (§7) |
| Логин работает, но через 15 минут выкидывает | refresh-cookie не доходит: запрос ушёл на Railway напрямую, минуя прокси (§9) |
| Ответы API «залипают», пользователь видит чужие или устаревшие данные | не выставлен `x-vercel-enable-rewrite-caching: 0` — Vercel кеширует внешние rewrite (§7) |
| `redirect_uri_mismatch` от Google | `GOOGLE_REDIRECT_URI` ≠ Authorized redirect URI |
| Google-вход возвращает «попробуйте ещё раз», в логах Google чисто | redirect URI указывает на Railway, а не на Vercel — cookie `oauth_state` не доехала (§6) |
| Ссылка из письма сброса ведёт на голый API | `CORS_ORIGIN` = домен Railway вместо Vercel (§5) |
| Конвертация большого файла падает, маленький проходит | потолок тела у прокси Vercel (§9) — откат по §9 |
| Сборка Railway падает до первой строки: `dockerfile invalid: … missing the cacheKey prefix from its id` | В `Dockerfile` есть `--mount=type=cache` с обычным `id`. Railway требует `id=s/<service-id>-<path>` и не даёт подставить переменную — либо вшивать UUID, либо снять кеш. Снят (`INFRA-13`) |
| Контейнер `api` не стартует, в логе Prisma | БД недоступна в момент старта — `prisma migrate deploy` в entrypoint падает первым |
| Контейнер `api` не стартует, в логе «SMTP_USER/SMTP_PASSWORD не заданы» | В проде пара обязательна: анонимную отправку не принимает ни один провайдер, и без неё молча ломалось бы только восстановление пароля (`INFRA-12`). Задать обе — или ни одной, но тогда не `production` |
| Контейнер `api` не стартует, в логе «задаются только парой» | Задана половина `SMTP_USER`/`SMTP_PASSWORD` — почти всегда опечатка (`INFRA-12`) |
| Контейнер `api` не стартует, в логе «содержит плейсхолдер» | В `JWT_SECRET`/`SIGNED_URL_SECRET`/`METRICS_TOKEN` осталось значение из `.env.example` — так и задумано (`INFRA-01`), см. §5 |
| `DOCX→PDF` даёт `CONVERSION_FAILED`, остальное работает | `GOTENBERG_URL` не резолвится, или у Gotenberg нет writable `HOME`/`/tmp` |
| Долгая сборка / дорогие build-минуты | Образ ~1.5 ГБ: node + libvips + Python/PyMuPDF (`INFRA-07`) |
| `/ready` вечно `degraded`, storage `down` | Проверка в health зовёт `HeadBucket` — операцию уровня бакета (`INFRA-03`). На R2 токен `Object Read & Write`, ограниченный бакетом, её проходит (проверено), но политика S3 строго на `GetObject`/`PutObject` даст `403`. Токен не расширять до admin — дефект в пробе, а не в правах |

---

## 13. Чего в v1 нет

Осознанно, не забыто:

- CDN перед R2 (`TECH-SPEC.md` §12, шаг 4 при росте нагрузки).
- Реплика БД на чтение.
- Больше одного инстанса `api` — миграции при старте безопасны только для одного.
- Автоскейлинг, бэкапы по расписанию, алерты поверх `/metrics`.
- Заголовки безопасности (HSTS, CSP, `X-Frame-Options`), которых требует `TECH-SPEC.md` §12: Helmet в
  приложении не подключён, на площадке они тоже не настроены. Записано находкой `INFRA-10`.
- Фоновая уборка истёкших файлов и ночная сверка `storage_used_bytes` — не построены
  (`REVIEW-FINDINGS.md`, «Не построено»).
- Открытые находки безопасности и отказоустойчивости из `REVIEW-FINDINGS.md` — деплой их не закрывает.
  Все три, что здесь назывались обязательными к разбору до боевого трафика, **закрыты**: `INFRA-01` (ключ
  подписи JWT из публичного репозитория), `BE-OAUTH-01` (pre-hijacking через неподтверждённый Google-email),
  `BE-DOCX-01` (валидатор ZIP-бомбы верил заявленному размеру вместо фактической распаковки). Открытых 🔴 в
  бэклоге не осталось — но там ещё 13 🟠, и `REVIEW-FINDINGS.md` остаётся списком того, чего у этого сервиса
  нет. Полезно помнить при первом же публичном трафике: рантайм-переключателя у направления `DOCX→PDF` не
  существует — оно живо с момента деплоя, а не поднять `gotenberg` (§4) значит получить `CONVERSION_FAILED`
  вместо внятного отказа.
