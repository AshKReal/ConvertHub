import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FixedWindowRateLimiterService } from '../../common/rate-limit/fixed-window-rate-limiter.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * `exports: [TokenService]` — `conversion`/`files` нужен только он (проверка
 * access-токена на гостевых маршрутах), не весь модуль целиком
 * (`backend.md`: экспортировать то, что реально вызывает другой модуль).
 * `JwtModule.register({})` без секрета в конфиге: `TokenService` передаёт
 * `secret`/`expiresIn` на каждый вызов сам, модульный конфиг не нужен.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    FixedWindowRateLimiterService,
    JwtGuard,
  ],
  exports: [TokenService],
})
export class AuthModule {}
