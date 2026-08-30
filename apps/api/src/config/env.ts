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
  /** Спека 003. Папка `LocalDiskStorage` — без дефолта, обязана лежать вне репозитория. */
  LOCAL_STORAGE_DIR: z.string().min(1),
  /** Спека 007. Подпись access-JWT (`TokenService`) — без дефолта, как остальные секреты. */
  JWT_SECRET: z.string().min(32),
  /** Спека 009. Локально — MailHog (`docker-compose.yml`), в проде — любой SMTP-провайдер, код `MailService` не меняется. */
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  /** MailHog принимает и без TLS; `true` понадобится реальному провайдеру на 465/587 — дефолт под локальную разработку, не под прод. */
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().email(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
