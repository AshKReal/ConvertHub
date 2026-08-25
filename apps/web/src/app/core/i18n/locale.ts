export const LOCALES = ['en', 'ru', 'uk'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'convert-hub-locale';

/** Короткая подпись переключателя: код страны читается пользователем быстрее кода языка. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  ru: 'RU',
  uk: 'UA',
};

const COUNTRY_LOCALES = new Map<string, Locale>([
  ['RU', 'ru'],
  ['UA', 'uk'],
]);

/**
 * Часовой пояс — единственный признак страны, доступный без сети.
 * Списки по tzdb: все зоны России и Украины, включая устаревшие имена,
 * которые всё ещё отдают старые браузеры (Europe/Kiev, Europe/Zaporozhye).
 */
const RUSSIA_TIME_ZONES = new Set([
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Kirov',
  'Europe/Volgograd',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Tyumen',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Novokuznetsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Chita',
  'Asia/Yakutsk',
  'Asia/Khandyga',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Asia/Magadan',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Kamchatka',
  'Asia/Anadyr',
]);

const UKRAINE_TIME_ZONES = new Set([
  'Europe/Kyiv',
  'Europe/Kiev',
  'Europe/Uzhgorod',
  'Europe/Zaporozhye',
  'Europe/Simferopol',
]);

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && LOCALES.includes(value as Locale);
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Приватный режим или заблокированное хранилище — работаем без сохранённого выбора.
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Выбор не переживёт перезагрузку, но текущая сессия остаётся рабочей.
  }
}

/**
 * Порядок: сохранённый выбор → страна по часовому поясу → регион языкового тега
 * → сам язык → английский. Страна важнее языка системы: интерфейс Windows на
 * английском у пользователя из России не должен уводить его на английский сайт.
 */
export function detectLocale(): Locale {
  return (
    readStoredLocale() ??
    localeFromTimeZone() ??
    localeFromRegionSubtag() ??
    localeFromLanguageSubtag() ??
    DEFAULT_LOCALE
  );
}

function localeFromTimeZone(): Locale | null {
  let timeZone: string;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Резолвер часового пояса недоступен — остаются языковые теги.
    return null;
  }

  if (RUSSIA_TIME_ZONES.has(timeZone)) {
    return 'ru';
  }

  return UKRAINE_TIME_ZONES.has(timeZone) ? 'uk' : null;
}

function localeFromRegionSubtag(): Locale | null {
  for (const tag of languageTags()) {
    const region = regionOf(tag);
    const locale = region === null ? undefined : COUNTRY_LOCALES.get(region);
    if (locale !== undefined) {
      return locale;
    }
  }

  return null;
}

function localeFromLanguageSubtag(): Locale | null {
  for (const tag of languageTags()) {
    const language = tag.toLowerCase().split('-')[0];
    if (isLocale(language)) {
      return language;
    }
  }

  return null;
}

function languageTags(): readonly string[] {
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

function regionOf(tag: string): string | null {
  try {
    return new Intl.Locale(tag).region ?? null;
  } catch {
    // Тег не разбирается как BCP 47 — просто пропускаем его.
    return null;
  }
}
