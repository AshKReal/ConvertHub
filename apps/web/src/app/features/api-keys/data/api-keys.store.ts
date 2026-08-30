import { Injectable, signal } from '@angular/core';

import type { ApiKey, ApiKeyEnvironment } from '../model/api-key';
import { MOCK_API_KEYS, generateApiKey } from './api-keys.mock';

/** Провайдится на уровне маршрута (`api-keys-page`), не в `root` — та же дисциплина, что `FilesStore` (021). */
@Injectable()
export class ApiKeysStore {
  private readonly _keys = signal<readonly ApiKey[]>(MOCK_API_KEYS);
  private nextIdCounter = MOCK_API_KEYS.length;

  readonly keys = this._keys.asReadonly();

  issue(environment: ApiKeyEnvironment = 'live'): string {
    const { fullValue, maskedPrefix } = generateApiKey(environment);
    this._keys.update((keys) => [this.buildKey(environment, maskedPrefix), ...keys]);
    return fullValue;
  }

  reissue(id: string): string | undefined {
    const existing = this._keys().find((key) => key.id === id);
    if (existing === undefined) {
      return undefined;
    }

    const { fullValue, maskedPrefix } = generateApiKey(existing.environment);
    this._keys.update((keys) =>
      keys.map((key) => (key.id === id ? { ...key, maskedPrefix, lastUsedAt: null } : key)),
    );
    return fullValue;
  }

  revoke(id: string): void {
    this._keys.update((keys) => keys.filter((key) => key.id !== id));
  }

  private buildKey(environment: ApiKeyEnvironment, maskedPrefix: string): ApiKey {
    this.nextIdCounter += 1;
    return {
      id: `key-${String(this.nextIdCounter).padStart(3, '0')}`,
      environment,
      maskedPrefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
  }
}
