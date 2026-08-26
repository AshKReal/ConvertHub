import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Button, type ButtonVariant } from '../button/button';

/**
 * Дженерик — не знает о том, что подтверждает. `ModalService.open()` не
 * умеет биндить `output()` через `NgComponentOutlet`, поэтому обратная связь
 * идёт через колбэки во `input()`, а не через события.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Button],
  templateUrl: './confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  title = input.required<string>();
  message = input.required<string>();
  confirmLabel = input.required<string>();
  cancelLabel = input.required<string>();
  variant = input<ButtonVariant>('danger');
  onConfirm = input.required<() => void>();
  onCancel = input.required<() => void>();

  protected confirm(): void {
    this.onConfirm()();
  }

  protected cancel(): void {
    this.onCancel()();
  }
}
