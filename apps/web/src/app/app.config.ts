import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { authInterceptor } from './core/interceptors/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { AuthService } from './core/services/auth';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Первый реальный сетевой вызов во фронтенде — POST /v1/convert (026).
    // Порядок важен — см. докблок authInterceptor.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Тихий refresh из cookie до первой отрисовки (007) — без него
    // authGuard (/profile, /files, /api-keys) увидел бы user()===null и
    // перебросил на /login ещё залогиненного пользователя после обычного F5.
    provideAppInitializer(() => firstValueFrom(inject(AuthService).restoreSession())),
    // Спека 010 — подключается вместе с первым серверным списком
    // (ARCHITECTURE.md §6.2), не раньше: до этого серверных данных, которые
    // нужно кешировать/инвалидировать, в приложении не было.
    provideTanStackQuery(new QueryClient()),
  ],
};
