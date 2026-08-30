import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { ConvertRequest } from '@convert-hub/shared';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { buildConvertFormData } from './convert-request';

/**
 * Единственное место, вызывающее `HttpClient` напрямую для этой фичи
 * (`frontend.md`: компоненты — только через `data/*.api.ts`). Вызывается из
 * поля компонента (`injectConvertApi()` требует контекста инъекции, как и
 * любой `inject()`), а не из обработчика события — так `HttpClient`
 * захватывается один раз, и дальше используется как обычный объект.
 */
export function injectConvertApi() {
  const http = inject(HttpClient);

  return {
    /** Ответ — бинарный результат конвертации (ARCHITECTURE.md §7.3), не JSON. */
    convert(file: File, request: ConvertRequest): Observable<Blob> {
      return http.post(`${environment.apiUrl}/v1/convert`, buildConvertFormData(file, request), {
        responseType: 'blob',
      });
    },
  };
}
