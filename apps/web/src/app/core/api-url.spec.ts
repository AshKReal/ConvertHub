import { describe, expect, it } from 'vitest';

import { API_BASE, isApiUrl, matchesApiBase } from './api-url';

const PROD = '';
const DEV = 'http://localhost:3000';

describe('matchesApiBase — прод: фронт и API на одном origin, apiUrl пуст', () => {
  it('признаёт относительные пути API', () => {
    expect(matchesApiBase('/v1/auth/me', PROD)).toBe(true);
    expect(matchesApiBase('/v1/convert', PROD)).toBe(true);
    expect(matchesApiBase('/v1/openapi.json', PROD)).toBe(true);
  });

  it('не признаёт посторонний запрос', () => {
    // Ровно эти три случая ломала прежняя проверка `startsWith(apiUrl)`: пустая
    // строка — префикс любой строки, поэтому все они считались «нашими»,
    // получали Bearer-токен и метку `X-Request-Id`.
    expect(matchesApiBase('https://example.com/track', PROD)).toBe(false);
    expect(matchesApiBase('/assets/i18n/ru.json', PROD)).toBe(false);
    expect(matchesApiBase('/theme-init.js', PROD)).toBe(false);
  });
});

describe('matchesApiBase — dev: API на отдельном origin', () => {
  it('признаёт абсолютные вызовы к API', () => {
    expect(matchesApiBase('http://localhost:3000/v1/auth/me', DEV)).toBe(true);
  });

  it('отсекает чужой origin и не-API маршруты своего', () => {
    expect(matchesApiBase('http://localhost:4200/assets/logo.svg', DEV)).toBe(false);
    // `/health` и `/metrics` живут вне `/v1` — интерцепторам они не адресованы.
    expect(matchesApiBase('http://localhost:3000/health', DEV)).toBe(false);
  });
});

describe('привязка к окружению', () => {
  // Тесты идут на dev-окружении (`environment.ts`), прод-файл сюда не попадает —
  // проверяем, что экспортируемая пара действительно висит на нём, а не на своих
  // литералах.
  it('API_BASE и isApiUrl согласованы с environment', () => {
    expect(API_BASE).toBe(`${DEV}/v1`);
    expect(isApiUrl(`${DEV}/v1/files`)).toBe(true);
    expect(isApiUrl(`${DEV}/health`)).toBe(false);
  });
});
