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
  ERROR_CODES,
  MAX_FILE_SIZE_BYTES,
  USER_STORAGE_QUOTA_BYTES,
  acceptAttribute,
  type ConversionDirection,
} from '@convert-hub/shared';

import type { Subscription } from 'rxjs';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { ERROR_MESSAGE_KEYS } from '../../../../core/i18n/messages';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { injectConvertApi } from '../../data/convert.api';
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
  quotaFull: 'border-solid border-warning bg-warning-subtle',
  dragover: 'border-solid border-accent-hover bg-accent-subtle scale-[1.01]',
  selected: 'border-solid border-hairline bg-surface',
  uploading: 'border-solid border-hairline bg-surface',
  converting: 'border-solid border-hairline bg-surface',
  done: 'border-solid border-success bg-surface',
  error: 'border-solid border-danger bg-danger-subtle',
};

const ICON_BY_KIND: Partial<Record<DropzoneStateKind, string>> = {
  empty: 'text-text-muted',
  quotaFull: 'text-warning',
  dragover: 'text-accent-hover',
  selected: 'text-text-secondary',
  uploading: 'text-text-secondary',
};

/**
 * Мок-заготовка для 006: реальный расчёт занятого места — 010.
 * Значение меняется только руками, для ручной приёмки.
 */
const MOCK_STORAGE_USED_BYTES = 0;

const UPLOAD_TICK_MS = 150;
const UPLOAD_STEP = 20;

@Component({
  selector: 'app-dropzone',
  imports: [Button],
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
  private readonly toast = inject(ToastService);
  private readonly convertApi = injectConvertApi();

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  private readonly file = signal<File | null>(null);
  private readonly resultBlob = signal<Blob | null>(null);

  /**
   * Счётчик, а не флаг: `dragleave` срабатывает при переходе курсора на дочерний
   * элемент внутри зоны, и одиночный флаг гасил бы подсветку на каждом таком переходе.
   */
  private readonly dragDepth = signal(0);

  private readonly phase = signal<'idle' | 'uploading' | 'converting' | 'done'>('idle');
  private readonly progress = signal(0);
  private readonly error = signal<AppError | null>(null);

  private uploadTimer: ReturnType<typeof setInterval> | null = null;
  private convertSubscription: Subscription | null = null;

  /** `ARCHITECTURE.md` §6.4: выставляется до выбора файла, по данным `['me']` — здесь на моке. */
  protected readonly quotaFull = MOCK_STORAGE_USED_BYTES >= USER_STORAGE_QUOTA_BYTES;

  protected readonly state = computed<DropzoneState>(() => {
    const error = this.error();
    if (error !== null) {
      return { kind: 'error', error };
    }

    const file = this.file();
    if (file === null) {
      if (this.dragDepth() > 0) {
        return { kind: 'dragover' };
      }
      return this.quotaFull ? { kind: 'quotaFull' } : { kind: 'empty' };
    }

    switch (this.phase()) {
      case 'uploading':
        return { kind: 'uploading', file, progress: this.progress() };
      case 'converting':
        return { kind: 'converting', file };
      case 'done':
        return { kind: 'done', file };
      case 'idle':
        return { kind: 'selected', file };
    }
  });

  protected readonly zoneClass = computed(() => `${ZONE_BASE} ${ZONE_BY_KIND[this.state().kind]}`);
  protected readonly iconClass = computed(() => `h-8 w-8 ${ICON_BY_KIND[this.state().kind] ?? ''}`);
  protected readonly accept = computed(() => acceptAttribute(this.direction()));
  protected readonly maxSize = computed(() => this.i18n.formatBytes(MAX_FILE_SIZE_BYTES));

  protected open(): void {
    this.picker().nativeElement.click();
  }

  protected clear(): void {
    this.stopTimers();
    this.file.set(null);
    this.resultBlob.set(null);
    this.phase.set('idle');
    this.progress.set(0);
    this.error.set(null);
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

  /** Кнопка запуска в `selected` — перенесена сюда из 001, включает автомат. */
  protected start(): void {
    if (this.file() === null || this.phase() !== 'idle') {
      return;
    }

    this.phase.set('uploading');
    this.progress.set(0);

    this.uploadTimer = setInterval(() => {
      const next = this.progress() + UPLOAD_STEP;
      if (next >= 100) {
        this.progress.set(100);
        this.stopUploadTimer();
        this.phase.set('converting');
        this.runConversion();
        return;
      }
      this.progress.set(next);
    }, UPLOAD_TICK_MS);
  }

  /** Пока просто возврат в `empty` — реальный обрыв HTTP при подключении в 005. */
  protected cancel(): void {
    this.clear();
  }

  protected retry(): void {
    this.clear();
  }

  protected download(): void {
    const current = this.state();
    const blob = this.resultBlob();
    if (current.kind !== 'done' || blob === null) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resultFileName(current.file.name, this.direction().target);
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Реальный `POST /v1/convert` (026) — прогресс выше остаётся имитацией
   * (настоящие события загрузки и обрыв через HTTP — 005), меняется только
   * источник итога: раньше сфабрикованный в браузере, теперь ответ сервера.
   * Отказ показывается тостом, не в самой зоне — так же, как уже решено в 006
   * для сбоя конвертера, в отличие от отказа при выборе файла (см. `select()`).
   */
  private runConversion(): void {
    const file = this.file();
    if (file === null) {
      return;
    }

    this.convertSubscription = this.convertApi
      .convert(file, { target: this.direction().target })
      .subscribe({
        next: (blob) => {
          this.resultBlob.set(blob);
          this.phase.set('done');
        },
        error: (error: AppError) => {
          this.phase.set('idle');
          this.toast.show('danger', error.message);
        },
      });
  }

  private select(files: FileList | null): void {
    const kind = this.state().kind;
    if (kind !== 'empty' && kind !== 'dragover' && kind !== 'quotaFull') {
      return;
    }

    const file = files?.item(0) ?? null;
    if (file === null) {
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.error.set(this.buildFileTooLargeError(file));
      return;
    }

    this.error.set(null);
    this.file.set(file);
  }

  private buildFileTooLargeError(file: File): AppError {
    return {
      code: 'FILE_TOO_LARGE',
      message: this.i18n.t(ERROR_MESSAGE_KEYS.FILE_TOO_LARGE, {
        actual: this.i18n.formatBytes(file.size),
        max: this.i18n.formatBytes(MAX_FILE_SIZE_BYTES),
      }),
      requestId: undefined,
      retryable: ERROR_CODES.FILE_TOO_LARGE.retryable,
    };
  }

  private stopUploadTimer(): void {
    if (this.uploadTimer !== null) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }
  }

  private stopTimers(): void {
    this.stopUploadTimer();
    if (this.convertSubscription !== null) {
      this.convertSubscription.unsubscribe();
      this.convertSubscription = null;
    }
  }
}

function resultFileName(originalName: string, target: string): string {
  const base = originalName.replace(/\.[^.]+$/, '');
  return `${base}.${target}`;
}
