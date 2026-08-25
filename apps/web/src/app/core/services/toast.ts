import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'danger' | 'warning';

export interface Toast {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly message: string;
}

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;

/**
 * `DESIGN.md`, раздел «Уведомление»: ошибки не скрываются автоматически,
 * остальные — через 5 секунд; не больше трёх одновременно.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<readonly Toast[]>([]);

  private nextId = 0;

  show(variant: ToastVariant, message: string): void {
    const id = ++this.nextId;

    this.toasts.update((toasts) => {
      const next = [...toasts, { id, variant, message }];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });

    if (variant !== 'danger') {
      setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
    }
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
