import {
  convertFile,
  expect,
  FIXTURE_JPG,
  registerViaUi,
  test,
  uniqueEmail,
} from './support/app';
import { cleanupUsers } from './support/db';

/**
 * ARCHITECTURE.md §11: пользователь входит, конвертирует с сохранением по
 * умолчанию (спека 010 — вошедший сохраняет без отдельного чекбокса) и
 * видит файл в `/files`.
 */
const email = uniqueEmail();

test.afterAll(() => {
  cleanupUsers(email);
});

test('a signed-in user converts a file and sees it saved in /files', async ({
  page,
}) => {
  await registerViaUi(page, email);

  await page.goto('/convert/jpg-to-png');
  await convertFile(page, FIXTURE_JPG);
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

  await page.getByRole('link', { name: 'My files' }).click();
  await page.waitForURL('**/files');

  const row = page.locator('app-file-row', { hasText: 'sample' });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('Saved')).toBeVisible();
});
