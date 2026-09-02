import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { FileListItem } from '@convert-hub/shared';

import { I18nService } from '../../../../core/services/i18n';
import { FileTypeIcon } from '../../../../shared/ui/file-type-icon/file-type-icon';
import { fileCategory } from '../../model/file-entry';

@Component({
  selector: 'app-file-row',
  imports: [FileTypeIcon],
  templateUrl: './file-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileRow {
  protected readonly i18n = inject(I18nService);

  entry = input.required<FileListItem>();
  toggled = output<void>();

  protected readonly category = computed(() => fileCategory(this.entry().extension));

  /**
   * Обрезка по центру: ствол имени укорачивается, расширение всегда видно
   * (`DESIGN.md`). `originalFilename` может нести чужое расширение (файл
   * сконвертирован — реальное хранимое расширение другое, `entry().extension`)
   * или отсутствовать вовсе (`null`) — тогда ствол имени - `id`.
   */
  protected readonly namePart = computed(() => {
    const original = this.entry().originalFilename;
    const base = original ?? this.entry().id;
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
  });

  protected readonly extensionPart = computed(() => `.${this.entry().extension}`);
}
