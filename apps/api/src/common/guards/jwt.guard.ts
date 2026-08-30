import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { TokenService } from '../../modules/auth/token.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { extractBearerToken } from './extract-bearer-token';

/**
 * Маршрут обязан быть авторизован — в отличие от опционального пути в
 * `conversion`/`files` (те зовут `TokenService` напрямую и падают в гостя
 * на любой проблеме с токеном), здесь любая проблема — `401 UNAUTHENTICATED`.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = this.tokenService.verifyAccessToken(
      extractBearerToken(request.headers.authorization),
    );

    if (payload === null) {
      throw new AppException('UNAUTHENTICATED');
    }

    request.userId = payload.userId;
    return true;
  }
}
