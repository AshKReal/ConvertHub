import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

/** Экспортирован — `auth.controller.ts` ставит куку `oauth_state` с тем же `maxAge`, одно число, не два. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
  readonly codeVerifier: string;
  readonly createdAt: number;
}

export interface IssuedOauthState {
  readonly state: string;
  readonly codeChallenge: string;
}

/**
 * Спека 008. In-memory PKCE `code_verifier` + anti-CSRF `state` — тот же
 * временный приём, что `FixedWindowRateLimiterService` (007): не переживает
 * рестарт процесса и не работает при нескольких инстансах API,
 * задокументированная замена на Redis — спека 012, не эта.
 *
 * `state` защищает от login-CSRF (сверяется с `HttpOnly`-кукой, поставленной
 * на `/google/start`, в `auth.controller.ts`); `code_verifier` — от
 * authorization code injection (PKCE, `AUTH-RULES.md`). Обе проверки нужны:
 * кука доказывает, что запрос идёт от того же браузера, что начал поток,
 * `code_verifier` — что именно этот сервер выпустил этот `state`.
 */
@Injectable()
export class OauthStateService {
  private readonly pending = new Map<string, PendingState>();

  issue(): IssuedOauthState {
    this.purgeExpired();
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    this.pending.set(state, { codeVerifier, createdAt: Date.now() });
    return { state, codeChallenge };
  }

  /** Одноразово — запись удаляется сразу, даже если вызывающий дальше упадёт. `null` — не найден/просрочен. */
  consume(state: string): string | null {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (
      entry === undefined ||
      Date.now() - entry.createdAt > OAUTH_STATE_TTL_MS
    ) {
      return null;
    }
    return entry.codeVerifier;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [state, entry] of this.pending) {
      if (now - entry.createdAt > OAUTH_STATE_TTL_MS) {
        this.pending.delete(state);
      }
    }
  }
}
