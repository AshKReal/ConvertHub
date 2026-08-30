# 008 — auth-providers

| | |
|---|---|
| Статус | код написан, приёмка владельцем не пройдена |
| Зависит от | 007 |
| Источник | ТЗ п. 3.2.2–3.2.4, `AUTH-RULES.md` |
| Критичность | 🔒 |

## Задача

Пользователь должен иметь возможность войти и зарегистрироваться через Google, а также привязать/отвязать его
от уже существующего аккаунта. Решение владельца (2026-08-30, `AUTH-RULES.md` §5): пока только Google —
GitHub из исходного ТЗ не реализуется вовсе, Telegram отложен с задокументированным на будущее контрактом
(`TECH-SPEC.md` §8.3).

## Входит

- Google OAuth 2.0 Authorization Code + PKCE, идентификация по `sub`, не по email
- Таблица `identities` (`provider` + `provider_uid`), `User.passwordHash` — nullable (чисто-Google аккаунт)
- Вход-или-регистрация одним потоком: identity уже привязана → вход; email свободен → новый аккаунт; email занят
  и подтверждён провайдером → привязка к существующему; email занят, не подтверждён → отказ, не тихая привязка
- Отвязка провайдера (`DELETE /v1/auth/identities/:provider`) с запретом отвязки последнего способа входа
- Подключение кнопки Google из 019 к реальному потоку
- Профиль (020): реальный список привязанных способов входа вместо мока на один провайдер, кнопка отвязки,
  скрытие формы смены пароля для аккаунта без пароля (решение владельца — расширение объёма относительно
  чек-листа `tasks.md`, см. план)

## Не входит

| Что | Где будет |
|---|---|
| Telegram Login Widget | Отложено вместе с провайдером — `AUTH-RULES.md` §5, кнопка в 019 остаётся мок-заглушкой |
| Привязка Google к уже залогиненному пользователю по клику из профиля (минуя email-эвристику) | Не решено — `callback` работает только в анонимном режиме вход-или-создание, отдельная задача при необходимости |
| 2FA | Решено не делать — `AUTH-RULES.md` §5 |

## Поведение

- Клик «Продолжить с Google» (вход или регистрация — одна и та же ссылка) → редирект на Google → согласие →
  редирект обратно, сессия уже установлена (cookie), фронт подхватывает её обычной перезагрузкой.
- Тот же Google-аккаунт повторно → тот же пользователь, не дубль.
- Google-аккаунт с новым email → новый пользователь без пароля.
- Google-аккаунт с email существующего пользователя и `email_verified: true` → привязка к нему.
- Google-аккаунт с email существующего пользователя и `email_verified: false` → отказ, редирект на
  `/login?oauthError=conflict`, тост с объяснением, ничего не меняется.
- Пользователь отменил согласие на экране Google или сбой сети/Google → `/login?oauthError=failed`.
- Профиль: карточка Google — «Отвязать», задизейблена с тултипом, если это единственный способ входа.
- Профиль: аккаунт без пароля — форма смены пароля скрыта, вместо неё ссылка на «Забыли пароль» (009).

## Ошибочные сценарии

| Ситуация | Что видит пользователь | Код |
|---|---|---|
| Email от Google занят чужим неподтверждённым аккаунтом | Редирект `/login?oauthError=conflict`, тост | `OAUTH_ACCOUNT_CONFLICT` (409) |
| `state`/`code_verifier` не совпал, просрочен, не найден; сбой обмена кода; отказ Google | Редирект `/login?oauthError=failed`, тост | — (не JSON, редирект) |
| Отвязка единственного способа входа | Кнопка задизейблена заранее; при гонке — тост | `LAST_LOGIN_METHOD` (409) |
| Неизвестный `:provider` в `DELETE /identities/:provider` | — (curl/API-клиент) | `INVALID_PARAMETER` (422) |
| Смена пароля на аккаунте без пароля | Форма скрыта в UI; curl/API — единое `INVALID_CREDENTIALS` | `INVALID_CREDENTIALS` (401) |

## Критерии приёмки

- [x] `GET /v1/auth/google/start` ставит `HttpOnly`-куку `oauth_state` и редиректит на корректный Google authorize URL с PKCE
- [x] Полный `state`/`code_verifier` раунд-трип (реальный сетевой вызов к Google token endpoint) — просроченный/несовпавший/повторно использованный `state`, отказ Google (`error=access_denied`) → `oauthError=failed`, не 500
- [x] Новый Google-аккаунт → новый `User` (`passwordHash: null`) + `Identity`, сессия выдана
- [x] Тот же `providerUid` повторно → тот же `userId`, не дубль (включая гонку параллельных колбэков — P2002 перехватывается)
- [x] Email существующего аккаунта + `email_verified: true` → привязка к нему, не новый аккаунт
- [x] Email существующего аккаунта + `email_verified: false` → `OAUTH_ACCOUNT_CONFLICT`, аккаунт не тронут
- [x] `DELETE /identities/:provider` отвязывает, когда есть другой способ входа; `LAST_LOGIN_METHOD`, когда это последний
- [x] `PATCH /password` на аккаунте без пароля → `INVALID_CREDENTIALS`, не падает
- [x] `GET /me`/`login`/`register`/`refresh` возвращают реальные `hasPassword`/`providers`
- [x] Фронт: кнопка Google — реальная навигация (`<a href>`), не эмуляция; профиль показывает реальный список,
  отвязку, скрытие формы пароля — проверено в браузере (Playwright), обе темы
- [x] `pnpm typecheck` и `pnpm lint` зелёные
- [x] `any` в диффе отсутствует
- [x] Секретов и HEX-цветов в диффе нет (кроме уже согласованных фирменных цветов Google/Telegram в `oauth-buttons.html`, 019)

---

## План

Полный план с обоснованиями и отвергнутыми вариантами — в истории сессии; здесь — выжимка реализованного.

### Подход

`Identity` — новая таблица, составной уникальный индекс `(provider, providerUid)`, `onDelete: Cascade` (то же
решение владельца, что 009). `User.passwordHash` стал nullable — `login()` (007) уже безопасен на этот случай
без изменений.

`GoogleOauthService` — чистый, без Prisma (тот же приём, что `token.service.ts`): собирает authorize URL,
обменивает `code` на токен и получает `userinfo` через встроенный `fetch` (Node 24, новой зависимости не
нужно). Сторонние JSON-формы узятся локальными Zod-схемами, не кастом.

`OauthStateService` — in-memory `Map` для PKCE `code_verifier` + anti-CSRF `state`, тот же временный приём, что
`FixedWindowRateLimiterService` (007) — Redis остаётся за 012.

`AuthService.loginOrLinkIdentity` — единая точка вход-или-привязка-или-создание; `unlinkIdentity` — отвязка с
проверкой последнего способа. Оба переиспользуют существующий `issueSession`/`normalizeEmail`.

`google/callback` — единственный маршрут, где исключения ловятся сами, не летят в `AllExceptionsFilter`: это
браузерная навигация, не JSON API (`docs/SECURITY.md` п. 6).

Профиль (020) переделан на реальные данные — решение владельца (`AskUserQuestion` в этой сессии): мок на один
провайдер иначе стал бы явно неточным для аккаунтов с двумя способами входа сразу после того, как Google
станет реальным.

### Отвергнутые варианты

См. `docs/SECURITY.md` (п. 6) и коммиты — сведены туда, не дублируются здесь третий раз. Кратко: без
`passport`/сторонних OAuth-библиотек (весь поток — три примитива: `URL`, `fetch`, `crypto`, ничего специфичного
для Google, что оправдывало бы зависимость); без верификации `id_token` через JWKS (тот же уровень доверия у
`userinfo`-эндпоинта, полученного тем же HTTPS-запросом с `client_secret`); без кнопки «привязать» в профиле
для незалогиненного состояния Google (см. «Не входит»).

---

## Чек-лист

- [x] Prisma: `Identity`, `User.passwordHash` nullable, миграция
- [x] `packages/shared`: `OAUTH_ACCOUNT_CONFLICT`/`LAST_LOGIN_METHOD`, `oauthProviderSchema`, `hasPassword`/`providers` в `authUserSchema`
- [x] `modules/auth/google-oauth.service.ts`, `modules/auth/oauth-state.service.ts`
- [x] `auth.service.ts`: `loginOrLinkIdentity`/`unlinkIdentity`; `account.service.ts`: null-passwordHash guard
- [x] `auth.controller.ts`: `google/start`, `google/callback`, `DELETE identities/:provider`, расширенный `me`
- [x] `auth.module.ts`, `env.ts`, `.env.example`, `docs/SETUP.md`
- [x] `docs/AUTH.md`, `docs/SECURITY.md`
- [x] Frontend: `AuthService` — identity-сигнал, `unlinkIdentity`, `googleStartUrl`
- [x] Frontend: `oauth-buttons`, `login-page`/`register-page` — реальная Google-кнопка + `oauthError` тост
- [x] Frontend: `profile-page` — реальный список методов, отвязка, скрытие формы пароля без пароля
- [x] Ручная проверка: curl (все ветки отказа `google/callback`, реальный сетевой вызов к Google) + прямые
  INSERT/UPDATE в Postgres для сценариев привязки/последнего способа + Playwright в реальном браузере (обе
  темы) для профиля и `oauthError`-тостов

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки
- [ ] Полный сквозной вход через настоящий Google-аккаунт (нужны реальные `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  от владельца — без них проверено всё, кроме самого экрана согласия Google)

### Для 🔒 — дополнительно

- [x] Найдены **все** места, где данные попадают в систему: `code`/`state`/`error` из query на `callback`,
  `:provider` из пути на `DELETE identities`, ответы Google (`token`/`userinfo`) — оба узятся Zod-схемами
- [x] Сравнение секретов постоянно по времени — не относится к новым сравнениям: `state` сверяется `===`
  намеренно (anti-CSRF nonce, эхом от Google открытым текстом, не секрет — обоснование в `docs/SECURITY.md`);
  новых сравнений паролей/хешей в этой спеке нет
- [x] Тип файла по сигнатуре — не относится (нет загрузки файлов)
- [x] Имя файла от клиента нигде не используется как путь — не относится
- [x] Каждый `catch` различает причины — P2002 в `loginOrLinkIdentity` (гонка identity vs прочее), `google/callback` (state/сеть/`OAUTH_ACCOUNT_CONFLICT` — разные `oauthError`)
- [x] В лог не попадают секреты — `GoogleOauthService` не логирует `client_secret`/`code`/`access_token`
- [x] Ошибка не раскрывает существование чужого аккаунта сверх необходимого — `OAUTH_ACCOUNT_CONFLICT` говорит
  уже аутентифицированному через Google пользователю о его же email, не оракул для постороннего
- [x] Ресурсы освобождаются в `finally` — не относится (нет файловых хендлов); `oauth_state` — одноразовая
  запись, удаляется в `consume()` до любых дальнейших веток, даже при ошибке позже

### После мержа

- [ ] Решения-долгожители перенесены в TECH-SPEC.md или ARCHITECTURE.md
- [ ] Статус в реестре обновлён
- [ ] Ошибки агента записаны в AI-JOURNAL.md
