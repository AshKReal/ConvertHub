export type ApiKeyEnvironment = 'live' | 'test';

export interface ApiKey {
  readonly id: string;
  readonly environment: ApiKeyEnvironment;
  readonly maskedPrefix: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}
