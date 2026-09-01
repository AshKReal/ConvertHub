import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import type { MeResponse } from '@convert-hub/shared';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

const AUTH_BASE = `${environment.apiUrl}/v1/auth`;

/**
 * Спека 010. `['me']` — общий TanStack Query-ресурс для квоты: полоса на
 * `/files` и состояние `quotaFull` зоны загрузки (`convert`) — обе фичи
 * читают его напрямую, не через сигнал сессии (`AuthService.user` — снэпшот
 * входа, не то же самое, что живой повторный запрос за свежими данными).
 * Живёт в `core/`, а не в `features/files/data/`: `features → features`
 * запрещено (`frontend.md`), общий потребитель нескольких фич — только `core`.
 *
 * `authInterceptor` уже относится к `GET /v1/auth/me` как к защищённому
 * маршруту (см. его докблок) — Bearer и retry-после-401 работают сами,
 * ничего здесь настраивать не нужно.
 *
 * `enabled` — `/files` уже за `authGuard` (гостя туда не пускает маршрут),
 * а `dropzone` (`convert`) публичный: без гейта каждый гость слал бы
 * заведомо обречённый на 401 запрос при каждой загрузке страницы конвертации.
 */
export function injectMeQuery(options?: { enabled?: () => boolean }) {
  const http = inject(HttpClient);

  return injectQuery(() => ({
    queryKey: ['me'],
    enabled: options?.enabled?.() ?? true,
    queryFn: () =>
      firstValueFrom(http.get<MeResponse>(`${AUTH_BASE}/me`, { withCredentials: true })),
  }));
}
