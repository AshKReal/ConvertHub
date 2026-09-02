import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';

import { expect, test } from './support/app';

/**
 * ARCHITECTURE.md §11: файл больше 10 МБ отклоняется зоной загрузки на
 * клиенте — `POST /v1/convert` не уходит вовсе (серверная 413 — отдельный
 * рубеж, здесь проверяется клиентский).
 */
let dir: string;
let oversizePath: string;

test.beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ch-e2e-'));
  oversizePath = join(dir, 'too-big.jpg');
  writeFileSync(oversizePath, Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024));
});

test.afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('an over-limit file is rejected in the dropzone without a request', async ({
  page,
}) => {
  const convertRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/convert')) {
      convertRequests.push(request.url());
    }
  });

  await page.goto('/convert/jpg-to-png');
  await page.locator('input[type="file"]').setInputFiles(oversizePath);

  await expect(page.getByText(/the limit is/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Convert' })).toHaveCount(0);
  expect(convertRequests).toEqual([]);
});
