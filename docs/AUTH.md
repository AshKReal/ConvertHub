# AUTH.md

Реальные auth-эндпоинты (спека 007). Инварианты, которым код обязан соответствовать при любой правке —
`AUTH-RULES.md` в корне репозитория, обязателен к прочтению целиком перед правками в `modules/auth/**`.

Пока покрыто: email + пароль (007). OAuth (Google, Telegram — 008) и восстановление пароля/удаление аккаунта
(009) — отдельные спеки, эндпоинтов ниже для них ещё нет.

## Эндпоинты

Базовый путь — `/v1/auth`. Тело запроса/ответа — `application/json`, кроме бинарных данных нигде в этом
модуле нет.

| Метод | Путь | Тело запроса | Тело ответа | Auth | Коды ошибок |
|---|---|---|---|---|---|
| `POST` | `/register` | `{email, password}` | `{accessToken, user: {id, email}}` | — | `INVALID_PARAMETER` (422, формат), `EMAIL_ALREADY_REGISTERED` (409), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/login` | `{email, password}` | `{accessToken, user: {id, email}}` | — | `INVALID_PARAMETER` (422), `INVALID_CREDENTIALS` (401 — единое сообщение на любую причину отказа), `RATE_LIMIT_EXCEEDED` (429) |
| `POST` | `/refresh` | — (refresh-токен из cookie) | `{accessToken, user: {id, email}}` | refresh-cookie | `UNAUTHENTICATED` (401) |
| `POST` | `/logout` | — (refresh-токен из cookie, опционально) | — (`204`) | — | — (идемпотентно, всегда `204`) |
| `GET` | `/me` | — | `{id, email}` | `Authorization: Bearer <accessToken>` | `UNAUTHENTICATED` (401) |

`register`/`login`/`refresh` дополнительно выставляют `Set-Cookie: refresh_token=...` (`HttpOnly`, `SameSite=Lax`,
`Secure` только при `NODE_ENV=production` — см. `docs/SECURITY.md`, `Path=/v1/auth` — кука не уходит на остальной
API). `logout` чистит её (`Max-Age=0`).

`register`/`login` рассчитывают лимит частоты (`FixedWindowRateLimiterService`, временно in-memory — 012 заменит
Redis-версией): по хешу IP на обоих, дополнительно по нормализованному email на `login` (`AUTH-RULES.md` §2).

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
