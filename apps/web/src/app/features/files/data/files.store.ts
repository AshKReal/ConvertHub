import { Injectable, computed, signal } from '@angular/core';

import type { FileEntry } from '../model/file-entry';
import { FILES_PAGE_SIZE, MOCK_FETCH_DELAY_MS, MOCK_FILES } from './files.mock';

/**
 * Провайдится на уровне маршрута (`files-page`), не в `root` — уходишь со
 * страницы, состояние умирает вместе с ней (`ARCHITECTURE.md` §6.1).
 *
 * `usedBytes` считается по полному мок-списку, не по уже подгруженной
 * странице: иначе индикатор квоты занижал бы занятое место, пока не
 * подгружены все страницы. При подключении 010 стор целиком заменяется
 * на TanStack Query — этот класс живёт только до тех пор.
 */
@Injectable()
export class FilesStore {
  private readonly allEntries = signal<readonly FileEntry[]>(MOCK_FILES);
  private readonly visibleCount = signal(0);
  private readonly _loading = signal(true);
  private readonly _loadingMore = signal(false);

  readonly entries = computed(() => this.allEntries().slice(0, this.visibleCount()));
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly hasMore = computed(() => this.visibleCount() < this.allEntries().length);
  readonly usedBytes = computed(() =>
    this.allEntries()
      .filter((entry) => entry.saved)
      .reduce((sum, entry) => sum + entry.sizeBytes, 0),
  );

  constructor() {
    setTimeout(() => {
      this.visibleCount.set(FILES_PAGE_SIZE);
      this._loading.set(false);
    }, MOCK_FETCH_DELAY_MS);
  }

  loadMore(): void {
    if (this._loadingMore() || !this.hasMore()) {
      return;
    }

    this._loadingMore.set(true);
    setTimeout(() => {
      this.visibleCount.update((count) => count + FILES_PAGE_SIZE);
      this._loadingMore.set(false);
    }, MOCK_FETCH_DELAY_MS);
  }

  toggleSave(id: string): void {
    this.allEntries.update((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, saved: !entry.saved } : entry)),
    );
  }
}
