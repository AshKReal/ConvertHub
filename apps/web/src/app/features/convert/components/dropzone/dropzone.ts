import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAX_FILE_SIZE_BYTES,
  acceptAttribute,
  type ConversionDirection,
} from '@convert-hub/shared';

import { I18nService } from '../../../../core/services/i18n';
import type { DropzoneState, DropzoneStateKind } from '../../model/dropzone-state';

const ZONE_BASE =
  'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 p-12 text-center transition-[background-color,border-color,transform] duration-150 ease-out';

/**
 * Ширина границы одинакова во всех состояниях: `DESIGN.md` требует и разной толщины
 * (2px пунктир / 1px сплошная), и неизменных размеров зоны при смене состояния.
 * Второе правило важнее — скачок высоты сдвигает страницу под курсором.
 */
const ZONE_BY_KIND: Record<DropzoneStateKind, string> = {
  empty: 'border-dashed border-strong bg-surface',
  dragover: 'border-solid border-accent-hover bg-accent-subtle scale-[1.01]',
  selected: 'border-solid border-hairline bg-surface',
};

const ICON_BY_KIND: Record<DropzoneStateKind, string> = {
  empty: 'text-text-muted',
  dragover: 'text-accent-hover',
  selected: 'text-text-secondary',
};

@Component({
  selector: 'app-dropzone',
  templateUrl: './dropzone.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(dragenter)': 'onDragEnter($event)',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave()',
    '(drop)': 'onDrop($event)',
  },
})
export class Dropzone {
  direction = input.required<ConversionDirection>();

  protected readonly i18n = inject(I18nService);

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  private readonly file = signal<File | null>(null);

  /**
   * Счётчик, а не флаг: `dragleave` срабатывает при переходе курсора на дочерний
   * элемент внутри зоны, и одиночный флаг гасил бы подсветку на каждом таком переходе.
   */
  private readonly dragDepth = signal(0);

  protected readonly state = computed<DropzoneState>(() => {
    if (this.dragDepth() > 0) {
      return { kind: 'dragover' };
    }

    const file = this.file();
    return file === null ? { kind: 'empty' } : { kind: 'selected', file };
  });

  protected readonly zoneClass = computed(() => `${ZONE_BASE} ${ZONE_BY_KIND[this.state().kind]}`);
  protected readonly iconClass = computed(() => `h-8 w-8 ${ICON_BY_KIND[this.state().kind]}`);
  protected readonly accept = computed(() => acceptAttribute(this.direction()));
  protected readonly maxSize = computed(() => this.i18n.formatBytes(MAX_FILE_SIZE_BYTES));

  protected open(): void {
    this.picker().nativeElement.click();
  }

  protected clear(): void {
    this.file.set(null);
    this.picker().nativeElement.value = '';
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth.update((depth) => depth + 1);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDragLeave(): void {
    this.dragDepth.update((depth) => Math.max(0, depth - 1));
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth.set(0);
    this.select(event.dataTransfer?.files ?? null);
  }

  protected onPicked(): void {
    this.select(this.picker().nativeElement.files);
  }

  private select(files: FileList | null): void {
    const file = files?.item(0) ?? null;
    if (file !== null) {
      this.file.set(file);
    }
  }
}
