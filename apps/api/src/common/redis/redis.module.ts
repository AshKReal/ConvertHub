import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../../config/env';

/** Токен провайдера единственного клиента Redis. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Спека 012. Единственный клиент Redis в приложении (`@Global()`, как
 * `PrismaModule`) — первый реальный потребитель Redis в проекте.
 *
 * `enableOfflineQueue: false` + `maxRetriesPerRequest: 1` — когда Redis лёг,
 * команды падают сразу, а не копятся в очереди: fail-open ограничителя
 * частоты и идемпотентности (`ARCHITECTURE.md` §9) обязан быть быстрым, а не
 * ждать таймаут на каждый запрос. Обработчик `error` обязателен: непойманное
 * событие `error` на клиенте роняет процесс, а Redis здесь необязателен.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const logger = new Logger('Redis');
        const client = new Redis(env.REDIS_URL, {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        client.on('error', (error: Error) => {
          logger.warn(`Redis недоступен: ${error.message}`);
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
