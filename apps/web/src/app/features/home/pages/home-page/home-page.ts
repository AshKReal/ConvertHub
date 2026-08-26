import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONVERSION_DIRECTIONS } from '@convert-hub/shared';

import { DIRECTION_DESCRIPTION_KEYS } from '../../../../core/i18n/messages';
import { I18nService } from '../../../../core/services/i18n';
import { Button } from '../../../../shared/ui/button/button';
import { FormatCard } from '../../../../shared/ui/format-card/format-card';

@Component({
  selector: 'app-home-page',
  imports: [Button, FormatCard, RouterLink],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly i18n = inject(I18nService);

  protected readonly directions = CONVERSION_DIRECTIONS;
  protected readonly descriptionKeys = DIRECTION_DESCRIPTION_KEYS;
}
