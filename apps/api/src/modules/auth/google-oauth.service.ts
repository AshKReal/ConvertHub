import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { env } from '../../config/env';

export interface GoogleProfile {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// `fetch(...).json()` типизирован как `any` в lib.dom — узить явной Zod-схемой,
// не кастом (`any` запрещён, `AGENTS.md`). Не общий контракт фронт/бэк
// (не в `packages/shared`) — это форма чужого, не нашего, API.
const tokenResponseSchema = z.object({
  access_token: z.string(),
});

const userinfoResponseSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
});

/**
 * Чистый, без Prisma (`ARCHITECTURE.md` §4.1) — тот же приём, что
 * `token.service.ts`: вся коммуникация с Google, ничего не знает про
 * пользователей/сессии. Не декодирует `id_token` — `fetchProfile` получает
 * профиль с тем же уровнем доверия, что подписанный JWT (HTTPS-запрос с
 * нашим `client_secret` напрямую к Google), без отдельной JWKS-верификации,
 * которую пришлось бы городить самим.
 */
@Injectable()
export class GoogleOauthService {
  buildAuthorizeUrl(state: string, codeChallenge: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /** Бросает на любой сбой (сеть, отказ Google, просроченный/использованный `code`) — вызывающий (`auth.controller.ts`) ловит сам. */
  async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: env.GOOGLE_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Google token exchange failed: HTTP ${response.status}`);
    }
    return tokenResponseSchema.parse(await response.json()).access_token;
  }

  async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Google userinfo failed: HTTP ${response.status}`);
    }
    const body = userinfoResponseSchema.parse(await response.json());
    return {
      sub: body.sub,
      email: body.email,
      emailVerified: body.email_verified,
    };
  }
}
