import { Injectable, signal } from '@angular/core';

export interface MockUser {
  readonly email: string;
}

/**
 * Мок сессии для 019: переключается локальным состоянием, не настоящим
 * JWT/cookie — тот контракт (`AUTH-RULES.md` §2, `TECH-SPEC.md` §8.2) приходит
 * с бэкендом в 007. До этого момента `user` — источник правды для шапки `Layout`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<MockUser | null>(null);

  login(email: string): void {
    this.user.set({ email });
  }

  logout(): void {
    this.user.set(null);
  }
}
