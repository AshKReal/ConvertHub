import { Injectable, signal } from '@angular/core';

export type LoginProvider = 'password' | 'google' | 'telegram';

export interface MockUser {
  readonly email: string;
  readonly provider: LoginProvider;
}

/**
 * Мок сессии для 019: переключается локальным состоянием, не настоящим
 * JWT/cookie — тот контракт (`AUTH-RULES.md` §2, `TECH-SPEC.md` §8.2) приходит
 * с бэкендом в 007. До этого момента `user` — источник правды для шапки `Layout`.
 *
 * `provider` — не настоящая связка аккаунтов (008/009), а способ, которым
 * прошёл текущий мок-вход; профиль (020) показывает его как «подключённый».
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<MockUser | null>(null);

  login(email: string, provider: LoginProvider = 'password'): void {
    this.user.set({ email, provider });
  }

  logout(): void {
    this.user.set(null);
  }
}
