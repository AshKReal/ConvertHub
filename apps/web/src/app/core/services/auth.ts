import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@convert-hub/shared';
import { catchError, finalize, map, of, shareReplay, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type LoginProvider = 'password' | 'google' | 'telegram';

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly provider: LoginProvider;
}

const AUTH_BASE = `${environment.apiUrl}/v1/auth`;

/**
 * Сессия — сигнал здесь (`AUTH-RULES.md` §1). Access-токен — приватное поле
 * в памяти, не сигнал: шаблоны не должны иметь к нему доступ вообще
 * (`AUTH-RULES.md` §2), только `user` — публичный.
 *
 * HTTP-вызовы — прямо здесь, не через `features/auth/data/*.api.ts`:
 * `frontend.md` запрещает стрелку `core → features`, а сессии место
 * ровно в `core` — отдельный data-слой в фиче создал бы такую стрелку без
 * необходимости (в отличие от `dropzone.ts`, зовущего `injectConvertApi()`
 * напрямую — та фича не является частью `core`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<SessionUser | null>(null);

  private accessToken: string | null = null;
  private refreshInFlight$: Observable<string | null> | null = null;

  login(email: string, password: string): Observable<void> {
    const body: LoginRequest = { email, password };
    return this.http
      .post<AuthResponse>(`${AUTH_BASE}/login`, body, { withCredentials: true })
      .pipe(map((response) => this.applySession(response)));
  }

  register(email: string, password: string): Observable<void> {
    const body: RegisterRequest = { email, password };
    return this.http
      .post<AuthResponse>(`${AUTH_BASE}/register`, body, { withCredentials: true })
      .pipe(map((response) => this.applySession(response)));
  }

  /**
   * Кнопки Google/Telegram (019) остаются визуальной заглушкой до 008 —
   * настоящий OAuth-поток появится там, не в 007. Синтетический `id`:
   * реальной учётной записи за этим входом нет, на сервер он не уходит.
   */
  loginAsMockOAuth(email: string, provider: Exclude<LoginProvider, 'password'>): void {
    this.accessToken = null;
    this.user.set({ id: `mock-${provider}-${Date.now()}`, email, provider });
  }

  logout(): void {
    this.accessToken = null;
    this.user.set(null);
    // Локальное состояние уже сброшено — отзыв cookie на сервере best-effort,
    // ошибку (например, сеть недоступна) показывать нечем и незачем.
    this.http.post(`${AUTH_BASE}/logout`, {}, { withCredentials: true }).subscribe({
      error: () => undefined,
    });
  }

  /**
   * Один тихий `refresh` при старте приложения (`app.config.ts`,
   * `provideAppInitializer`) — восстанавливает сессию из cookie, если она
   * жива. Отсутствующая/просроченная cookie — гость, не ошибка: гасится
   * молча, тостом сюда лезть нечего.
   */
  restoreSession(): Observable<void> {
    return this.http.post<AuthResponse>(`${AUTH_BASE}/refresh`, {}, { withCredentials: true }).pipe(
      map((response) => this.applySession(response)),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Single-flight (`ARCHITECTURE.md` §7, чек-лист 007 «очередь на
   * параллельные 401») — вызывается только из `auth-interceptor.ts`.
   * Несколько запросов, поймавших `401` почти одновременно, делят один и
   * тот же вызов `/refresh`, а не плодят по одному на каждый. `null` —
   * refresh не удался (сессия истекла целиком), не ошибка потока.
   */
  ensureFreshToken(): Observable<string | null> {
    if (this.refreshInFlight$ === null) {
      this.refreshInFlight$ = this.http
        .post<AuthResponse>(`${AUTH_BASE}/refresh`, {}, { withCredentials: true })
        .pipe(
          map((response) => {
            this.applySession(response);
            return this.accessToken;
          }),
          catchError(() => {
            this.accessToken = null;
            this.user.set(null);
            return of(null);
          }),
          // `finalize` до `shareReplay`: сбрасывает кеш ровно когда
          // единственный реальный HTTP-вызов завершается, не когда
          // отписывается конкретный подписчик — иначе следующий 401 мог бы
          // получить уже протухший кешированный результат.
          finalize(() => {
            this.refreshInFlight$ = null;
          }),
          shareReplay(1),
        );
    }
    return this.refreshInFlight$;
  }

  currentAccessToken(): string | null {
    return this.accessToken;
  }

  private applySession(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.user.set({ ...response.user, provider: 'password' });
  }
}
