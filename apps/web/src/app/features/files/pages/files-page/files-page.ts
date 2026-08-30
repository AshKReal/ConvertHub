import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { USER_STORAGE_QUOTA_BYTES } from '@convert-hub/shared';

import { I18nService } from '../../../../core/services/i18n';
import { Button } from '../../../../shared/ui/button/button';
import { StorageQuota } from '../../../../shared/ui/storage-quota/storage-quota';
import { FileRow } from '../../components/file-row/file-row';
import { FileRowSkeleton } from '../../components/file-row-skeleton/file-row-skeleton';
import { FilesStore } from '../../data/files.store';

const SKELETON_ROWS = 4;

@Component({
  selector: 'app-files-page',
  imports: [Button, StorageQuota, FileRow, FileRowSkeleton],
  providers: [FilesStore],
  templateUrl: './files-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(FilesStore);

  protected readonly skeletonRows = Array.from({ length: SKELETON_ROWS });
  protected readonly quotaTotal = USER_STORAGE_QUOTA_BYTES;

  protected readonly quotaLabel = computed(() =>
    this.i18n.t('files.quota.label', {
      used: this.i18n.formatBytes(this.store.usedBytes()),
      total: this.i18n.formatBytes(this.quotaTotal),
    }),
  );
}
