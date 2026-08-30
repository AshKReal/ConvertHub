import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY, ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('starts in light theme when the DOM has no dark class', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
  });

  it('reads an already-applied dark class on construction (theme-init.js уже отработал до бутстрапа Angular)', () => {
    document.documentElement.classList.add('dark');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark');
  });

  it('toggle() switches to dark and applies the class to <html>', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle() twice returns to light and removes the class', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme persists the choice to localStorage', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
