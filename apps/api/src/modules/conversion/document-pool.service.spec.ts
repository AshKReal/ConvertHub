import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_POOL_SIZE,
  DOCUMENT_POOL_WAIT_SECONDS,
  type ErrorCode,
} from '@convert-hub/shared';

import { AppException } from '../../common/exceptions/app.exception';
import type { MetricsService } from '../metrics/metrics.service';
import { DocumentPoolService } from './document-pool.service';

describe('DocumentPoolService', () => {
  let pool: DocumentPoolService;
  let inc: ReturnType<typeof vi.fn>;
  let dec: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    inc = vi.fn();
    dec = vi.fn();
    const metrics = {
      documentPoolActive: { inc, dec },
    } as unknown as MetricsService;
    pool = new DocumentPoolService(metrics);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets DOCUMENT_POOL_SIZE acquisitions through without waiting', async () => {
    for (let i = 0; i < DOCUMENT_POOL_SIZE; i += 1) {
      await expect(pool.acquire()).resolves.toBeUndefined();
    }
    expect(inc).toHaveBeenCalledTimes(DOCUMENT_POOL_SIZE);
  });

  it('makes the (size+1)th acquisition wait until a slot is released', async () => {
    for (let i = 0; i < DOCUMENT_POOL_SIZE; i += 1) {
      await pool.acquire();
    }

    let resolved = false;
    const pending = pool.acquire().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    pool.release();
    await pending;
    expect(resolved).toBe(true);
    // Слот передан из очереди — не новый inc и не dec.
    expect(inc).toHaveBeenCalledTimes(DOCUMENT_POOL_SIZE);
    expect(dec).not.toHaveBeenCalled();
  });

  it('rejects a waiter with SERVICE_OVERLOADED after DOCUMENT_POOL_WAIT_SECONDS', async () => {
    for (let i = 0; i < DOCUMENT_POOL_SIZE; i += 1) {
      await pool.acquire();
    }

    const waiting = pool.acquire();
    const assertion = expect(waiting).rejects.toMatchObject({
      constructor: AppException,
    });
    vi.advanceTimersByTime(DOCUMENT_POOL_WAIT_SECONDS * 1000);
    await assertion;

    const error = await waiting.catch((e: unknown) => e);
    expect((error as AppException).getResponse()).toMatchObject({
      code: 'SERVICE_OVERLOADED' satisfies ErrorCode,
      meta: { retry_after_seconds: DOCUMENT_POOL_WAIT_SECONDS },
    });
  });

  it('release without a waiter frees the slot and decrements the gauge', async () => {
    await pool.acquire();
    pool.release();
    expect(dec).toHaveBeenCalledTimes(1);

    // Слот действительно свободен — следующий acquire не ждёт.
    await expect(pool.acquire()).resolves.toBeUndefined();
  });
});
