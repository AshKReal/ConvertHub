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
 * Спека 003. TTL подписанной ссылки на скачивание — время между `302` на
 * `GET /v1/files/{id}/download` и обращением по самой ссылке, не срок жизни
 * самого файла (тот — `GUEST_FILE_TTL_SECONDS`/бессрочно, ARCHITECTURE.md §11).
 */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Срок жизни сохранённого файла гостя (не авторизован) — TECH-SPEC.md §11. */
export const GUEST_FILE_TTL_SECONDS = 60 * 60;
