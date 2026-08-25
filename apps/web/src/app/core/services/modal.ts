import { Injectable, Type, signal } from '@angular/core';

export interface ModalRef {
  readonly id: number;
  close(): void;
}

export interface OpenModal {
  readonly id: number;
  readonly component: Type<unknown>;
  readonly inputs?: Readonly<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly stack = signal<readonly OpenModal[]>([]);

  private nextId = 0;

  open(component: Type<unknown>, inputs?: Readonly<Record<string, unknown>>): ModalRef {
    const id = ++this.nextId;
    this.stack.update((modals) => [...modals, { id, component, inputs }]);
    return { id, close: () => this.close(id) };
  }

  close(id: number): void {
    this.stack.update((modals) => modals.filter((modal) => modal.id !== id));
  }
}
