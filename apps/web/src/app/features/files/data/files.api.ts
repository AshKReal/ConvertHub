import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  injectInfiniteQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import type { ListFilesResponse, UpdateFileRequest } from '@convert-hub/shared';
import { firstValueFrom } from 'rxjs';

import type { AppError } from '../../../core/interceptors/error-interceptor';
import { environment } from '../../../../environments/environment';

const FILES_BASE = `${environment.apiUrl}/v1/files`;
const PAGE_SIZE = 20;

/**
 * Единственное место, вызывающее `HttpClient` для этой фичи (`frontend.md`).
 * Курсор — `id` (ULID) последнего элемента предыдущей страницы, не номер
 * страницы (`GET /v1/files`, `FilesService.listFiles`, apps/api).
 */
export function injectFilesQuery() {
  const http = inject(HttpClient);

  return injectInfiniteQuery(() => ({
    queryKey: ['files'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      firstValueFrom(
        http.get<ListFilesResponse>(FILES_BASE, {
          withCredentials: true,
          params:
            pageParam === undefined
              ? { limit: PAGE_SIZE }
              : { limit: PAGE_SIZE, cursor: pageParam },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ListFilesResponse) => lastPage.nextCursor ?? undefined,
  }));
}

/**
 * Тумблер `save` на строке файла. `onSuccess` инвалидирует список и квоту
 * вместе — `ARCHITECTURE.md` §6.2: «квота (`['me']`) инвалидируется вместе
 * со списком, иначе счётчик остаётся старым».
 */
export function injectToggleSaveMutation() {
  const http = inject(HttpClient);
  const queryClient = injectQueryClient();

  return injectMutation<void, AppError, { id: string; save: boolean }>(() => ({
    mutationFn: ({ id, save }) => {
      const body: UpdateFileRequest = { save };
      return firstValueFrom(
        http.patch<void>(`${FILES_BASE}/${id}`, body, { withCredentials: true }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  }));
}
