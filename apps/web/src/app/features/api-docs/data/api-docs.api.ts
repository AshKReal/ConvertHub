import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

/** Строка таблицы эндпоинтов, вычисленная из `/v1/openapi.json` — не весь OpenAPI. */
export interface ApiDocEndpoint {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
}

interface OpenApiPathsSubset {
  readonly paths: Record<string, Record<string, { summary?: string }>>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export const OPENAPI_URL = `${environment.apiUrl}/v1/openapi.json`;

/**
 * Спека 013. Единственный вызов `HttpClient` этой фичи (`frontend.md`).
 * Схема генерируется на бэкенде из тех же Zod-схем `packages/shared`, что
 * валидируют запросы — заменяет стаб-список 023.
 */
export function injectOpenApiEndpointsQuery() {
  const http = inject(HttpClient);

  return injectQuery(() => ({
    queryKey: ['openapi'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ApiDocEndpoint[]> => {
      const doc = await firstValueFrom(http.get<OpenApiPathsSubset>(OPENAPI_URL));
      return Object.entries(doc.paths).flatMap(([path, operations]) =>
        HTTP_METHODS.filter((method) => method in operations).map((method) => ({
          method: method.toUpperCase(),
          path,
          summary: operations[method]?.summary ?? '',
        })),
      );
    },
  }));
}
