# AUTH.md

Реальные auth-эндпоинты (спеки 007, 009). Инварианты, которым код обязан соответствовать при любой правке —
`AUTH-RULES.md` в корне репозитория, обязателен к прочтению целиком перед правками в `modules/auth/**`.

Пока покрыто: email + пароль, сессия (007); восстановление и смена пароля, удаление аккаунта (009). OAuth
(пока только Google — `AUTH-RULES.md` §5, спека 008) — отдельной спекой, эндпоинтов ниже для него ещё нет.

## Эндпоинты

Базовый путь — `/v1/auth`. Тело запроса/ответа — `application/json`, кроме бинарных данных нигде в этом
модуле нет.

| Метод | Путь | Тело запроса | Тело ответа | Auth | Коды ошибок |
|---|---|---|---|---|---|
| `POST` | `/register` | `{email, password}` | `{accessToken, user: {id, email}}` | — | `INVALID_PARAMETER` (422, формат), `EMAIL_ALREADY_REGISTERED` (409), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/login` | `{email, password}` | `{accessToken, user: {id, email}}` | — | `INVALID_PARAMETER` (422), `INVALID_CREDENTIALS` (401 — единое сообщение на любую причину отказа), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/refresh` | — (refresh-токен из cookie) | `{accessToken, user: {id, email}}` | refresh-cookie | `UNAUTHENTICATED` (401) |
| `POST` | `/logout` | — (refresh-токен из cookie, опционально) | — (`204`) | — | — (идемпотентно, всегда `204`) |
| `POST` | `/forgot-password` | `{email}` | — (`200`, всегда одно и то же тело) | — | `INVALID_PARAMETER` (422), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/reset-password` | `{token, password}` | — (`200`) | — | `INVALID_PARAMETER` (422), `INVALID_RESET_TOKEN` (400), `RATE_LIMIT_EXCEEDED` (429) |
| `PATCH` | `/password` | `{currentPassword, newPassword}` | — (`204`) | `Authorization: Bearer <accessToken>` | `INVALID_PARAMETER` (422), `INVALID_CREDENTIALS` (401 — неверный текущий пароль), `UNAUTHENTICATED` (401) |
| `DELETE` | `/account` | — | — (`204`) | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |
| `GET` | `/me` | — | `{id, email}` | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |

`register`/`login`/`refresh` дополнительно выставляют `Set-Cookie: refresh_token=...` (`HttpOnly`, `SameSite=Lax`,
`Secure` только при `NODE_ENV=production` — см. `docs/SECURITY.md`, `Path=/v1/auth` — кука не уходит на остальной
API). `logout` и `DELETE /account` чистят её (`Max-Age=0`).

`register`/`login`/`forgot-password` рассчитывают лимит частоты (`FixedWindowRateLimiterService`, временно
in-memory — 012 заменит Redis-версией): по хешу IP на всех трёх, дополнительно по нормализованному email на
`login`/`forgot-password` (`AUTH-RULES.md` §2). `change-password`/`delete-account` — без отдельного лимита: оба
уже за `JwtGuard`, брute-force имеет смысл только с украденным валидным токеном, а не с чистого листа.

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

## `GET /v1/convert`, `GET /v1/files/{id}/download` — опциональная авторизация

Эти маршруты (002/003/005) остаются гостевыми — `Authorization: Bearer` необязателен. Если заголовок есть и
токен валиден, `userId` берётся из него (файл привязывается к аккаунту, `save=true` не создаёт гостевую запись).
Любая проблема с токеном (нет, просрочен, невалиден) — тихий откат к гостю, не `401`: эти маршруты никогда не
требовали авторизации, отказывать здесь из-за протухшего токена в фоновой вкладке было бы неверно. Отличие от
`GET /v1/auth/me` — там `JwtGuard` жёсткий: маршрут без валидного токена не имеет смысла вообще.

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
