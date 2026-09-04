import { environment } from '../../environments/environment';

/**
 * Префикс всех вызовов к API — общий для интерцепторов, которым надо отличить
 * «наш» запрос от чужого.
 *
 * Сравнивать с `environment.apiUrl` напрямую нельзя. В проде (017) фронт и API
 * живут на одном origin: статика на Vercel, `/v1/*` оттуда же переписывается на
 * Railway (`vercel.json`), поэтому `apiUrl` пуст и запросы уходят относительными
 * путями. А пустая строка — префикс любой строки, так что
 * `url.startsWith(environment.apiUrl)` в проде истинно **для каждого** запроса:
 * прежний вариант раздавал бы Bearer-токен кому попало и метил `X-Request-Id`
 * всё подряд. В dev (`apiUrl = http://localhost:3000`) баг не воспроизводится
 * вообще — поэтому правило вынесено в `matchesApiBase` отдельным параметром, и
 * тест проверяет обе конфигурации, не подменяя окружение.
 */
function baseFor(apiUrl: string): string {
  return `${apiUrl}/v1`;
}

export const API_BASE = baseFor(environment.apiUrl);

/** Ядро правила. `apiUrl` — параметр ровно ради теста на обеих конфигурациях. */
export function matchesApiBase(url: string, apiUrl: string): boolean {
  return url.startsWith(baseFor(apiUrl));
}

export function isApiUrl(url: string): boolean {
  return matchesApiBase(url, environment.apiUrl);
}
