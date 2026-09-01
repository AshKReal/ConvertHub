import { Injectable } from '@nestjs/common';
import { ApiKeyService } from '../../modules/api-keys/api-keys.service';
import { TokenService } from '../../modules/auth/token.service';
import { extractBearerToken } from '../guards/extract-bearer-token';

export type RequestIdentity =
  | { readonly kind: 'guest' }
  | { readonly kind: 'session'; readonly userId: string }
  | {
      readonly kind: 'api-key';
      readonly userId: string;
      readonly apiKeyId: string;
    };

/**
 * Спека 012. Единая точка разбора `Authorization` для публичных маршрутов
 * (`/v1/convert`, `/v1/files`, download): API-ключ `ch_live_…` ∨ JWT сессии
 * ∨ гость. `common/`, а не модуль — та же роль, что у `JwtGuard` (он тоже
 * `common/` и зовёт `TokenService` из модуля).
 *
 * Плохой/отозванный ключ → `INVALID_API_KEY` (кидает `ApiKeyService.resolveKey`) —
 * явный отказ, не тихий гость. Плохой/отсутствующий JWT → гость (без
 * изменений, 007). `lastUsedAt` ключа отмечается здесь, fire-and-forget.
 */
@Injectable()
export class RequestIdentityService {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly tokens: TokenService,
  ) {}

  async resolve(
    authorizationHeader: string | undefined,
  ): Promise<RequestIdentity> {
    const bearer = extractBearerToken(authorizationHeader);
    if (bearer === undefined) {
      return { kind: 'guest' };
    }

    const key = await this.apiKeys.resolveKey(bearer);
    if (key !== null) {
      this.apiKeys.markUsed(key.apiKeyId);
      return { kind: 'api-key', userId: key.userId, apiKeyId: key.apiKeyId };
    }

    const payload = this.tokens.verifyAccessToken(bearer);
    return payload === null
      ? { kind: 'guest' }
      : { kind: 'session', userId: payload.userId };
  }
}
