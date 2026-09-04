import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `config/env.ts` парсит `process.env` на импорте модуля (приложение падает на
 * старте, а не на первом запросе) — поэтому каждый кейс это `vi.resetModules()`
 * + свежий динамический импорт, а не вызов функции.
 *
 * Проверяются два гарда. INFRA-01: в `production` секрет с маркером
 * плейсхолдера роняет старт. INFRA-12: там же обязательна пара
 * `SMTP_USER`/`SMTP_PASSWORD`, а половина пары — ошибка в любом окружении.
 * Остальные переменные берутся из `apps/api/.env`, который `vitest.config.ts`
 * грузит до всего остального.
 */
// `./env.js`, не `./env` — `moduleResolution: nodenext` требует расширение у
// динамического импорта; сборщик отображает его на `env.ts`.
const loadEnv = () => import('./env.js');

/** Секреты, которые проходят гард INFRA-01, и пара SMTP, которую требует INFRA-12. */
const VALID_PRODUCTION = {
  JWT_SECRET: 'S0m3R34lly+RandomLookingSecretValue/32chars==',
  SIGNED_URL_SECRET: 'An0ther+RandomLookingSecretValue/32chars==',
  METRICS_TOKEN: 'aG9uZXN0LW1ldHJpY3MtdG9rZW4=',
  SMTP_USER: 'resend',
  SMTP_PASSWORD: 're_test_key_not_a_real_one',
} as const;

describe('config/env — запрет плейсхолдеров в production', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const inProduction = (overrides: Record<string, string>): void => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    // `dotenv` не перезаписывает уже заданные переменные, поэтому stub
    // побеждает значение из `.env`.
    for (const [key, value] of Object.entries(overrides)) {
      vi.stubEnv(key, value);
    }
  };

  it('роняет старт, если JWT_SECRET — плейсхолдер', async () => {
    inProduction({
      JWT_SECRET: 'change-me-to-32-plus-random-characters-in-prod',
    });
    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET/);
  });

  it('роняет старт, если METRICS_TOKEN — плейсхолдер', async () => {
    inProduction({ METRICS_TOKEN: 'change-me-16-plus-token' });
    await expect(loadEnv()).rejects.toThrow(/METRICS_TOKEN/);
  });

  it('ловит заглушку `unused-in-s3` в SIGNED_URL_SECRET', async () => {
    inProduction({
      SIGNED_URL_SECRET: 'unused-in-s3-mode-but-schema-requires-32-plus-chars',
    });
    await expect(loadEnv()).rejects.toThrow(/SIGNED_URL_SECRET/);
  });

  it('перечисляет все плохие секреты разом, а не только первый', async () => {
    inProduction({
      JWT_SECRET: 'change-me-to-32-plus-random-characters-in-prod',
      METRICS_TOKEN: 'change-me-16-plus-token',
    });
    const error: unknown = await loadEnv().catch((e: unknown) => e);
    expect(String(error)).toMatch(/JWT_SECRET/);
    expect(String(error)).toMatch(/METRICS_TOKEN/);
  });

  it('пропускает настоящие случайные секреты', async () => {
    inProduction({ ...VALID_PRODUCTION });
    await expect(loadEnv()).resolves.toBeDefined();
  });

  it('не мешает плейсхолдерам вне production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', 'change-me-to-32-plus-random-characters-in-dev');
    await expect(loadEnv()).resolves.toBeDefined();
  });
});

/**
 * INFRA-12. Без AUTH письмо не уходит ни к одному провайдеру, поэтому отказ
 * поднят со `sendMail` (форма «забыли пароль») на старт процесса.
 */
describe('config/env — SMTP-аутентификация', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('роняет production без пары SMTP_USER/SMTP_PASSWORD', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', VALID_PRODUCTION.JWT_SECRET);
    vi.stubEnv('SIGNED_URL_SECRET', VALID_PRODUCTION.SIGNED_URL_SECRET);
    vi.stubEnv('METRICS_TOKEN', VALID_PRODUCTION.METRICS_TOKEN);
    await expect(loadEnv()).rejects.toThrow(/SMTP_USER\/SMTP_PASSWORD/);
  });

  it('роняет старт на половине пары даже вне production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SMTP_USER', 'resend');
    await expect(loadEnv()).rejects.toThrow(/только парой/);
  });

  it('роняет старт, если задан один SMTP_PASSWORD', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SMTP_PASSWORD', 're_test_key_not_a_real_one');
    await expect(loadEnv()).rejects.toThrow(/только парой/);
  });

  it('пропускает отсутствие пары вне production — это MailHog', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    await expect(loadEnv()).resolves.toBeDefined();
  });
});
