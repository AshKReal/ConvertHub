import { convertFile, expect, FIXTURE_JPG, test } from './support/app';

/**
 * ARCHITECTURE.md §11: гость конвертирует файл от выбора до скачивания.
 * Никакой сессии — `POST /v1/convert` гостевой.
 */
test('a guest converts a JPEG to PNG and downloads the result', async ({
  page,
}) => {
  await page.goto('/convert/jpg-to-png');

  await convertFile(page, FIXTURE_JPG);

  const downloadButton = page.getByRole('button', { name: 'Download' });
  await expect(downloadButton).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
