# 004 — error-contract

| | |
|---|---|
| Статус | draft |
| Зависит от | 027 |
| Источник | ТЗ п. 6.6, 12.5 |
| Критичность | обычная |

## Задача

Пользователь и интегратор API должны увидеть по любой ошибке конкретный, переведённый и машиночитаемый ответ, а не текст «Ошибка загрузки». Компонент интерфейса должен уметь показать эту ошибку, ни разу не заглянув в сырой ответ сервера.

## Входит

- Реестр кодов ошибок в `packages/shared` — источник правды для клиента и (позже) для сервера
- Тип `AppError` — форма, с которой работают компоненты
- `errorInterceptor`, превращающий `HttpErrorResponse` в `AppError`
- Тексты по каждому коду на трёх языках, с конкретными числами там, где они есть в контракте
- Явная карта код → ключ словаря, чтобы забытый перевод не компилировался

## Не входит

| Что | Где будет |
|---|---|
| `AllExceptionsFilter`, реальный `problem+json` от сервера | 026 |
| Подключение `errorInterceptor` к `provideHttpClient` | 026 (вместе с первым реальным запросом) |
| Показ `AppError` в зоне загрузки / тосте / баннере | 006 |
| Форматирование meta-полей для кодов, кроме `FILE_TOO_LARGE` | появится вместе с 026, когда бэкенд определит остальные поля |

## Поведение

- Когда сервер отвечает `problem+json` с известным `code`, `errorInterceptor` превращает ответ в `AppError` с переведённым `message`, `requestId` из `request_id` и `retryable` из реестра.
- Когда `code` неизвестен или отсутствует, `errorInterceptor` не падает — использует запасной код `CONVERSION_FAILED`.
- Когда ошибка HTTP пришла не в форме `problem+json` (например, обрыв сети), интерцептор всё равно возвращает `AppError`, а не пробрасывает сырой `HttpErrorResponse`.
- Когда ошибка вообще не HTTP (не `HttpErrorResponse`), интерцептор не трогает её и пробрасывает как есть.

## Ошибочные сценарии

Коды — `packages/shared/src/constants/error-codes.ts`. Тексты — `apps/web/src/app/core/i18n/messages/{en,ru,uk}.ts`.

| Ситуация | Что видит пользователь (en) | Код |
|---|---|---|
| Файл больше лимита | «File is {actual}, the limit is {max}. Choose a smaller file.» | `FILE_TOO_LARGE` |
| Формат не поддержан направлением | «This file type isn't supported for this conversion...» | `UNSUPPORTED_FILE_TYPE` |
| Содержимое не совпадает с расширением | «The file's content doesn't match its name...» | `FILE_TYPE_MISMATCH` |
| Слишком много запросов | «Too many requests. Try again in a minute.» | `RATE_LIMIT_EXCEEDED` |
| Код ошибки не распознан | сообщение запасного кода | `CONVERSION_FAILED` (fallback) |

## Критерии приёмки

- [ ] Для каждого `ErrorCode` есть запись в `ERROR_MESSAGE_KEYS` и перевод en/ru/uk — забытая запись не компилируется
- [ ] `HttpErrorResponse` с телом `{ code: 'FILE_TOO_LARGE', meta: { actual_size_bytes, max_size_bytes } }` → `AppError.message` содержит оба размера в читаемом виде (МБ/КБ, не байты), `retryable === false`
- [ ] `HttpErrorResponse` с неизвестным или отсутствующим `code` → `AppError.code === 'CONVERSION_FAILED'`, интерцептор не бросает исключение
- [ ] `pnpm typecheck` и `pnpm lint` зелёные
- [ ] `any` в диффе отсутствует
- [ ] Секретов и HEX-цветов в диффе нет

---

## План

### Подход

Реестр кодов — простой `as const`-объект в `packages/shared`, без зависимостей от Angular (правило `shared-package.md`). На клиенте `errorInterceptor` — чистая функция вида `HttpErrorResponse → AppError`: достаёт `code`/`request_id`/`meta` из тела, находит переведённый текст по явной карте `ERROR_MESSAGE_KEYS`, подставляет `retryable` из реестра. Числа из `meta` идут в текст как есть, кроме задокументированной пары размеров файла — она форматируется в МБ/КБ тем же `I18nService.formatBytes`, что уже использует зона загрузки.

Интерцептор не регистрируется в `app.config.ts`: `provideHttpClient` в приложении пока не вызывается вообще (все экраны фронтенд-фазы на моках), регистрировать перехватчик раньше первого реального запроса — держать код, который нечем проверить.

### Затрагиваемые файлы

- `packages/shared/src/constants/error-codes.ts` — новый
- `packages/shared/src/index.ts` — экспорт нового модуля
- `apps/web/src/app/core/interceptors/error-interceptor.ts` — новый, `AppError` + `errorInterceptor`
- `apps/web/src/app/core/i18n/messages.ts` — карта `ERROR_MESSAGE_KEYS`
- `apps/web/src/app/core/i18n/messages/en.ts`, `ru.ts`, `uk.ts` — тексты по кодам
- `SPECS.md`, `tasks.md` — статус

### Отвергнутые варианты

| Вариант | Почему отвергнут | Когда вернёмся |
|---|---|---|
| `AppError` и `errorInterceptor` в `packages/shared` | Пакет не должен тянуть `@angular/common/http` (правило `shared-package.md`: только `zod` и стандартная библиотека) | — |
| Ключ словаря шаблонной строкой `error.${code}` | Компилятор не поймает забытый перевод при добавлении нового кода — ровно то, от чего защищает `MessageKey`-типизация | — |
| Кодировать нюансы повтора (`RATE_LIMIT_EXCEEDED` — после `Retry-After`, `CONVERSION_FAILED` — однократно) отдельными полями | Реестр в TECH-SPEC §7.5 просит ровно `status`/`retryable`; политика повтора — забота вызывающего кода, а не контракта | Если появится второй потребитель `retryable` с другой логикой |
| Форматировать все числовые `meta`-поля универсально | Задокументирована только пара `actual_size_bytes`/`max_size_bytes`; остальные поля контракта появятся вместе с 026 — придумывать их сейчас означает гадать | 026, когда бэкенд определит поля для остальных кодов |

### Риски и границы транзакций

БД не затрагивается. Единственный риск — рассинхрон с бэкендом: пока 026 не реализован, поля `meta` для кодов, кроме `FILE_TOO_LARGE`, не подтверждены реальным сервером. Тексты для них написаны без плейсхолдеров-чисел там, где число не гарантировано контрактом, — это осознанное ограничение, а не забывчивость.

### Мои тест-кейсы

- Тело `{ code: 'FILE_TOO_LARGE', request_id: 'req_1', meta: { actual_size_bytes: 14680064, max_size_bytes: 10485760 } }` → сообщение содержит оба размера в МБ, `retryable === false`, `requestId === 'req_1'`.
- Тело без поля `code` → `AppError.code === 'CONVERSION_FAILED'`, интерцептор не бросает исключение дальше пайплайна.
- Тело с `code`, которого нет в реестре (опечатка бэкенда) → тот же запасной код, а не `undefined` в переводе.
- `error` внутри `HttpErrorResponse` — не объект (например, `ProgressEvent` при обрыве сети) → всё равно валидный `AppError` с запасным кодом.
- Ошибка, не являющаяся `HttpErrorResponse` (исключение из кода компонента выше по пайплайну) — интерцептор не трогает её.

---

## Чек-лист

- [x] `packages/shared/src/constants/error-codes.ts` — реестр `as const`
- [x] `AppError` и `errorInterceptor` в `core/interceptors`
- [x] `ERROR_MESSAGE_KEYS` и тексты en/ru/uk по каждому коду

### Приёмка

- [ ] Критерии из спеки пройдены руками, а не в уме
- [ ] Мои тест-кейсы прогнаны
- [ ] Враждебное второе мнение: новый чат, только код, без плана и объяснений автора
- [ ] `git diff` не содержит файлов вне постановки

### После мержа

- [ ] Решения-долгожители перенесены в TECH-SPEC.md или ARCHITECTURE.md
- [ ] Статус в реестре обновлён
- [ ] Ошибки агента записаны в AI-JOURNAL.md
