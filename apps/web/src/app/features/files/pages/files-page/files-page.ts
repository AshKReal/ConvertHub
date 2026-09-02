import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { USER_STORAGE_QUOTA_BYTES } from '@convert-hub/shared';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { I18nService } from '../../../../core/services/i18n';
import { injectMeQuery } from '../../../../core/services/me';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { StorageQuota } from '../../../../shared/ui/storage-quota/storage-quota';
import { FileRow } from '../../components/file-row/file-row';
import { FileRowSkeleton } from '../../components/file-row-skeleton/file-row-skeleton';
import { injectFilesQuery, injectToggleSaveMutation } from '../../data/files.api';

const SKELETON_ROWS = 4;

/**
 * Спека 010. `FilesStore` (мок, 021) удалён целиком — TanStack Query уже
 * даёт сигналы состояния сам, отдельный класс-стор не нужен
 * (`ARCHITECTURE.md` §6.2: серверные данные не копируются в сигналы).
 */
@Component({
  selector: 'app-files-page',
  imports: [Button, StorageQuota, FileRow, FileRowSkeleton],
  templateUrl: './files-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesPage {
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly filesQuery = injectFilesQuery();
  protected readonly meQuery = injectMeQuery();
  protected readonly toggleSave = injectToggleSaveMutation();

  protected readonly skeletonRows = Array.from({ length: SKELETON_ROWS });
  protected readonly quotaTotal = USER_STORAGE_QUOTA_BYTES;

  protected readonly entries = computed(
    () => this.filesQuery.data()?.pages.flatMap((page) => page.items) ?? [],
  );

  protected readonly quotaLabel = computed(() =>
    this.i18n.t('files.quota.label', {
      used: this.i18n.formatBytes(this.meQuery.data()?.storageUsedBytes ?? 0),
      total: this.i18n.formatBytes(this.quotaTotal),
    }),
  );

  protected loadMore(): void {
    void this.filesQuery.fetchNextPage();
  }

  protected onToggle(id: string, currentlySaved: boolean): void {
    this.toggleSave.mutate(
      { id, save: !currentlySaved },
      {
        onError: (error: AppError) => this.toast.show('danger', error.message),
      },
    );
  }
}
