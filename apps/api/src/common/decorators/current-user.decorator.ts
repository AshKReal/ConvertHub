import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/authenticated-request';

/**
 * Читает `request.userId`, записанный `JwtGuard` — имеет смысл только на
 * маршруте, уже защищённом им (`@UseGuards(JwtGuard)`); без guard'а поле
 * не существует.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().userId;
  },
);
