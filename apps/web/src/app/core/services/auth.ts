import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  OauthProvider,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
} from '@convert-hub/shared';
import { catchError, finalize, map, of, shareReplay, tap, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Спека 008. `password` — не элемент `OauthProvider` (`packages/shared`,
 * пока только `google`) — общий вид строки в профиле (`LOGIN_PROVIDER_LABEL_KEYS`,
 * `core/i18n/messages.ts`) для label'а, не для `AuthUser.providers`.
 *
 * Telegram убран: кнопка была визуальной заглушкой и ставила сессию без
 * токена прямо в сигнал, минуя сервер. `authGuard` такую сессию пропускал,
 * дальше каждый защищённый запрос ловил 401 — на живом деплое это выглядело
 * как бесконечно мигающий список файлов. Вернётся вместе с настоящим
 * потоком, если он получит свой номер спеки (`AUTH-RULES.md` §5).
 */
export type LoginProvider = 'password' | 'google';

/**
 * Форма пользователя сессии — ровно `AuthUser` (`packages/shared`): реальный
 * список привязанных способов входа (`providers`), не единственный метод
 * ТЕКУЩЕЙ сессии — до 008 сессия могла быть только паролем, разницы не было
 * видно, теперь аккаунт может быть привязан к паролю и Google одновременно.
 */
export type SessionUser = AuthUser;

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

  register(input: RegisterRequest): Observable<void> {
    return this.http
      .post<AuthResponse>(`${AUTH_BASE}/register`, input, { withCredentials: true })
      .pipe(map((response) => this.applySession(response)));
  }

  /**
   * Спека 029. Ответ — обновлённый `AuthUser`, поэтому сигнал сессии
   * обновляется прямо здесь: имя видно в шапке сразу, без отдельного
   * `GET /me` ради двух полей, которые только что записали.
   */
  updateProfile(input: UpdateProfileRequest): Observable<void> {
    return this.http
      .patch<AuthUser>(`${AUTH_BASE}/profile`, input, { withCredentials: true })
      .pipe(map((user) => this.user.set(user)));
  }

  /**
   * Спека 029. `FormData`, поле `avatar` — то же имя, что ждёт
   * `createAvatarFileInterceptor` на сервере. `Content-Type` не выставляем
   * руками: браузер сам добавит `multipart/form-data` с `boundary`, а
   * заданный вручную заголовок этот boundary затрёт и тело станет неразбираемым.
   */
  uploadAvatar(file: File): Observable<void> {
    const form = new FormData();
    form.append('avatar', file);
    return this.http
      .post<AuthUser>(`${AUTH_BASE}/avatar`, form, { withCredentials: true })
      .pipe(map((user) => this.user.set(user)));
  }

  removeAvatar(): Observable<void> {
    return this.http
      .delete<AuthUser>(`${AUTH_BASE}/avatar`, { withCredentials: true })
      .pipe(map((user) => this.user.set(user)));
  }

  /** Спека 008. Полная навигация браузера — `href` кнопки Google, не `HttpClient`: колбэк отвечает редиректом, не JSON. */
  googleStartUrl(): string {
    return `${AUTH_BASE}/google/start`;
  }

  /**
   * Спека 008. Сервер идемпотентен (уже не привязан — тоже `204`) — здесь
   * только сам запрос и локальное обновление `user()`, чтобы профиль не
   * ждал отдельного `GET /me` ради одной строки списка.
   */
  unlinkIdentity(provider: OauthProvider): Observable<void> {
    return this.http
      .delete<void>(`${AUTH_BASE}/identities/${provider}`, { withCredentials: true })
      .pipe(
        tap(() => {
          const current = this.user();
          if (current !== null) {
            this.user.set({
              ...current,
              providers: current.providers.filter((linked) => linked !== provider),
            });
          }
        }),
      );
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

  /** Ответ у сервера один и тот же независимо от результата (`TECH-SPEC.md` §8.5) — здесь просто нечего разбирать. */
  requestPasswordReset(email: string): Observable<void> {
    const body: ForgotPasswordRequest = { email };
    return this.http.post<void>(`${AUTH_BASE}/forgot-password`, body, { withCredentials: true });
  }

  /** Не логинит автоматически — 020 уже показывает экран успеха со ссылкой на `/login`. */
  resetPassword(token: string, password: string): Observable<void> {
    const body: ResetPasswordRequest = { token, password };
    return this.http.post<void>(`${AUTH_BASE}/reset-password`, body, { withCredentials: true });
  }

  /**
   * Сервер уже отзывает все сессии на успехе — здесь только сам запрос;
   * локальный сброс сигналов делает вызывающий (`profile-page.ts`) через
   * уже существующий `logout()`, как в моке 020.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    const body: ChangePasswordRequest = { currentPassword, newPassword };
    return this.http.patch<void>(`${AUTH_BASE}/password`, body, { withCredentials: true });
  }

  /**
   * В отличие от `logout()` — без отдельного вызова `/logout`: сервер уже
   * чистит cookie в ответе на `DELETE`, аккаунта для второго запроса просто
   * не существует.
   */
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${AUTH_BASE}/account`, { withCredentials: true }).pipe(
      tap(() => {
        this.accessToken = null;
        this.user.set(null);
      }),
    );
  }

  currentAccessToken(): string | null {
    return this.accessToken;
  }

  private applySession(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.user.set(response.user);
  }
}
