import { type HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/**
 * Спека 014. Сквозной идентификатор запроса начинается на клиенте
 * (`ARCHITECTURE.md` §8): каждый вызов к API несёт `X-Request-Id`, сервер
 * кладёт его в лог и возвращает заголовком/полем `request_id` ошибки.
 * Первым в цепочке (`app.config.ts`) — заголовок должен быть и на ретраях
 * после `401` (`auth-interceptor.ts` переотправляет уже помеченный запрос).
 */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { 'X-Request-Id': `req_${crypto.randomUUID()}` },
    }),
  );
};
