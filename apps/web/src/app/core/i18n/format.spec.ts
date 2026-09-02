import { describe, expect, it } from 'vitest';

import { formatBytes, formatDate } from './format';

// Intl вставляет между числом и юнитом неразрывный пробел (U+00A0 или узкий
// U+202F); `\s` в JS-регулярке покрывает оба — сводим любой пробел к
// обычному, чтобы ассерты не зависели от версии ICU.
const norm = (value: string): string => value.replace(/\s+/g, ' ');

describe('formatBytes', () => {
  it('uses the byte unit below 1024 with no fraction', () => {
    expect(norm(formatBytes(0, 'en'))).toMatch(/^0 ?byte/i);
    expect(norm(formatBytes(500, 'en'))).toMatch(/^500 ?bytes?$/i);
    expect(norm(formatBytes(1023, 'en'))).toMatch(/^1,023 ?bytes?$/i);
  });

  it('switches to kilobytes at exactly 1024', () => {
    expect(norm(formatBytes(1024, 'en'))).toMatch(/^1 ?kB$/);
    expect(norm(formatBytes(1024 * 1024 - 1, 'en'))).toMatch(/kB$/);
  });

  it('switches to megabytes at exactly 1 MiB (no forced trailing zero)', () => {
    expect(norm(formatBytes(1024 * 1024, 'en'))).toMatch(/^1 ?MB$/);
    expect(norm(formatBytes(300 * 1024 * 1024, 'en'))).toMatch(/^300 ?MB$/);
    // дробная часть появляется только когда она не нулевая, максимум один знак
    expect(norm(formatBytes(2.75 * 1024 * 1024, 'en'))).toMatch(/^2\.8 ?MB$/);
  });

  it('formats the same value differently per locale (separator + unit)', () => {
    const oneAndAHalfMiB = 1.5 * 1024 * 1024;
    expect(norm(formatBytes(oneAndAHalfMiB, 'en'))).toContain('1.5');
    expect(norm(formatBytes(oneAndAHalfMiB, 'ru'))).toContain('1,5');
    expect(formatBytes(oneAndAHalfMiB, 'ru')).toContain('МБ');
    expect(formatBytes(oneAndAHalfMiB, 'uk')).toContain('МБ');
  });
});

describe('formatDate', () => {
  const noonUtc = '2026-09-02T12:00:00Z';

  it('renders a short month + numeric year for en', () => {
    const formatted = formatDate(noonUtc, 'en');
    expect(formatted).toMatch(/Sep/);
    expect(formatted).toMatch(/2026/);
  });

  it('localises the month name for ru', () => {
    const formatted = formatDate(noonUtc, 'ru');
    expect(formatted).toMatch(/сент/i);
    expect(formatted).toMatch(/2026/);
  });
});
