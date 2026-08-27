import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n';
import { Button } from '../../../../shared/ui/button/button';

const COPIED_RESET_MS = 2000;

@Component({
  selector: 'app-key-reveal-modal',
  imports: [Button],
  templateUrl: './key-reveal-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyRevealModal {
  protected readonly i18n = inject(I18nService);

  fullKey = input.required<string>();
  onClose = input.required<() => void>();

  protected readonly copied = signal(false);

  protected copy(): void {
    navigator.clipboard.writeText(this.fullKey()).catch(() => undefined);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
  }

  protected close(): void {
    this.onClose()();
  }
}
