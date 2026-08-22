import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../services/theme';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  protected readonly themeService = inject(ThemeService);
}
