import type { Locale } from './locale';

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

/**
 * Единицы («МБ» / «MB») приходят из локали через `Intl`, а не из словаря:
 * иначе их пришлось бы согласовывать с числом руками в каждом языке.
 */
export function formatBytes(bytes: number, locale: Locale): string {
  if (bytes < KILOBYTE) {
    return withUnit(bytes, 'byte', 0, locale);
  }

  if (bytes < MEGABYTE) {
    return withUnit(bytes / KILOBYTE, 'kilobyte', 0, locale);
  }

  return withUnit(bytes / MEGABYTE, 'megabyte', 1, locale);
}

function withUnit(
  value: number,
  unit: string,
  maximumFractionDigits: number,
  locale: Locale,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits,
  }).format(value);
}
