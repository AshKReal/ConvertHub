/**
 * Значения объявляются здесь один раз. Проверка, что пакет действительно общий
 * (ARCHITECTURE.md §13): смена лимита обязана менять подпись под зоной загрузки
 * и валидацию на сервере без единой правки в них.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Реальный расчёт занятого места — спека 010; здесь только предел (AGENTS.md). */
export const USER_STORAGE_QUOTA_BYTES = 300 * 1024 * 1024;

/**
 * Decompression bomb: заявленное в заголовке изображения разрешение проверяется
 * до декодирования пикселей (TECH-SPEC.md §6, §9; specs/002-convert-jpg-png.md).
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

/**
 * Заявленное число страниц PDF проверяется до запуска движка `PDF→DOCX`
 * (TECH-SPEC.md §6; спека 005) — код и число были зарезервированы с 004,
 * реализованы только теперь, когда появился первый потребитель PDF-ввода.
 */
export const MAX_PDF_PAGES = 50;

/**
 * Спека 003. TTL подписанной ссылки на скачивание — время между `302` на
 * `GET /v1/files/{id}/download` и обращением по самой ссылке, не срок жизни
 * самого файла (тот — `GUEST_FILE_TTL_SECONDS`/бессрочно, ARCHITECTURE.md §11).
 */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Срок жизни сохранённого файла гостя (не авторизован) — TECH-SPEC.md §11. */
export const GUEST_FILE_TTL_SECONDS = 60 * 60;

/**
 * Спека 010. Срок жизни файла, у которого пользователь сознательно снял
 * `save` (тумблер на `/files`) — то же значение, что `GUEST_FILE_TTL_SECONDS`
 * сегодня, но отдельная константа: гостевой файл анонимен по умолчанию, этот
 * — осознанно снят вошедшим пользователем, разные смыслы могут разойтись
 * числом позже. Мягкое истечение (`File.expiresAt`), не немедленное удаление
 * — решение владельца, обратимо повторным включением `save` до истечения.
 */
export const UNSAVED_FILE_GRACE_SECONDS = 60 * 60;

/** Спека 007. Access-токен — TECH-SPEC.md §8.2. */
export const JWT_ACCESS_TTL_SECONDS = 15 * 60;

/** Спека 007. Refresh-токен, хранится в cookie — TECH-SPEC.md §8.2. */
export const JWT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Спека 007. Окно терпимости на повторное предъявление непосредственно
 * предыдущего (уже заменённого) refresh-токена — решение владельца против
 * гонки из ARCHITECTURE.md §7 (несколько вкладок обновляются одновременно).
 * Вне этого окна или не на непосредственном предшественнике — кража,
 * `auth.service.ts#refresh` завершает все сессии пользователя.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

/**
 * Спека 007. Была заглушкой в `apps/web` (019) с комментарием «настоящую
 * политику задаёт 007» — теперь источник один, серверная Zod-схема и
 * клиентская подсказка читают отсюда.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Спека 007. Временный in-memory лимитер на login/register (не Redis —
 * тот резервируется под 012, AUTH-RULES.md §2 требует rate limit здесь
 * уже сейчас). Считается и по хешу IP, и по email — см. `auth.controller.ts`.
 */
export const AUTH_RATE_LIMIT_MAX = 10;
export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

/** Спека 009. Ссылка сброса пароля — TECH-SPEC.md §8.5. */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;
