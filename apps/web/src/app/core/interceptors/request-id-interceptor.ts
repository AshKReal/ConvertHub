import { type HttpInterceptorFn } from '@angular/common/http';

import { isApiUrl } from '../api-url';

/**
 * Спека 014. Сквозной идентификатор запроса начинается на клиенте
 * (`ARCHITECTURE.md` §8): каждый вызов к API несёт `X-Request-Id`, сервер
 * кладёт его в лог и возвращает заголовком/полем `request_id` ошибки.
 * Первым в цепочке (`app.config.ts`) — заголовок должен быть и на ретраях
 * после `401` (`auth-interceptor.ts` переотправляет уже помеченный запрос).
 */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { 'X-Request-Id': `req_${crypto.randomUUID()}` },
    }),
  );
};
