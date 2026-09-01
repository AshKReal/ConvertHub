import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyController } from './api-keys.controller';
import { ApiKeyService } from './api-keys.service';

/**
 * Спека 011. `imports: [AuthModule]` — нужен только `JwtGuard` (маршруты
 * требуют сессию жёстко), `AuthModule` его экспортирует (`backend.md`:
 * импортируем модуль, не тянем файл guard'а напрямую). `exports` нет —
 * `ApiKeyService` пока никто извне не вызывает; 012 (проверка ключа в
 * запросах) добавит потребителя и `export` вместе с собой.
 */
@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
