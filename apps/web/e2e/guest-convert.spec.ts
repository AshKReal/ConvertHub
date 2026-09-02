import { readFileSync } from 'node:fs';

import { convertFile, expect, FIXTURE_JPG, test } from './support/app';

/**
 * ARCHITECTURE.md §11: гость конвертирует файл от выбора до скачивания.
 * Никакой сессии — `POST /v1/convert` гостевой.
 *
 * Скачанный файл проверяется по сигнатуре: вход — JPEG (`FF D8 FF`), выход
 * обязан быть PNG (`89 50 4E 47`). Имя файла в зоне загрузки собирается на
 * клиенте из имени входа + `target`, поэтому `suggestedFilename()` сам по
 * себе конвертацию не доказывает — нужны байты результата.
 */
test('a guest converts a JPEG to PNG and downloads a real PNG', async ({
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

  const path = await download.path();
  const bytes = readFileSync(path);
  expect(bytes.byteLength).toBeGreaterThan(8);
  // PNG signature — не JPEG-эхо и не пустое тело.
  expect(bytes.subarray(0, 4).toString('hex')).toBe('89504e47');
});
