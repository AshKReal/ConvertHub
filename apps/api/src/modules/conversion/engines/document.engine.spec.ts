import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorCode } from '@convert-hub/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import { env } from '../../../config/env';
import type { ConvertOptions } from '../models/convert-options.model';
import { DocumentEngine } from './document.engine';

const OPTS: ConvertOptions = { target: 'pdf' };

const rejection = async (promise: Promise<unknown>): Promise<AppException> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return error as AppException;
  }
  throw new Error('expected the promise to reject');
};

describe('DocumentEngine', () => {
  const engine = new DocumentEngine();
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('supports only DOCX -> PDF', () => {
    expect(engine.supports('DOCX', 'PDF')).toBe(true);
    expect(engine.supports('PDF', 'DOCX')).toBe(false);
    expect(engine.supports('JPG', 'PNG')).toBe(false);
  });

  it('POSTs the document to the Gotenberg libreoffice route and returns the PDF bytes', async () => {
    const pdf = Buffer.from('%PDF-1.7 ok');
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(
          pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
        ),
    });

    const result = await engine.convert(Buffer.from('docx-bytes'), OPTS);

    expect(result.equals(pdf)).toBe(true);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe(`${env.GOTENBERG_URL}/forms/libreoffice/convert`);
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('maps a non-2xx Gotenberg response to CONVERSION_FAILED with the status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const error = await rejection(engine.convert(Buffer.from('x'), OPTS));
    expect(error.getResponse()).toMatchObject({
      code: 'CONVERSION_FAILED' satisfies ErrorCode,
      meta: { gotenberg_status: 502 },
    });
  });

  it('maps a network failure to CONVERSION_FAILED', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const error = await rejection(engine.convert(Buffer.from('x'), OPTS));
    expect((error.getResponse() as { code: string }).code).toBe(
      'CONVERSION_FAILED' satisfies ErrorCode,
    );
  });

  it('maps an AbortSignal timeout to CONVERSION_TIMEOUT', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('The operation timed out'), {
        name: 'TimeoutError',
      }),
    );
    const error = await rejection(engine.convert(Buffer.from('x'), OPTS));
    expect((error.getResponse() as { code: string }).code).toBe(
      'CONVERSION_TIMEOUT' satisfies ErrorCode,
    );
  });
});
