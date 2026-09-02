# AUTH.md

Реальные auth-эндпоинты (спеки 007, 009). Инварианты, которым код обязан соответствовать при любой правке —
`AUTH-RULES.md` в корне репозитория, обязателен к прочтению целиком перед правками в `modules/auth/**`.

Пока покрыто: email + пароль, сессия (007); восстановление и смена пароля, удаление аккаунта (009); Google OAuth,
привязка/отвязка (008, пока только Google — `AUTH-RULES.md` §5, Telegram отложен); API-ключи — выпуск, список,
перевыпуск, отзыв (011).

## Эндпоинты

Базовый путь — `/v1/auth`. Тело запроса/ответа — `application/json`, кроме бинарных данных нигде в этом
модуле нет.

`user`/`{id, email, hasPassword, providers}` — `hasPassword`/`providers` (008): реальный список привязанных
способов входа, не только текущий метод сессии. Нативная регистрация — тривиально `{hasPassword: true,
providers: []}`, других способов входа тогда ещё не существует.

| Метод | Путь | Тело запроса | Тело ответа | Auth | Коды ошибок |
|---|---|---|---|---|---|
| `POST` | `/register` | `{email, password}` | `{accessToken, user}` | — | `INVALID_PARAMETER` (422, формат), `EMAIL_ALREADY_REGISTERED` (409), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/login` | `{email, password}` | `{accessToken, user}` | — | `INVALID_PARAMETER` (422), `INVALID_CREDENTIALS` (401 — единое сообщение на любую причину отказа), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/refresh` | — (refresh-токен из cookie) | `{accessToken, user}` | refresh-cookie | `UNAUTHENTICATED` (401) |
| `POST` | `/logout` | — (refresh-токен из cookie, опционально) | — (`204`) | — | — (идемпотентно, всегда `204`) |
| `GET` | `/google/start` | — | `302` на Google | — | — (полная навигация браузера, не JSON) |
| `GET` | `/google/callback` | — (`code`/`state` в query, от Google) | `302` на фронт | — | — (все отказы — редирект `?oauthError=conflict\|failed`, не JSON-код — см. ниже) |
| `DELETE` | `/identities/:provider` | — | — (`204`, идемпотентно) | `Authorization: Bearer <accessToken>` | `INVALID_PARAMETER` (422 — неизвестный провайдер), `LAST_LOGIN_METHOD` (409), `UNAUTHENTICATED` (401) |
| `POST` | `/forgot-password` | `{email}` | — (`200`, всегда одно и то же тело) | — | `INVALID_PARAMETER` (422), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/reset-password` | `{token, password}` | — (`200`) | — | `INVALID_PARAMETER` (422), `INVALID_RESET_TOKEN` (400), `RATE_LIMIT_EXCEEDED` (429) |
| `PATCH` | `/password` | `{currentPassword, newPassword}` | — (`204`) | `Authorization: Bearer <accessToken>` | `INVALID_PARAMETER` (422), `INVALID_CREDENTIALS` (401 — неверный текущий пароль, в т.ч. для чисто-Google аккаунта без пароля), `UNAUTHENTICATED` (401) |
| `DELETE` | `/account` | — | — (`204`) | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |
| `GET` | `/me` | — | `user` | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |

`register`/`login`/`refresh` дополнительно выставляют `Set-Cookie: refresh_token=...` (`HttpOnly`, `SameSite=Lax`,
`Secure` только при `NODE_ENV=production` — см. `docs/SECURITY.md`, `Path=/v1/auth` — кука не уходит на остальной
API). `logout` и `DELETE /account` чистят её (`Max-Age=0`).

`register`/`login`/`forgot-password` рассчитывают лимит частоты (`RateLimiterService` — token bucket в Redis,
012): по хешу IP на всех трёх, дополнительно по нормализованному email на `login`/`forgot-password`
(`AUTH-RULES.md` §2), 10 попыток / 10 минут. Redis недоступен → fail-open (`docs/SECURITY.md` §3).
`change-password`/`delete-account` — без отдельного лимита: оба уже за `JwtGuard`, брute-force имеет смысл только
с украденным валидным токеном, а не с чистого листа.

## Восстановление и смена пароля, удаление аккаунта (009)

`forgot-password`/`reset-password` — тот же опаковый токен + SHA-256-хеш приём, что refresh-токен (007), своя
таблица `password_reset_tokens`, TTL 30 минут (`PASSWORD_RESET_TOKEN_TTL_SECONDS`), одноразовый. Запрос нового
токена гасит все ещё не использованные токены того же пользователя — живой ссылки на аккаунт не больше одной.
Письмо со ссылкой (`${CORS_ORIGIN}/reset-password/<token>`) уходит через `MailService`, не дожидаясь ответа
клиенту (`docs/SECURITY.md` п. 5). Успешный `reset-password` не логинит автоматически — фронт (020) показывает
экран успеха со ссылкой на `/login`.

И `reset-password`, и `PATCH /password` отзывают ВСЕ refresh-токены пользователя (`AUTH-RULES.md` §2) и шлют
письмо-уведомление о смене пароля. Уже выданные access-токены при этом не отзываются (см. риск logout в
`docs/SECURITY.md` — тот же 15-минутный компромисс).

`DELETE /account` удаляет аккаунт полностью и необратимо: сохранённые файлы стираются из `Storage` (реальные
байты, не только строки в БД), история конвертаций и refresh-токены исчезают каскадом вместе со строкой `users`.
Подтверждение пароля не требуется — решение владельца, спека 009: `JwtGuard` уже гарантирует действующую сессию,
020 предусматривает только модалку подтверждения.

## Google OAuth (008)

Authorization Code + PKCE (`AUTH-RULES.md`), идентификация по `sub` (`identities.provider_uid`), не по email —
email на стороне Google может смениться.

```
1. Браузер: <a href="/v1/auth/google/start"> — полная навигация, не XHR
2. GET /v1/auth/google/start
   ← 302 на accounts.google.com + Set-Cookie: oauth_state (HttpOnly, SameSite=Lax, Path=/v1/auth/google, TTL 10 мин)
3. Пользователь соглашается на экране Google
4. Google → 302 на GET /v1/auth/google/callback?code=...&state=...
5. Сервер: state из query === state из куки (anti-CSRF), code_verifier — из OauthStateService по state (PKCE)
6. Сервер → Google: обмен code на access_token (POST, client_secret), затем GET userinfo (sub, email, email_verified)
7. AuthService.loginOrLinkIdentity(...) — вход/привязка/создание аккаунта (ниже)
8. ← 302 на CORS_ORIGIN + Set-Cookie: refresh_token (та же кука, что login/register)
9. Фронт грузится заново → обычный restoreSession() (уже существующий, 007) подхватывает cookie — accessToken никогда не оказывается в URL
```

**Вход или привязка (`loginOrLinkIdentity`).** `identities` уже содержит этот `provider_uid` → вход на связанный
аккаунт. Не содержит: email свободен → новый аккаунт (`passwordHash: null`) + `identities`-строка одной
транзакцией. Email занят существующим аккаунтом и Google подтвердил владение (`email_verified: true`) →
`identities`-строка добавляется к существующему аккаунту (привязка). Email занят, но `email_verified: false` →
`OAUTH_ACCOUNT_CONFLICT` (409) — не линковать (`AUTH-RULES.md`: привязка только при подтверждённом провайдером
email — иначе вектор захвата чужого аккаунта неподтверждённым адресом) и не создавать второй аккаунт с тем же
email (`users.email` уникален).

**`google/callback` — единственный маршрут, где исключения ловятся сами, не летят в `AllExceptionsFilter`** —
Google приводит сюда браузер полной навигацией, `application/problem+json` через неё не отдать. Любой отказ
(`state` не совпал/просрочен, сеть, `OAUTH_ACCOUNT_CONFLICT`, пользователь отменил согласие) — редирект на
`/login?oauthError=conflict` (только конфликт email) или `?oauthError=failed` (всё остальное); фронт (008) читает
параметр и показывает тост, форма входа/регистрации не зависает.

**Отвязка.** `DELETE /identities/:provider` идемпотентна (не привязан — `204`, не ошибка), но `AUTH-RULES.md`
запрещает отвязку последнего способа входа: если после отвязки не останется ни пароля, ни другой `identities`-
строки — `LAST_LOGIN_METHOD` (409), сама отвязка не происходит.

## API-ключи (011)

Второй независимый механизм аутентификации (`TECH-SPEC.md` §8.1): ключ — для публичного API (012), сессия — для
веба; одно не даёт доступа к другому. Выпуск/список/перевыпуск/отзыв — всегда под сессией (`JwtGuard`), никогда
по самому ключу. Базовый путь — `/v1/api-keys`, тело — `application/json`.

В БД (`api_keys`) — только SHA-256-хеш полного значения и префикс для показа (`ch_live_a1b2`), тот же приём, что
refresh-токен (007). Полное значение (`ch_live_` + 32 символа `[a-z0-9]`, ~165 бит) отдаётся клиенту ровно один
раз — в ответе на выпуск и перевыпуск. Ключ — неизменяемая строка: перевыпуск = `revokedAt` старой строке +
INSERT новой в одной транзакции, отзыв = `revokedAt`. `revokedAt IS NULL` — единственный предикат «действует».
Предел активных ключей на пользователя — `MAX_ACTIVE_API_KEYS` (`packages/shared`).

| Метод | Путь | Тело запроса | Тело ответа | Auth | Коды ошибок |
|---|---|---|---|---|---|
| `GET` | `/v1/api-keys` | — | `{items: [{id, environment, maskedPrefix, createdAt, lastUsedAt}]}` (только активные) | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |
| `POST` | `/v1/api-keys` | — | `{…item, fullValue}` (полное значение один раз) | `Authorization: Bearer <accessToken>` | `API_KEY_LIMIT_REACHED` (422), `UNAUTHENTICATED` (401) |
| `POST` | `/v1/api-keys/:id/reissue` | — | `{…item, fullValue}` (полное значение один раз) | `Authorization: Bearer <accessToken>` | `API_KEY_NOT_FOUND` (404), `UNAUTHENTICATED` (401) |
| `DELETE` | `/v1/api-keys/:id` | — | — (`204`) | `Authorization: Bearer <accessToken>` | `API_KEY_NOT_FOUND` (404 — чужой/несуществующий id; свой уже отозванный — идемпотентный `204`), `UNAUTHENTICATED` (401) |

`:id` не валидируется отдельно — кривой id не отличается от «не твой»/«нет такого», всё сводится в
`API_KEY_NOT_FOUND` (404, не 403 — `critical-zones.md`).

## Ключ в публичном API (012)

Машиночитаемое описание публичного API — `GET /v1/openapi.json` (013): OpenAPI 3.1, собран из тех же Zod-схем
`packages/shared`, что валидируют запросы; `securitySchemes.bearerAuth` = этот же заголовок. Публичный, без
guard.

`ch_live_…`/`ch_test_…` в `Authorization: Bearer` на `POST /v1/convert`, `GET /v1/files`,
`GET /v1/files/{id}/download` (`RequestIdentityService`, `common/auth/`): `sha256(значение)` → строка `api_keys`
с `revokedAt IS NULL` → пользователь-владелец. `last_used_at` отмечается fire-and-forget. `PATCH /v1/files/{id}`
(тумблер `save`) — только под сессией (`TECH-SPEC.md` §8.1).

**Ключ vs JWT в одном заголовке.** Различаются по префиксу `ch_live_`/`ch_test_` — есть → ключ, нет → JWT
сессии. Ключ найден и не отозван → пользователь; ключ (префикс есть), но не найден/отозван → `INVALID_API_KEY`
(401) на **любом** из этих маршрутов (решение владельца — явный отказ, не тихий гость). Плохой/отсутствующий
JWT — по-прежнему тихий гость.

**Rate limit** (`RateLimiterService`, token bucket в Redis, `TECH-SPEC.md` §6) на `POST /v1/convert`:

| Идентичность | Бакеты |
|---|---|
| гость | `rl:guest:<hashIp>` — 5 / час |
| сессия или ключ | `rl:user:<userId>` — 100 / сутки |
| ключ дополнительно | `rl:api:<userId>` — 60 / минуту (на пользователя, не на ключ) |

Превышение любого → `429 RATE_LIMIT_EXCEEDED` + `Retry-After` + `X-RateLimit-Limit/Remaining/Reset` (по самому
узкому бакету). Redis недоступен → fail-open (`docs/SECURITY.md` §3).

**`Idempotency-Key`** (UUID) на `POST /v1/convert`: повтор с тем же ключом в течение 24ч → сохранённый ответ
(`X-Idempotent-Replay: true`), без повторной конвертации и без списания лимита частоты. Повтор во время
выполнения первого → `409 IDEMPOTENCY_KEY_CONFLICT`. Не UUID → `422 INVALID_PARAMETER`. Механика и режим отказа —
`docs/SECURITY.md` §7.

## `POST /v1/convert`, `GET /v1/files`, `GET /v1/files/{id}/download` — опциональная авторизация

`POST /v1/convert` и `GET /v1/files/{id}/download` (002/003/005) остаются гостевыми — `Authorization: Bearer`
необязателен. Если заголовок есть и это валидный JWT либо действующий ключ, `userId` берётся из него (файл
привязывается к аккаунту). Протухший/невалидный JWT — тихий откат к гостю, не `401`: эти маршруты никогда не
требовали авторизации. Отозванный/несуществующий **ключ** — исключение: `INVALID_API_KEY` (012, выше).
`GET /v1/files` (список) авторизацию требует жёстко — гостю показывать нечего, `UNAUTHENTICATED`. Отличие от
`GET /v1/auth/me` — там `JwtGuard`, ключ не принимается вовсе.

## Поток: вход и обновление токена

```
1. POST /v1/auth/login {email, password}
2. ← 200 {accessToken, user} + Set-Cookie: refresh_token (HttpOnly, SameSite=Lax, Path=/v1/auth)
3. accessToken → сигнал в AuthService (в памяти, 15 минут — apps/web/core/services/auth.ts)
4. При 401 на защищённом маршруте → POST /v1/auth/refresh (cookie уходит автоматически, `withCredentials`)
5. ← новый accessToken + новый refresh_token (ротация)
6. Повтор исходного запроса
7. Refresh тоже 401 → AuthService.logout() локально, редирект на /login
```

**Гонка при обновлении.** Несколько запросов почти одновременно получили `401` → клиент вызывает `refresh`
ровно один раз (`AuthService.ensureFreshToken()`, single-flight на стороне фронта — `ARCHITECTURE.md` §7).
Отдельно от этого сервер тоже терпим к одной и той же ситуации между разными вкладками: повторное предъявление
непосредственно предыдущего (только что заменённого) refresh-токена в течение 10 секунд (`REFRESH_REUSE_GRACE_SECONDS`,
`packages/shared`) не считается кражей — сервер просто повторяет выдачу с текущего актуального звена цепочки.
Вне этого окна, или токен старше непосредственного предшественника — кража: все refresh-токены пользователя
отзываются (`revokedAt`), следующий `refresh` любым из них — `401`.

## Пароли

argon2id (`AUTH-RULES.md` §2), параметры — `docs/SECURITY.md`. Логин с несуществующим email всё равно вызывает
`argon2.verify` против фиксированного dummy-хеша — без этого время ответа отличало бы существующий email от
несуществующего даже при одинаковом тексте ошибки.
