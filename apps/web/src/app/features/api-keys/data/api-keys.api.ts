import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import type { ApiKeyListResponse, IssuedApiKey } from '@convert-hub/shared';
import { firstValueFrom } from 'rxjs';

import type { AppError } from '../../../core/interceptors/error-interceptor';
import { environment } from '../../../../environments/environment';

const API_KEYS_BASE = `${environment.apiUrl}/v1/api-keys`;

/**
 * Спека 011. Единственное место, вызывающее `HttpClient` для этой фичи
 * (`frontend.md`). Мок-стор 022 (`api-keys.store.ts`/`api-keys.mock.ts`)
 * удалён целиком — TanStack Query даёт сигналы состояния сам, как и `/files`
 * (010). Полное значение ключа приходит только в ответе `issue`/`reissue`.
 */
export function injectApiKeysQuery() {
  const http = inject(HttpClient);

  return injectQuery(() => ({
    queryKey: ['api-keys'],
    queryFn: () =>
      firstValueFrom(http.get<ApiKeyListResponse>(API_KEYS_BASE, { withCredentials: true })),
  }));
}

export function injectIssueApiKeyMutation() {
  const http = inject(HttpClient);
  const queryClient = injectQueryClient();

  return injectMutation<IssuedApiKey, AppError, void>(() => ({
    mutationFn: () =>
      firstValueFrom(http.post<IssuedApiKey>(API_KEYS_BASE, {}, { withCredentials: true })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  }));
}

export function injectReissueApiKeyMutation() {
  const http = inject(HttpClient);
  const queryClient = injectQueryClient();

  return injectMutation<IssuedApiKey, AppError, string>(() => ({
    mutationFn: (id) =>
      firstValueFrom(
        http.post<IssuedApiKey>(`${API_KEYS_BASE}/${id}/reissue`, {}, { withCredentials: true }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  }));
}

export function injectRevokeApiKeyMutation() {
  const http = inject(HttpClient);
  const queryClient = injectQueryClient();

  return injectMutation<void, AppError, string>(() => ({
    mutationFn: (id) =>
      firstValueFrom(http.delete<void>(`${API_KEYS_BASE}/${id}`, { withCredentials: true })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  }));
}
