import type { FileTypeResult } from 'file-type';
import { describe, expect, it } from 'vitest';
import type { ErrorCode } from '@convert-hub/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import { assertSupportedDirection } from './conversion-direction.validator';

// `assertSupportedDirection` смотрит только на `detected.mime` — `ext`
// заполняем любым непустым значением, чтобы удовлетворить тип.
const detected = (mime: string): FileTypeResult => ({ ext: 'bin', mime });

const responseCode = (thrown: unknown): string => {
  expect(thrown).toBeInstanceOf(AppException);
  const body = (thrown as AppException).getResponse();
  expect(typeof body).toBe('object');
  return (body as { code: string }).code;
};

const catchThrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw, but it returned');
};

describe('assertSupportedDirection', () => {
  it('returns the jpg-to-png direction for a JPEG + target png', () => {
    expect(
      assertSupportedDirection(detected('image/jpeg'), 'png'),
    ).toMatchObject({ id: 'jpg-to-png', target: 'png' });
  });

  it('returns the png-to-jpg direction for a PNG + target jpg', () => {
    expect(
      assertSupportedDirection(detected('image/png'), 'jpg'),
    ).toMatchObject({ id: 'png-to-jpg', target: 'jpg' });
  });

  it('returns the pdf-to-docx direction for a PDF + target docx', () => {
    expect(
      assertSupportedDirection(detected('application/pdf'), 'docx'),
    ).toMatchObject({ id: 'pdf-to-docx', target: 'docx' });
  });

  it('throws UNSUPPORTED_FILE_TYPE when the type could not be detected', () => {
    const thrown = catchThrown(() =>
      assertSupportedDirection(undefined, 'png'),
    );
    expect(responseCode(thrown)).toBe(
      'UNSUPPORTED_FILE_TYPE' satisfies ErrorCode,
    );
    expect((thrown as AppException).getStatus()).toBe(415);
  });

  it('throws UNSUPPORTED_FILE_TYPE for a real type outside the whitelist (image/gif)', () => {
    const thrown = catchThrown(() =>
      assertSupportedDirection(detected('image/gif'), 'png'),
    );
    expect(responseCode(thrown)).toBe(
      'UNSUPPORTED_FILE_TYPE' satisfies ErrorCode,
    );
  });

  it('throws UNSUPPORTED_FILE_TYPE for a real DOCX — docx-to-pdf has no engine yet (018)', () => {
    const thrown = catchThrown(() =>
      assertSupportedDirection(
        detected(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
        'pdf',
      ),
    );
    expect(responseCode(thrown)).toBe(
      'UNSUPPORTED_FILE_TYPE' satisfies ErrorCode,
    );
  });

  it('throws FILE_TYPE_MISMATCH for a supported type whose target does not match (PNG + target pdf)', () => {
    const thrown = catchThrown(() =>
      assertSupportedDirection(detected('image/png'), 'pdf'),
    );
    expect(responseCode(thrown)).toBe('FILE_TYPE_MISMATCH' satisfies ErrorCode);
    expect((thrown as AppException).getStatus()).toBe(415);
  });
});
