import { describe, expect, it } from 'vitest';

import { hashIp } from './hash-ip';

// Чистая функция, без NestJS DI — второй шаблон юнит-теста рядом с
// token.service.spec.ts (тот через Test.createTestingModule), на случай,
// где контейнер не нужен вообще.
describe('hashIp', () => {
  it('is deterministic for the same input', () => {
    expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'));
  });

  it('produces different hashes for different IPs', () => {
    expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'));
  });

  it('never returns the raw IP itself (не логировать/хранить настоящий IP)', () => {
    const ip = '203.0.113.7';
    expect(hashIp(ip)).not.toContain(ip);
  });

  it('returns a 64-character lowercase hex sha256 digest', () => {
    expect(hashIp('203.0.113.7')).toMatch(/^[0-9a-f]{64}$/);
  });
});
