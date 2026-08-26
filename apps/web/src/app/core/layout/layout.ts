import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { LOCALES, LOCALE_SHORT_LABELS, type Locale } from '../i18n/locale';
import type { MessageKey } from '../i18n/messages';
import { AuthService } from '../services/auth';
import { I18nService } from '../services/i18n';
import { ModalService } from '../services/modal';
import { ThemeService } from '../services/theme';
import { ToastService } from '../services/toast';
import { Toast } from '../../shared/ui/toast/toast';

const LOCALE_NAME_KEYS: Record<Locale, MessageKey> = {
  en: 'layout.language.en',
  ru: 'layout.language.ru',
  uk: 'layout.language.uk',
};

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, NgComponentOutlet, Toast],
  templateUrl: './layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  protected readonly themeService = inject(ThemeService);
  protected readonly modalService = inject(ModalService);
  protected readonly toastService = inject(ToastService);
  protected readonly authService = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly locales = LOCALES;
  protected readonly shortLabels = LOCALE_SHORT_LABELS;
  protected readonly nameKeys = LOCALE_NAME_KEYS;
}
