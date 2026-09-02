import { describe, expect, it } from 'vitest';

import { convertFormSchema } from './convert-form.schema';

/**
 * multer отдаёт все текстовые поля формы строками. `convertFormSchema`
 * (`z.preprocess`) приводит `save`/`quality` к типам, которые ждёт
 * `convertRequestSchema` из `packages/shared`.
 */
describe('convertFormSchema', () => {
  it('accepts a minimal form with only target', () => {
    expect(convertFormSchema.parse({ target: 'png' })).toEqual({
      target: 'png',
    });
  });

  it('coerces save "true"/"false" strings to booleans', () => {
    expect(
      convertFormSchema.parse({ target: 'png', save: 'true' }),
    ).toMatchObject({ save: true });
    expect(
      convertFormSchema.parse({ target: 'png', save: 'false' }),
    ).toMatchObject({ save: false });
  });

  it('treats any non-"true" save string as false', () => {
    expect(
      convertFormSchema.parse({ target: 'png', save: 'yes' }),
    ).toMatchObject({ save: false });
  });

  it('coerces a numeric quality string to a number', () => {
    expect(
      convertFormSchema.parse({ target: 'jpg', quality: '80' }),
    ).toMatchObject({ quality: 80 });
  });

  it('rejects a non-numeric quality string (NaN fails z.number)', () => {
    expect(() =>
      convertFormSchema.parse({ target: 'jpg', quality: 'abc' }),
    ).toThrow();
  });

  it('rejects quality below the 60 floor', () => {
    expect(() =>
      convertFormSchema.parse({ target: 'jpg', quality: '50' }),
    ).toThrow();
  });

  it('rejects a form with no target', () => {
    expect(() => convertFormSchema.parse({ save: 'true' })).toThrow();
  });

  it('rejects an unknown target value', () => {
    expect(() => convertFormSchema.parse({ target: 'gif' })).toThrow();
  });

  it('strips unknown fields (z.object default)', () => {
    expect(convertFormSchema.parse({ target: 'png', bogus: 'x' })).toEqual({
      target: 'png',
    });
  });

  it('accepts a valid #rrggbb background and rejects a named colour', () => {
    expect(
      convertFormSchema.parse({ target: 'png', background: '#ffffff' }),
    ).toMatchObject({ background: '#ffffff' });
    expect(() =>
      convertFormSchema.parse({ target: 'png', background: 'red' }),
    ).toThrow();
  });
});
