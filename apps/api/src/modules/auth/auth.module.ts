import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FixedWindowRateLimiterService } from '../../common/rate-limit/fixed-window-rate-limiter.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * `exports: [TokenService]` — `conversion`/`files` нужен только он (проверка
 * access-токена на гостевых маршрутах), не весь модуль целиком
 * (`backend.md`: экспортировать то, что реально вызывает другой модуль).
 * `JwtModule.register({})` без секрета в конфиге: `TokenService` передаёт
 * `secret`/`expiresIn` на каждый вызов сам, модульный конфиг не нужен.
 * `StorageModule`/`MailModule` — нужны `AccountService` (009): удаление
 * аккаунта чистит файлы в `Storage`, сброс/смена пароля шлют письма через
 * `MailService` — первый реальный потребитель `MailModule` с момента, когда
 * он появился в кодовой базе (мейл-инфраструктура, предыдущая сессия).
 */
@Module({
  imports: [JwtModule.register({}), StorageModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    TokenService,
    FixedWindowRateLimiterService,
    JwtGuard,
  ],
  exports: [TokenService],
})
export class AuthModule {}
