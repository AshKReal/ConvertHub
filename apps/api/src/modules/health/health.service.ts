import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { env, s3Config } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 1000;

export type CheckState = 'up' | 'down';
export interface Readiness {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly checks: {
    readonly db: CheckState;
    readonly redis: CheckState;
    /** Только при `STORAGE_DRIVER=s3` — `LocalDiskStorage` не сетевой (спека 014). */
    readonly storage?: CheckState;
  };
}

/**
 * Спека 014 (+ 016 — проверка объектного хранилища). `/ready` — база и
 * сетевые подсистемы. Недоступна база → `down` (`503`): без неё сервис
 * бесполезен. Недоступен Redis или (в режиме `s3`) объектное хранилище,
 * база жива → `degraded` (`200`): rate limit fail-open, `save` тихо не
 * работает, трафик обслуживается (`ARCHITECTURE.md` §9). Каждая проверка —
 * с таймаутом, чтобы медленная, но живая подсистема не роняла весь `/ready`.
 */
@Injectable()
export class HealthService {
  private readonly s3: S3Client | null =
    env.STORAGE_DRIVER === 's3' ? buildS3Client() : null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<Readiness> {
    const s3 = this.s3;
    const [db, redis, storage] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
      s3 === null
        ? Promise.resolve<boolean | null>(null)
        : probe(() =>
            s3.send(new HeadBucketCommand({ Bucket: s3Config().bucket })),
          ),
    ]);

    const status = !db
      ? 'down'
      : !redis || storage === false
        ? 'degraded'
        : 'ok';

    return {
      status,
      checks: {
        db: db ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
        ...(storage === null
          ? {}
          : { storage: storage ? ('up' as const) : ('down' as const) }),
      },
    };
  }
}

function buildS3Client(): S3Client {
  const cfg = s3Config();
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
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
