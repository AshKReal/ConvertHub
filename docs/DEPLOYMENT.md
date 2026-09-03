# DEPLOYMENT.md

Пошаговый деплой ConvertHub. Целевые площадки — `TECH-SPEC.md` §13: **Railway** (бэкенд + Gotenberg +
managed Postgres/Redis), **Vercel** (Angular-статика), **Cloudflare R2** (файлы).

Документ описывает **что нажать**. Обоснование выбора площадок — `TECH-SPEC.md` §13, границы системы —
`ARCHITECTURE.md` §10. Локальная разработка — `docs/SETUP.md`, это другой документ.

> **Статус:** написан до первого реального деплоя. Спека 017 не закрыта — это подготовка к ней, а не отчёт о
> проделанном. Всё ниже проверяемо только в момент, когда вы это делаете.

---

## 0. Что нужно завести заранее

| Что | Зачем |
|---|---|
| Аккаунт **Railway** | `api` (из `docker/api.Dockerfile`), `gotenberg`, managed Postgres, managed Redis |
| Аккаунт **Vercel** | статика `apps/web` на CDN |
| Аккаунт **Cloudflare** + R2 | объектное хранилище файлов |
| Проект **Google Cloud** | боевой OAuth 2.0 Client ID (dev-креды не переиспользовать) |
| **SMTP-провайдер** | восстановление пароля (спека 009). Resend / Postmark / Amazon SES / Mailgun |
| **Домен** с управлением DNS | `api.example.com` для бэкенда, `example.com` для фронта — см. §9, это не косметика |

---

## 1. Правка в коде — блокирует всё остальное

`apps/web/src/environments/environment.prod.ts` сейчас:

```ts
export const environment = {
  production: true,
  apiUrl: '', // TODO(017): реальный домен API при деплое
};
```

Angular вшивает это значение **на этапе сборки**, читать его из переменных окружения в рантайме нечем. Пока
`apiUrl` пуст — фронт в проде шлёт запросы на собственный origin и получает 404.

```ts
apiUrl: 'https://api.example.com',   // без слэша в конце
```

Закоммитить до первого деплоя Vercel.

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

Прикрепить домен: `api.example.com`.

### Переменные окружения (полный список — схема `apps/api/src/config/env.ts`)

Значение вне схемы роняет процесс на старте, а не на первом запросе — это задумано.

| Переменная | Значение | Примечание |
|---|---|---|
| `NODE_ENV` | `production` | отключает `pino-pretty`, включает `Secure` на refresh-cookie |
| `PORT` | `3000` | |
| `CORS_ORIGIN` | `https://example.com` | **точный домен фронта**, не `*`, без слэша. С `*` cookie с refresh-токеном не отправляется |
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
| `GOOGLE_REDIRECT_URI` | `https://api.example.com/v1/auth/google/callback` | **байт-в-байт** как в Google Console |
| `SMTP_HOST` | хост провайдера | |
| `SMTP_PORT` | `587` или `465` | |
| `SMTP_SECURE` | `false` для 587 (STARTTLS), `true` для 465 | строка `'true'`/`'false'`, не булев — см. докблок в `env.ts` |
| `SMTP_FROM` | `noreply@example.com` | должен пройти верификацию у провайдера |

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

- **Authorized redirect URIs**: `https://api.example.com/v1/auth/google/callback` — ровно то же, что в
  `GOOGLE_REDIRECT_URI`. Расхождение в одном символе → Google отвечает `redirect_uri_mismatch`, и это не наша
  ошибка, а несовпадение настроек.
- **Authorized JavaScript origins**: `https://example.com`

---

## 7. Vercel — фронтенд

Import Project → этот репозиторий.

| Настройка | Значение |
|---|---|
| Framework Preset | Angular |
| Root Directory | корень репозитория |
| Install Command | `pnpm install` |
| Build Command | `pnpm --filter @convert-hub/shared build && pnpm --filter web build` |
| **Output Directory** | **`apps/web/dist/web/browser`** |

Две вещи, на которых спотыкаются:

- `packages/shared` **обязан собраться первым** — `apps/web` импортирует его через `main`/`types` из `dist/`,
  которого нет в репозитории.
- Output Directory — **`dist/web/browser`**, не `dist/web`. С Angular 17+ сборщик кладёт результат в
  подпапку `browser/`; при неверном пути Vercel отдаёт пустую страницу без единой ошибки в логе
  (`TECH-SPEC.md` §13).

Прикрепить домены: `example.com` и `www.example.com`.

---

## 8. DNS

| Запись | Куда |
|---|---|
| `api.example.com` | CNAME на target, который выдаст Railway |
| `example.com`, `www` | по инструкции Vercel (A/CNAME) |

---

## 9. Домены и refresh-cookie — не косметика

Refresh-токен живёт в cookie `HttpOnly; Secure; SameSite=Lax; Path=/v1/auth`
(`apps/api/src/modules/auth/auth.controller.ts#respond`, обоснование — `TECH-SPEC.md` §8.2).

`SameSite=Lax` означает: cookie уходит на XHR только если запрос **same-site**, то есть у фронта и API общий
регистрируемый домен.

- ✅ `example.com` + `api.example.com` — один сайт, `POST /v1/auth/refresh` с `withCredentials` работает.
- ❌ `convert-hub.vercel.app` + `convert-hub-api.up.railway.app` — **разные сайты**. Cookie не уйдёт,
  `restoreSession()` и `ensureFreshToken()` всегда получат `401`, пользователя будет выкидывать после
  истечения access-токена (15 минут).

То есть: либо оба на поддоменах одного домена, либо менять cookie на `SameSite=None; Secure` — а это правка
кода в 🔒-зоне `modules/auth/**`, со всеми последствиями (построчная приёмка, запись в `docs/SECURITY.md` как
отступление от `AUTH-RULES.md` §2).

**Проверить это до деплоя, а не после.**

---

## 10. Порядок первого деплоя

1. Правка `environment.prod.ts` (§1), коммит.
2. R2: бакет + токен (§2).
3. Railway: Postgres → Redis → Gotenberg → `api` (§3–5). Дождаться, пока `api` станет healthy.
4. Google OAuth: боевой клиент (§6).
5. Vercel: сборка и деплой (§7).
6. DNS (§8), дождаться выпуска сертификатов.
7. Smoke (§11).

---

## 11. Smoke после деплоя

```bash
curl https://api.example.com/health
# → 200 {"status":"ok"}

curl https://api.example.com/ready
# → 200 {"status":"ok","checks":{"db":"up","redis":"up","storage":"up"}}
#   storage:"down" → неверные R2-креды или у токена нет прав на HeadBucket (INFRA-03)

curl -H "Authorization: Bearer $METRICS_TOKEN" https://api.example.com/metrics
# → 200 text/plain, converthub_* и process_*/nodejs_*
curl https://api.example.com/metrics
# → 401
```

В браузере на `https://example.com`:

1. Регистрация → вход. **Перезагрузить страницу** — сессия должна пережить (это и есть проверка §9).
2. `JPG → PNG`, скачивание результата — проверяет sharp, R2 `PutObject` и presigned-ссылку.
3. `DOCX → PDF` — проверяет приватную сеть до Gotenberg. Отказ здесь при работающих остальных направлениях
   означает, что `GOTENBERG_URL` не резолвится.
4. `PDF → DOCX` — проверяет, что Python и `pdf2docx` реально попали в образ.
5. Файл > 10 МБ — отклоняется зоной загрузки, запрос не уходит.
6. Вход через Google — полный цикл до возврата на фронт.
7. Забыли пароль → письмо реально приходит (проверяет SMTP).

---

## 12. Грабли, собранные заранее

| Симптом | Причина |
|---|---|
| Пустая белая страница на Vercel | Output Directory `dist/web` вместо `dist/web/browser` |
| Все запросы фронта в 404 / на свой домен | `apiUrl: ''` в `environment.prod.ts` |
| Логин работает, но через 15 минут выкидывает | Разные сайты у фронта и API — cookie `SameSite=Lax` не уходит (§9) |
| CORS-ошибка в консоли | `CORS_ORIGIN` со слэшем на конце, с `*`, или не тот домен |
| `redirect_uri_mismatch` от Google | `GOOGLE_REDIRECT_URI` ≠ Authorized redirect URI |
| Контейнер `api` не стартует, в логе Prisma | БД недоступна в момент старта — `prisma migrate deploy` в entrypoint падает первым |
| Контейнер `api` не стартует, в логе «содержит плейсхолдер» | В `JWT_SECRET`/`SIGNED_URL_SECRET`/`METRICS_TOKEN` осталось значение из `.env.example` — так и задумано (`INFRA-01`), см. §5 |
| `DOCX→PDF` даёт `CONVERSION_FAILED`, остальное работает | `GOTENBERG_URL` не резолвится, или у Gotenberg нет writable `HOME`/`/tmp` |
| Долгая сборка / дорогие build-минуты | Образ ~1.5 ГБ: node + libvips + Python/PyMuPDF (`INFRA-07`) |
| `/ready` вечно `degraded`, storage `down` | Токен R2 без прав на `HeadBucket` — проверка в health использует именно его (`INFRA-03`) |

---

## 13. Чего в v1 нет

Осознанно, не забыто:

- CDN перед R2 (`TECH-SPEC.md` §12, шаг 4 при росте нагрузки).
- Реплика БД на чтение.
- Больше одного инстанса `api` — миграции при старте безопасны только для одного.
- Автоскейлинг, бэкапы по расписанию, алерты поверх `/metrics`.
- Фоновая уборка истёкших файлов и ночная сверка `storage_used_bytes` — не построены
  (`REVIEW-FINDINGS.md`, «Не построено»).
- Открытые находки безопасности и отказоустойчивости из `REVIEW-FINDINGS.md` — деплой их не закрывает.
  `BE-OAUTH-01` (pre-hijacking через неподтверждённый Google-email) и `INFRA-01` (ключ подписи JWT из
  публичного репозитория) с тех пор **закрыты**; остаётся `BE-DOCX-01` — валидатор ZIP-бомбы верит заявленному
  в заголовке размеру, а не проверяет фактическую распаковку. Рантайм-переключателя у направления `DOCX→PDF`
  нет: оно живо с момента деплоя, единственный способ его не открывать — не поднимать сервис `gotenberg` (§4),
  и тогда направление отвечает `CONVERSION_FAILED`, а не внятным отказом. Либо закрыть `BE-DOCX-01` до
  публичного трафика — это предпочтительнее.
