import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 1000;

export type CheckState = 'up' | 'down';
export interface Readiness {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly checks: { readonly db: CheckState; readonly redis: CheckState };
}

/**
 * Спека 014. `/ready` — база и хранилище счётчиков. Недоступна база →
 * `down` (`503`): без неё сервис бесполезен. Недоступен Redis, база жива →
 * `degraded` (`200`): rate limit fail-open, трафик обслуживается
 * (`ARCHITECTURE.md` §9). Каждая проверка — с таймаутом, чтобы медленная,
 * но живая подсистема не роняла весь `/ready`.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<Readiness> {
    const [db, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
    ]);

    const status = !db ? 'down' : !redis ? 'degraded' : 'ok';
    return {
      status,
      checks: { db: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
    };
  }
}

async function probe(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await Promise.race([fn(), rejectAfter(CHECK_TIMEOUT_MS)]);
    return true;
  } catch {
    return false;
  }
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    timer.unref();
  });
}
