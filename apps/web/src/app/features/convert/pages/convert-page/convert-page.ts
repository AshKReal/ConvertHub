import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { findConversionDirection } from '@convert-hub/shared';

import { DIRECTION_DESCRIPTION_KEYS } from '../../../../core/i18n/messages';
import { I18nService } from '../../../../core/services/i18n';
import { Dropzone } from '../../components/dropzone/dropzone';

@Component({
  selector: 'app-convert-page',
  imports: [RouterLink, Dropzone],
  templateUrl: './convert-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvertPage {
  /** Параметр маршрута `:direction`, приходит через `withComponentInputBinding()`. */
  direction = input.required<string>();

  protected readonly i18n = inject(I18nService);

  protected readonly current = computed(() => findConversionDirection(this.direction()));

  protected readonly descriptionKeys = DIRECTION_DESCRIPTION_KEYS;
}
