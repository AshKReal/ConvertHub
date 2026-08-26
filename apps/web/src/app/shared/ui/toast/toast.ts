import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ToastVariant = 'success' | 'danger' | 'warning';

const STRIPE_CLASSES: Record<ToastVariant, string> = {
  success: 'border-l-success',
  danger: 'border-l-danger',
  warning: 'border-l-warning',
};

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
};

@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  variant = input.required<ToastVariant>();
  message = input.required<string>();
  dismissLabel = input.required<string>();

  dismissed = output<void>();

  protected readonly stripeClass = computed(() => STRIPE_CLASSES[this.variant()]);
  protected readonly iconClass = computed(() => ICON_CLASSES[this.variant()]);
}
