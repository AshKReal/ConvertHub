import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  /** Спека 003. Секрет HMAC-подписи ссылок на скачивание — без дефолта, как остальные секреты. */
  SIGNED_URL_SECRET: z.string().min(32),
  /** Спека 012. Rate limit (token bucket) и идемпотентность. Redis необязателен на пути ключа/сессии — при недоступности обе подсистемы fail-open (`ARCHITECTURE.md` §9). */
  REDIS_URL: z.string().url(),
  /** Спека 003. Папка `LocalDiskStorage` — без дефолта, обязана лежать вне репозитория. */
  LOCAL_STORAGE_DIR: z.string().min(1),
  /** Спека 007. Подпись access-JWT (`TokenService`) — без дефолта, как остальные секреты. */
  JWT_SECRET: z.string().min(32),
  /** Спека 009. Локально — MailHog (`docker-compose.yml`), в проде — любой SMTP-провайдер, код `MailService` не меняется. */
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  /**
   * MailHog принимает и без TLS; `true` понадобится реальному провайдеру на
   * 465/587 — дефолт под локальную разработку, не под прод.
   *
   * НЕ `z.coerce.boolean()` — тот коэрсит через `Boolean(value)`, а
   * `Boolean('false') === true` (непустая строка): `SMTP_SECURE=false` в
   * `.env` включил бы TLS, а не выключил. Найдено реальным вызовом
   * `MailService` (SSL-ошибка от MailHog, который TLS не поддерживает
   * вообще), не тайпчеком — `z.coerce.boolean()` типизируется как `boolean`
   * правильно, ошибка чисто в рантайм-семантике.
   */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_FROM: z.string().email(),
  /** Спека 008. Google Cloud Console → OAuth 2.0 Client ID (Web application). Без дефолта, как остальные секреты. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /** Полный абсолютный URL callback-маршрута (`/v1/auth/google/callback`) — должен совпадать с authorized redirect URI в Google Cloud Console. */
  GOOGLE_REDIRECT_URI: z.string().url(),
  /** Спека 014. Уровень структурных логов (`pino`). Дефолт `info`. */
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  /** Спека 014. `Authorization: Bearer <токен>` на `GET /metrics` — иначе `401`. Без дефолта, как секрет. */
  METRICS_TOKEN: z.string().min(16),
  /**
   * Спека 016. Драйвер объектного хранилища. `local` (умолчание) —
   * `LocalDiskStorage` + `GET /v1/storage/local/raw`, как со спеки 003:
   * локальная разработка и весь тестовый стек (`test:e2e`, Playwright, CI job
   * `e2e`) не начинают требовать поднятый MinIO. `s3` — `S3Storage`, MinIO
   * локально / Cloudflare R2 в проде (TECH-SPEC.md §3.1).
   */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /**
   * Спека 016. Обязательны при `STORAGE_DRIVER=s3` (проверка после `parse`
   * ниже). `LOCAL_STORAGE_DIR`/`SIGNED_URL_SECRET` при этом остаются
   * обязательными безусловно — сознательный компромисс: делать их условными
   * значит протащить `string | undefined` в `signed-url.util.ts` и
   * `local-disk-raw.controller.ts` (зона `critical-zones.md`), цена не стоит
   * того. В `s3`-режиме держите их заглушками (`docs/SETUP.md`).
   */
  S3_ENDPOINT: z.string().url().optional(),
  /** Публичный хост хранилища для presigned URL — из compose приложение видит MinIO как `http://minio:9000`, а браузер клиента как `http://localhost:9000`. Не задан → `S3_ENDPOINT`. */
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** MinIO требует path-style (`http://host/bucket/key`), не virtual-hosted; R2 поддерживает оба. Дефолт `true` безопаснее. `z.enum` + transform по тем же граблям, что `SMTP_SECURE`. */
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /**
   * Спека 018. HTTP-адрес Gotenberg (конвертер DOCX→PDF). В `--profile full`
   * — `http://gotenberg:3000` (внутренняя сеть compose). Недостижим →
   * `docx-to-pdf` даёт `CONVERSION_FAILED`, остальные направления работают
   * (`ARCHITECTURE.md` §9). Дефолт — под docker-compose.override.yml с
   * опубликованным портом (docs/SETUP.md).
   */
  GOTENBERG_URL: z.string().url().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

// Условная обязательность S3-переменных — падаем на старте, а не на первом
// запросе (`ARCHITECTURE.md` §4.3). `superRefine` внутри схемы дал бы
// `S3_* : string | undefined` в типе и там, где `s3Config()` их гарантирует
// — отдельная явная проверка чище.
if (env.STORAGE_DRIVER === 's3') {
  const missing = (
    [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ] as const
  ).filter((key) => env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 требует ${missing.join(', ')} (docs/SETUP.md, раздел про хранилище).`,
    );
  }
}

/**
 * Плейсхолдеры из `.env.example` и `docker-compose.yml` проходят проверку
 * длины (`.min(32)`/`.min(16)`) — без этой проверки прод поднялся бы с ключом
 * подписи JWT, лежащим в публичном репозитории: кто угодно подписал бы токен
 * на любой `sub`, `/metrics` был бы открыт (`REVIEW-FINDINGS.md`, INFRA-01).
 * Ловим по маркеру, а не по точному совпадению: плейсхолдеры в репозитории
 * меняются, «change-me» в секрете — всегда ошибка конфигурации.
 *
 * Только в `production`: в dev и test заглушки — норма и цена бдительности
 * нулевой пользы.
 */
const PLACEHOLDER_MARKERS = [
  'change-me',
  'changeme',
  'unused-in-s3',
  'example',
];

if (env.NODE_ENV === 'production') {
  const weak = (
    [
      ['JWT_SECRET', env.JWT_SECRET],
      ['SIGNED_URL_SECRET', env.SIGNED_URL_SECRET],
      ['METRICS_TOKEN', env.METRICS_TOKEN],
    ] as const
  )
    .filter(([, value]) =>
      PLACEHOLDER_MARKERS.some((marker) =>
        value.toLowerCase().includes(marker),
      ),
    )
    .map(([name]) => name);

  if (weak.length > 0) {
    throw new Error(
      `NODE_ENV=production, но ${weak.join(', ')} содержит плейсхолдер. ` +
        'Сгенерируйте реальные значения: openssl rand -base64 32 ' +
        '(docs/DEPLOYMENT.md §5).',
    );
  }
}

/** Полностью типизированная конфигурация S3 — вызывать только когда `env.STORAGE_DRIVER === 's3'` (иначе бросит). */
export interface S3Config {
  readonly endpoint: string;
  readonly publicEndpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

export function s3Config(): S3Config {
  if (
    env.S3_ENDPOINT === undefined ||
    env.S3_BUCKET === undefined ||
    env.S3_ACCESS_KEY_ID === undefined ||
    env.S3_SECRET_ACCESS_KEY === undefined
  ) {
    throw new Error(
      's3Config() вызван без полной конфигурации S3 — STORAGE_DRIVER != s3?',
    );
  }
  return {
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  };
}
