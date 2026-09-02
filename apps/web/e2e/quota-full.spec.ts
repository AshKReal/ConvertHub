import { USER_STORAGE_QUOTA_BYTES } from '@convert-hub/shared';

import {
  convertFile,
  E2E_EMAIL_PREFIX,
  expect,
  FIXTURE_JPG,
  registerViaUi,
  test,
  uniqueEmail,
} from './support/app';
import { cleanupUsers, setStorageUsage } from './support/db';

/**
 * ARCHITECTURE.md §11: при заполненной квоте конвертация проходит, но файл
 * не сохраняется — сервер отдаёт результат с `X-Save-Skipped-Reason`
 * (спека 010), фронт показывает тост, в `/files` файла нет.
 */
test.afterAll(() => {
  cleanupUsers(E2E_EMAIL_PREFIX);
});

test('conversion at a full quota downloads but does not save the file', async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerViaUi(page, email);
  setStorageUsage(email, USER_STORAGE_QUOTA_BYTES);

  await page.goto('/convert/jpg-to-png');
  await convertFile(page, FIXTURE_JPG);

  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(page.getByText(/your storage is full/i)).toBeVisible();

  await page.getByRole('link', { name: 'My files' }).click();
  await page.waitForURL('**/files');
  await expect(page.getByText('No files yet')).toBeVisible();
});
