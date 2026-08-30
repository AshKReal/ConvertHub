import type { Request } from 'express';

/**
 * `request.userId` — записывается `JwtGuard` после успешной проверки
 * access-токена. Отдельный тип вместо расширения глобального `Express.Request`
 * декларацией модуля: маршруты без `JwtGuard` не должны видеть это поле как
 * существующее (там его в рантайме и нет).
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
}
