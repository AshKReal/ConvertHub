import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_ACCESS_TTL_SECONDS } from '@convert-hub/shared';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  readonly userId: string;
  readonly email: string;
}

export interface GeneratedRefreshToken {
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

  generateRefreshToken(): GeneratedRefreshToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: hashRefreshToken(raw) };
  }
}

/**
 * SHA-256, не argon2 (`AUTH-RULES.md` §2) — токен генерируется системой,
 * 256 бит энтропии, не подбираемый секрет вроде пароля; тот же довод, что
 * для API-ключей и Telegram HMAC. Отдельная функция, не метод: и
 * `TokenService.generateRefreshToken`, и `AuthService` (при поиске
 * предъявленного токена по хешу) считают его одинаково.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
