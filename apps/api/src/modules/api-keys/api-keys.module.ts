import { Module } from '@nestjs/common';
import { RequestIdentityService } from '../../common/auth/request-identity.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyController } from './api-keys.controller';
import { ApiKeyService } from './api-keys.service';

/**
 * Спека 011/012. `imports: [AuthModule]` — `JwtGuard` (маршруты 011 требуют
 * сессию жёстко) и `TokenService` (нужен `RequestIdentityService`).
 * `RequestIdentityService` живёт здесь: он про «чей это запрос» — ключ ∨
 * сессия ∨ гость, — и его потребители (`conversion`, `files`, 012) и так
 * тянут этот модуль ради ключей.
 */
@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, RequestIdentityService],
  exports: [ApiKeyService, RequestIdentityService],
})
export class ApiKeyModule {}
