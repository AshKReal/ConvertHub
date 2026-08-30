import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  generateOpaqueToken,
  hashOpaqueToken,
  TokenService,
} from './token.service';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(async () => {
    // JwtModule.register({}) без секрета в конфиге — TokenService передаёт
    // secret/expiresIn на каждый вызов сам (тот же приём, что auth.module.ts).
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [TokenService],
    }).compile();

    tokenService = moduleRef.get(TokenService);
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('round-trips the original payload', () => {
      const token = tokenService.signAccessToken({
        userId: '01ABC',
        email: 'user@example.com',
      });
      expect(tokenService.verifyAccessToken(token)).toEqual({
        userId: '01ABC',
        email: 'user@example.com',
      });
    });

    it('returns null, not a throw, for an undefined token (guest path)', () => {
      expect(tokenService.verifyAccessToken(undefined)).toBeNull();
    });

    it('returns null, not a throw, for a malformed token', () => {
      expect(tokenService.verifyAccessToken('not-a-jwt')).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('produces a raw value whose hash matches hashOpaqueToken(raw)', () => {
      const token = tokenService.generateRefreshToken();
      expect(token.hash).toBe(hashOpaqueToken(token.raw));
    });
  });
});

// generateOpaqueToken/hashOpaqueToken — свободные функции (token.service.ts),
// без NestJS DI, переиспользуются и AccountService (009) для reset-токена.
describe('generateOpaqueToken', () => {
  it('produces a raw value whose hash is deterministic and matches hashOpaqueToken', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token.raw)).toBe(token.hash);
    expect(hashOpaqueToken(token.raw)).toBe(token.hash);
  });

  it('never generates the same raw token twice (256 бит энтропии)', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.raw).not.toBe(b.raw);
  });
});
