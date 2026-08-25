import { Injectable, effect, signal } from '@angular/core';

import { formatBytes } from '../i18n/format';
import { MESSAGES, type MessageKey } from '../i18n/messages';
import { type Locale, detectLocale, storeLocale } from '../i18n/locale';

export type MessageParams = Readonly<Record<string, string | number>>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(detectLocale());

  constructor() {
    effect(() => {
      const locale = this.locale();
      document.documentElement.lang = locale;
      document.title = MESSAGES[locale]['app.title'];
    });
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    storeLocale(locale);
  }

  t(key: MessageKey, params?: MessageParams): string {
    const template = MESSAGES[this.locale()][key];
    return params === undefined ? template : interpolate(template, params);
  }

  formatBytes(bytes: number): string {
    return formatBytes(bytes, this.locale());
  }
}

function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (placeholder: string, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}
