import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Экспортирован — `theme.spec.ts` проверяет persist без дублирования строкового литерала. */
export const THEME_STORAGE_KEY = 'convert-hub-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.readAppliedTheme());

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  private readAppliedTheme(): Theme {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
}
