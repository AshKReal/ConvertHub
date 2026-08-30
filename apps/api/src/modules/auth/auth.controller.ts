import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  JWT_REFRESH_TTL_SECONDS,
  loginRequestSchema,
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
  registerRequestSchema,
} from '@convert-hub/shared';
import type { Request, Response } from 'express';
import { hashIp } from '../../common/util/hash-ip';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  FixedWindowRateLimiterService,
  type ConsumeOptions,
} from '../../common/rate-limit/fixed-window-rate-limiter.service';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, type IssuedSession } from './auth.service';

const REFRESH_COOKIE_NAME = 'refresh_token';
/** Кука нужна только эндпоинтам этого контроллера — не отправляется на остальной API (defence in depth). */
const REFRESH_COOKIE_PATH = '/v1/auth';
const AUTH_RATE_LIMIT: ConsumeOptions = {
  max: AUTH_RATE_LIMIT_MAX,
  windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
};

/**
 * Без логики и без Prisma напрямую, кроме `me` — там это простое чтение по
 * `id`, уже проверенному `JwtGuard`, не бизнес-правило (`ARCHITECTURE.md` §4.1).
 * Cookie выставляет контроллер, не `AuthService` — сервис ничего не знает
 * про `Request`/`Response`.
 */
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: FixedWindowRateLimiterService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @HttpCode(200)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    this.rateLimiter.consume(this.ipKey(req), AUTH_RATE_LIMIT);
    const session = await this.authService.register(body);
    return this.respond(res, session);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    // И по IP, и по аккаунту (AUTH-RULES.md §2) — только по IP обходится
    // ботнетом, только по аккаунту — перебором аккаунтов с разных адресов.
    this.rateLimiter.consume(this.ipKey(req), AUTH_RATE_LIMIT);
    this.rateLimiter.consume(
      `login:${body.email.trim().toLowerCase()}`,
      AUTH_RATE_LIMIT,
    );
    const session = await this.authService.login(body);
    return this.respond(res, session);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const rawToken = readRefreshCookie(req);
    if (rawToken === undefined) {
      throw new AppException('UNAUTHENTICATED');
    }
    const session = await this.authService.refresh(rawToken);
    return this.respond(res, session);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (rawToken !== undefined) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@CurrentUser() userId: string): Promise<AuthUser> {
    // `findUniqueOrThrow` — пользователь с валидным access-токеном не может
    // не существовать в течение жизни этого токена, кроме как после удаления
    // аккаунта (009, ещё не реализовано). Риск принят осознанно: если он
    // когда-нибудь случится раньше отзыва токенов, это всплывёт как
    // `INTERNAL_ERROR` (026), не тихо.
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });
  }

  private ipKey(req: Request): string {
    return hashIp(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  private respond(res: Response, session: IssuedSession): AuthResponse {
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken.raw, {
      httpOnly: true,
      // `Secure` только в production (docs/SECURITY.md) — на `http://localhost`
      // браузер такую куку не возвращает вообще, локальная разработка иначе
      // не работает.
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: JWT_REFRESH_TTL_SECONDS * 1000,
    });
    return { accessToken: session.accessToken, user: session.user };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
