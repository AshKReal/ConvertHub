/**
 * `apps/api` включает CORS только для `CORS_ORIGIN` (по умолчанию
 * `http://localhost:4200`, `apps/api/.env.example`) — фронтенд и бэкенд
 * разные origin даже в dev, поэтому базовый URL нужен, а не относительный
 * путь (026: первый реальный сетевой вызов).
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
