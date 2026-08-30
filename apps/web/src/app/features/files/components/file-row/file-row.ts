import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n';
import { FileTypeIcon } from '../../../../shared/ui/file-type-icon/file-type-icon';
import type { FileEntry } from '../../model/file-entry';
import { fileCategory } from '../../model/file-entry';

@Component({
  selector: 'app-file-row',
  imports: [FileTypeIcon],
  templateUrl: './file-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileRow {
  protected readonly i18n = inject(I18nService);

  entry = input.required<FileEntry>();
  toggled = output<void>();

  protected readonly category = computed(() => fileCategory(this.entry().target));

  /** Обрезка по центру: ствол имени укорачивается, расширение всегда видно (`DESIGN.md`). */
  protected readonly namePart = computed(() => {
    const name = this.entry().name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
  });

  protected readonly extensionPart = computed(() => {
    const name = this.entry().name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
  });
}
