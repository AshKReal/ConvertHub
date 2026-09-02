import { resolve } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';

export const FIXTURE_JPG = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'api',
  'test',
  'fixtures',
  'sample.jpg',
);

/** Общий префикс тестовых учёток — по нему же идёт уборка. */
export const E2E_EMAIL_PREFIX = 'e2e-pw-';

export const uniqueEmail = (): string =>
  `${E2E_EMAIL_PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/**
 * Локаль форсится в `en` до первой отрисовки: `detectLocale()` иначе зависит
 * от часового пояса машины (`ru` на машине владельца, `en` в CI) и ломал бы
 * текстовые селекторы. `auto`-фикстура — выполняется для каждого теста без
 * явной ссылки.
 */
export const test = base.extend<{ forcedLocale: void }>({
  forcedLocale: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('convert-hub-locale', 'en');
        } catch {
          // приватный режим — тест всё равно ждёт en по умолчанию в CI
        }
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Регистрация через UI: заполнить форму, дождаться, что появилась
 * навигация вошедшего (ссылка «My files» в шапке — её нет у гостя).
 */
export async function registerViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill('correcthorsebatterystaple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page
    .getByRole('link', { name: 'My files' })
    .waitFor({ state: 'visible' });
}

/** Выбрать файл в зоне загрузки и запустить конвертацию. */
export async function convertFile(page: Page, filePath: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Convert' }).click();
}
