import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth';

const AUTH_PREFIX = `${environment.apiUrl}/v1/auth/`;

/**
 * `register`/`login`/`refresh`/`logout` never carry a Bearer token and must
 * never trigger the refresh-and-retry path below — `refresh` itself can 401
 * (no/expired cookie), and retrying THAT via another refresh call would be
 * either pointless or (worse) a second concurrent /refresh outside the
 * single-flight in `AuthService.ensureFreshToken()`.
 */
function isProtectedApiRequest(url: string): boolean {
  return url.startsWith(environment.apiUrl) && !url.startsWith(AUTH_PREFIX);
}

/**
 * Подключён в `app.config.ts` ПОСЛЕ `errorInterceptor` в массиве
 * `withInterceptors` — Angular прогоняет ответ (и ошибку) в порядке,
 * обратном списку, так что этот интерцептор должен идти последним, чтобы
 * увидеть сырой `401` раньше, чем `errorInterceptor` перепишет его в
 * переведённый `AppError` (комментарий там же).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (!isProtectedApiRequest(req.url)) {
    return next(req);
  }

  const token = auth.currentAccessToken();
  const authedReq =
    token !== null ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return auth.ensureFreshToken().pipe(
        switchMap((newToken) => {
          if (newToken === null) {
            // Refresh тоже не удался — сессия истекла целиком, наружу летит
            // исходная ошибка (её отрисует errorInterceptor).
            return throwError(() => error);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
        }),
      );
    }),
  );
};
