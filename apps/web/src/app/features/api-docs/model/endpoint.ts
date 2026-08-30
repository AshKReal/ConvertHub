import type { MessageKey } from '../../../core/i18n/messages';

export type ApiEndpointId =
  | 'convert'
  | 'listFiles'
  | 'downloadFile'
  | 'deleteFile'
  | 'listConversions'
  | 'formats'
  | 'me'
  | 'health';

export interface ApiEndpoint {
  readonly id: ApiEndpointId;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
}

/** Стаб-список из `TECH-SPEC.md` §7.2 — не контракт, реальная схема из Zod приходит в 013. */
export const API_ENDPOINTS: readonly ApiEndpoint[] = [
  { id: 'convert', method: 'POST', path: '/v1/convert' },
  { id: 'listFiles', method: 'GET', path: '/v1/files' },
  { id: 'downloadFile', method: 'GET', path: '/v1/files/{id}/download' },
  { id: 'deleteFile', method: 'DELETE', path: '/v1/files/{id}' },
  { id: 'listConversions', method: 'GET', path: '/v1/conversions' },
  { id: 'formats', method: 'GET', path: '/v1/formats' },
  { id: 'me', method: 'GET', path: '/v1/me' },
  { id: 'health', method: 'GET', path: '/health, /ready' },
];

export const API_ENDPOINT_DESCRIPTION_KEYS: Record<ApiEndpointId, MessageKey> = {
  convert: 'apiDocs.endpoints.convert',
  listFiles: 'apiDocs.endpoints.listFiles',
  downloadFile: 'apiDocs.endpoints.downloadFile',
  deleteFile: 'apiDocs.endpoints.deleteFile',
  listConversions: 'apiDocs.endpoints.listConversions',
  formats: 'apiDocs.endpoints.formats',
  me: 'apiDocs.endpoints.me',
  health: 'apiDocs.endpoints.health',
};
