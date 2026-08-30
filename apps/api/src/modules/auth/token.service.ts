import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_ACCESS_TTL_SECONDS } from '@convert-hub/shared';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  readonly userId: string;
  readonly email: string;
}

export interface GeneratedOpaqueToken {
  readonly raw: string;
  readonly hash: string;
}

interface AccessTokenClaims {
  readonly sub: string;
  readonly email: string;
}

/**
 * Чистый, без Prisma (`ARCHITECTURE.md` §4.1) — подпись/проверка access-JWT
 * и генерация опакового refresh-токена. `verifyAccessToken` никогда не
 * бросает — единая точка правды и для `JwtGuard` (бросает `UNAUTHENTICATED`
 * сам, снаружи), и для опционального пути в `conversion`/`files`
 * контроллерах (`null` → гость, ничего не блокируется).
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(payload: AccessTokenPayload): string {
    const claims: AccessTokenClaims = {
      sub: payload.userId,
      email: payload.email,
    };
    return this.jwt.sign(claims, {
      secret: env.JWT_SECRET,
      expiresIn: JWT_ACCESS_TTL_SECONDS,
    });
  }

  verifyAccessToken(token: string | undefined): AccessTokenPayload | null {
    if (token === undefined) {
      return null;
    }
    try {
      const claims = this.jwt.verify<AccessTokenClaims>(token, {
        secret: env.JWT_SECRET,
      });
      return { userId: claims.sub, email: claims.email };
    } catch {
      return null;
    }
  }

  /** Refresh-токен (007) — семантическая обёртка над общей генерацией ниже. */
  generateRefreshToken(): GeneratedOpaqueToken {
    return generateOpaqueToken();
  }
}

/**
 * Общая генерация опакового токена — refresh-токен (007) и токен сброса
 * пароля (009, `AccountService`) устроены одинаково: случайные байты +
 * SHA-256 хеш в БД. Свободная функция, не метод `TokenService`: обеим
 * сторонам (генерация здесь, поиск по хешу в `AuthService`/`AccountService`)
 * нужна одна и та же арифметика без разницы, кто её вызывает.
 */
export function generateOpaqueToken(): GeneratedOpaqueToken {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashOpaqueToken(raw) };
}

/**
 * SHA-256, не argon2 (`AUTH-RULES.md` §2) — токен генерируется системой,
 * 256 бит энтропии, не подбираемый секрет вроде пароля; тот же довод, что
 * для API-ключей и Telegram HMAC.
 */
export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
