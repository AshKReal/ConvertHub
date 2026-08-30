import { HttpClient, type HttpEvent } from '@angular/common/http';
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
    /**
     * Поток событий, не готовый `Blob` (спека 005) — `reportProgress` даёт
     * реальный `HttpEventType.UploadProgress` для полосы прогресса зоны
     * загрузки, `observe: 'events'` нужен, чтобы его вообще получить. Тело
     * успешного ответа — бинарный результат конвертации (ARCHITECTURE.md §7.3),
     * `responseType: 'blob'` действует и на событие `Response` внутри потока.
     */
    convert(file: File, request: ConvertRequest): Observable<HttpEvent<Blob>> {
      return http.post(`${environment.apiUrl}/v1/convert`, buildConvertFormData(file, request), {
        responseType: 'blob',
        reportProgress: true,
        observe: 'events',
      });
    },
  };
}
