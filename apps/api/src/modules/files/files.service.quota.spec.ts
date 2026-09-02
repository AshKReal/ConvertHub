import { describe, expect, it, vi } from 'vitest';
import { USER_STORAGE_QUOTA_BYTES } from '@convert-hub/shared';

import type { PrismaService } from '../../prisma/prisma.service';
import type { Storage } from '../storage/storage.interface';
import { FilesService } from './files.service';

/**
 * Спека 010, чистое решение «квота превышена / нет» в `saveConversionResult`.
 * Атомарность транзакции (`file.create` + `user.update`) здесь НЕ проверяется —
 * мок `$transaction` не может её показать честно (`specs/015-testing.md`,
 * «Отвергнутые варианты»); это работа e2e-слоя `quota.e2e-spec.ts`.
 */
function harness(storageUsedBytes: number | null) {
  const txCreate = vi.fn().mockResolvedValue(undefined);
  const txUpdate = vi.fn().mockResolvedValue(undefined);
  const findUnique = vi
    .fn()
    .mockResolvedValue(storageUsedBytes === null ? null : { storageUsedBytes });
  const runTransaction = vi.fn(
    (cb: (tx: unknown) => unknown): Promise<unknown> =>
      Promise.resolve(
        cb({ file: { create: txCreate }, user: { update: txUpdate } }),
      ),
  );
  const put = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    user: { findUnique },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const storage = {
    put,
    getSignedUrl: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  } as unknown as Storage;

  return {
    service: new FilesService(prisma, storage),
    findUnique,
    put,
    runTransaction,
  };
}

const resultInput = (userId: string | null, resultBytes: number) => ({
  userId,
  buffer: Buffer.alloc(resultBytes),
  mime: 'image/png',
  extension: 'png',
});

describe('FilesService.saveConversionResult — quota gate', () => {
  it('skips saving when the result would push usage one byte past the quota', async () => {
    const { service, put, runTransaction } = harness(USER_STORAGE_QUOTA_BYTES);

    const outcome = await service.saveConversionResult(
      resultInput('user_1', 1),
    );

    expect(outcome).toEqual({ status: 'skipped-quota' });
    expect(put).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('saves when the result lands exactly on the quota boundary', async () => {
    const { service, put, runTransaction } = harness(
      USER_STORAGE_QUOTA_BYTES - 100,
    );

    const outcome = await service.saveConversionResult(
      resultInput('user_1', 100),
    );

    expect(outcome).toMatchObject({ status: 'saved' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  it('never consults the quota for a guest (userId null)', async () => {
    const { service, findUnique, put } = harness(null);

    const outcome = await service.saveConversionResult(
      resultInput(null, 5_000_000),
    );

    expect(outcome).toMatchObject({ status: 'saved' });
    expect(findUnique).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
  });
});
