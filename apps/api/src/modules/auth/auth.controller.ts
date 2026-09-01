import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IdentityProvider } from '@prisma/client';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  JWT_REFRESH_TTL_SECONDS,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  oauthProviderSchema,
  resetPasswordRequestSchema,
  type AuthResponse,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type MeResponse,
  type OauthProvider,
  type RegisterRequest,
  type ResetPasswordRequest,
  registerRequestSchema,
} from '@convert-hub/shared';
import type { Request, Response } from 'express';
import { hashIp } from '../../common/util/hash-ip';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AppException,
  type AppExceptionBody,
} from '../../common/exceptions/app.exception';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  FixedWindowRateLimiterService,
  type ConsumeOptions,
} from '../../common/rate-limit/fixed-window-rate-limiter.service';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountService } from './account.service';
import {
  AuthService,
  PROVIDER_FROM_PUBLIC,
  PROVIDER_LABELS,
  type IssuedSession,
} from './auth.service';
import { GoogleOauthService } from './google-oauth.service';
import { OAUTH_STATE_TTL_MS, OauthStateService } from './oauth-state.service';

const REFRESH_COOKIE_NAME = 'refresh_token';
/** Кука нужна только эндпоинтам этого контроллера — не отправляется на остальной API (defence in depth). */
const REFRESH_COOKIE_PATH = '/v1/auth';
/** Спека 008. Уже своим `Path` — не отправляется даже на остальные `/v1/auth/*`, только на сам OAuth-поток. */
const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
const OAUTH_STATE_COOKIE_PATH = '/v1/auth/google';
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
    private readonly accountService: AccountService,
    private readonly rateLimiter: FixedWindowRateLimiterService,
    private readonly prisma: PrismaService,
    private readonly google: GoogleOauthService,
    private readonly oauthState: OauthStateService,
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

  /**
   * Полная навигация браузера, не XHR — `oauth-buttons.html` (008) ссылка
   * `<a href>`, не `HttpClient`. `@Res()` без `passthrough` (как `files.controller.ts#download`,
   * спека 003) — ответ здесь редирект, не JSON-тело.
   */
  @Get('google/start')
  googleStart(@Res() res: Response): void {
    const { state, codeChallenge } = this.oauthState.issue();
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: OAUTH_STATE_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    res.redirect(302, this.google.buildAuthorizeUrl(state, codeChallenge));
  }

  /**
   * Google приводит сюда браузер сам — маршрут не JSON API, отдать
   * `application/problem+json` через полную навигацию нечем. Поэтому,
   * в отличие от всех остальных маршрутов, все исключения ловятся здесь
   * же и превращаются в редирект с `?oauthError=...`, не летят в
   * `AllExceptionsFilter` (`docs/SECURITY.md`, единственное оправданное
   * отступление от «не ловить, если нечего делать», `backend.md`).
   */
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: OAUTH_STATE_COOKIE_PATH });
    try {
      const session = await this.resolveGoogleCallback(req);
      this.setRefreshCookie(res, session);
      res.redirect(302, env.CORS_ORIGIN);
    } catch (error) {
      const isConflict =
        error instanceof AppException &&
        (error.getResponse() as AppExceptionBody).code ===
          'OAUTH_ACCOUNT_CONFLICT';
      res.redirect(
        302,
        `${env.CORS_ORIGIN}/login?oauthError=${isConflict ? 'conflict' : 'failed'}`,
      );
    }
  }

  @Delete('identities/:provider')
  @UseGuards(JwtGuard)
  @HttpCode(204)
  async unlinkIdentity(
    @CurrentUser() userId: string,
    @Param('provider', new ZodValidationPipe(oauthProviderSchema))
    provider: OauthProvider,
  ): Promise<void> {
    await this.authService.unlinkIdentity(
      userId,
      PROVIDER_FROM_PUBLIC[provider],
    );
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema))
    body: ForgotPasswordRequest,
    @Req() req: Request,
  ): Promise<void> {
    this.rateLimiter.consume(this.ipKey(req), AUTH_RATE_LIMIT);
    this.rateLimiter.consume(
      `forgot-password:${body.email.trim().toLowerCase()}`,
      AUTH_RATE_LIMIT,
    );
    // Ответ один и тот же независимо от результата (TECH-SPEC.md §8.5) —
    // `requestPasswordReset` никогда не бросает из-за "email не найден",
    // здесь просто нечего условно ветвить.
    await this.accountService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: ResetPasswordRequest,
    @Req() req: Request,
  ): Promise<void> {
    this.rateLimiter.consume(this.ipKey(req), AUTH_RATE_LIMIT);
    // Не логинит автоматически — 020 уже показывает экран успеха со ссылкой
    // на `/login`, менять готовый UX незачем; сама `resetPassword` уже
    // отозвала все сессии пользователя (включая гипотетическую текущую).
    await this.accountService.resetPassword(body.token, body.password);
  }

  @Patch('password')
  @UseGuards(JwtGuard)
  @HttpCode(204)
  async changePassword(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(changePasswordRequestSchema))
    body: ChangePasswordRequest,
  ): Promise<void> {
    await this.accountService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Delete('account')
  @UseGuards(JwtGuard)
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.accountService.deleteAccount(userId);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@CurrentUser() userId: string): Promise<MeResponse> {
    // `findUniqueOrThrow` — пользователь с валидным access-токеном не может
    // не существовать в течение жизни этого токена: удаление аккаунта (009)
    // не отзывает уже выданные access-токены (они самодостаточный JWT, TTL 15 мин —
    // тот же принятый компромисс, что для logout, docs/SECURITY.md), так что
    // окно между `deleteAccount` и естественным истечением токена реально.
    // Риск принят осознанно: если он случится, это всплывёт как
    // `INTERNAL_ERROR` (026), не тихо.
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        storageUsedBytes: true,
        identities: { select: { provider: true } },
      },
    });
    return {
      id: user.id,
      email: user.email,
      hasPassword: user.passwordHash !== null,
      providers: user.identities.map(
        (identity) => PROVIDER_LABELS[identity.provider],
      ),
      // Спека 010. Живой запрос за квотой (TanStack Query `['me']`,
      // apps/web/core/services/me.ts) — единственная причина, по которой
      // `GET /me` вообще остался отдельным маршрутом, не просто полем
      // ответа `login`/`register`/`refresh` (снэпшот сессии, не то же самое).
      storageUsedBytes: user.storageUsedBytes,
    };
  }

  private ipKey(req: Request): string {
    return hashIp(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  private respond(res: Response, session: IssuedSession): AuthResponse {
    this.setRefreshCookie(res, session);
    return { accessToken: session.accessToken, user: session.user };
  }

  /** Вынесено из `respond()` — `google/callback` тоже ставит эту куку, но отвечает редиректом, не JSON-телом. */
  private setRefreshCookie(res: Response, session: IssuedSession): void {
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
  }

  /**
   * `state` сверяется прямым `===`, не `timingSafeEqual` — это anti-CSRF
   * nonce, эхом возвращённый самим Google открытым текстом в query, не
   * секрет, сверяемый с секретом атакующего (`docs/SECURITY.md`).
   */
  private async resolveGoogleCallback(req: Request): Promise<IssuedSession> {
    const query = req.query as Record<string, string | undefined>;
    if (query['error'] !== undefined) {
      // Пользователь отменил на экране согласия Google, либо иной отказ провайдера.
      throw new Error(`Google returned an error: ${query['error']}`);
    }

    const code = query['code'];
    const state = query['state'];
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const cookieState = cookies?.[OAUTH_STATE_COOKIE_NAME];
    if (
      code === undefined ||
      state === undefined ||
      cookieState === undefined ||
      state !== cookieState
    ) {
      throw new Error('OAuth state missing or mismatched');
    }

    const codeVerifier = this.oauthState.consume(state);
    if (codeVerifier === null) {
      throw new Error('OAuth state not found or expired');
    }

    const accessToken = await this.google.exchangeCode(code, codeVerifier);
    const profile = await this.google.fetchProfile(accessToken);
    return this.authService.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      profile.sub,
      profile.email,
      profile.emailVerified,
    );
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
