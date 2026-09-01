import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FixedWindowRateLimiterService } from '../../common/rate-limit/fixed-window-rate-limiter.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOauthService } from './google-oauth.service';
import { OauthStateService } from './oauth-state.service';
import { TokenService } from './token.service';

/**
 * `exports: [TokenService, JwtGuard]` — `conversion`/`files` нужен только
 * `TokenService` (проверка access-токена на гостевых маршрутах), а с 010
 * `FilesController` ещё и `JwtGuard` (список файлов и тумблер `save` —
 * маршруты, требующие сессию жёстко, не гостевые) — оба экспортированы
 * ровно потому, что другой модуль их реально вызывает
 * (`backend.md`: экспортировать то, что реально вызывает другой модуль).
 * `JwtModule.register({})` без секрета в конфиге: `TokenService` передаёт
 * `secret`/`expiresIn` на каждый вызов сам, модульный конфиг не нужен.
 * `StorageModule`/`MailModule` — нужны `AccountService` (009): удаление
 * аккаунта чистит файлы в `Storage`, сброс/смена пароля шлют письма через
 * `MailService` — первый реальный потребитель `MailModule` с момента, когда
 * он появился в кодовой базе (мейл-инфраструктура, предыдущая сессия).
 * `GoogleOauthService`/`OauthStateService` (008) — только `AuthController`
 * этого же модуля их вызывает, `exports` не нужен (`backend.md`).
 */
@Module({
  imports: [JwtModule.register({}), StorageModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    TokenService,
    GoogleOauthService,
    OauthStateService,
    FixedWindowRateLimiterService,
    JwtGuard,
  ],
  exports: [TokenService, JwtGuard],
})
export class AuthModule {}
