import type { ConvertRequest } from '@convert-hub/shared';

/**
 * Тело `POST /v1/convert`. `Content-Type` не выставляется ни здесь, ни в вызывающем коде:
 * браузер сам проставит `multipart/form-data` вместе с boundary, а заголовок,
 * выставленный руками, boundary теряет — сервер не разберёт тело (ARCHITECTURE.md §6.3).
 *
 * Сам запрос отправляется в спеке 005; здесь фиксируются имена полей.
 */
export function buildConvertFormData(file: File, request: ConvertRequest): FormData {
  const form = new FormData();

  form.append('file', file);
  form.append('target', request.target);

  if (request.save !== undefined) {
    form.append('save', String(request.save));
  }

  if (request.quality !== undefined) {
    form.append('quality', String(request.quality));
  }

  if (request.background !== undefined) {
    form.append('background', request.background);
  }

  return form;
}
