import type { Server } from 'node:http';
import { IdentityProvider } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@convert-hub/shared';

import { AppException } from '../src/common/exceptions/app.exception';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { testPrisma } from './utils/test-db';

/**
 * 🔒 BE-OAUTH-01. `loginOrLinkIdentity` — единственная точка, где внешняя
 * идентичность превращается в аккаунт. Проверяем её напрямую через DI против
 * настоящей `convert_hub_test`: Google для этого не нужен — контроллер только
 * добывает `sub`/`email`/`email_verified` и передаёт сюда.
 *
 * Ключевой инвариант: неподтверждённый провайдером email не создаёт строку в
 * `users`. Раньше создавал — и атакующий занимал чужой адрес до того, как
 * жертва зарегистрируется (pre-hijacking).
 */
describe('AuthService.loginOrLinkIdentity — неподтверждённый email (e2e)', () => {
  let app: INestApplication<Server>;
  let auth: AuthService;
  const emails: string[] = [];

  const freshEmail = (tag: string): string => {
    const email = `e2e-oauth-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    emails.push(email);
    return email;
  };

  const userByEmail = (email: string) =>
    testPrisma.user.findUnique({ where: { email } });

  const codeOf = async (promise: Promise<unknown>): Promise<string> => {
    const error: unknown = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    return ((error as AppException).getResponse() as { code: string }).code;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    auth = app.get(AuthService);
  });

  afterEach(async () => {
    // Каскад из schema.prisma уносит identities вместе со строкой users.
    await testPrisma.user.deleteMany({ where: { email: { in: emails } } });
    emails.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('НЕ создаёт аккаунт, если провайдер не подтвердил email', async () => {
    const email = freshEmail('create');

    const code = await codeOf(
      auth.loginOrLinkIdentity(
        IdentityProvider.GOOGLE,
        'google-sub-attacker',
        email,
        false,
      ),
    );

    expect(code).toBe('EMAIL_NOT_VERIFIED' satisfies ErrorCode);
    // Собственно фикс: чужой адрес не занят, жертве есть куда регистрироваться.
    expect(await userByEmail(email)).toBeNull();
  });

  it('не привязывает к существующему аккаунту, если email не подтверждён', async () => {
    const email = freshEmail('link');
    await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-owner',
      email,
      true,
    );
    const owner = await userByEmail(email);

    const code = await codeOf(
      auth.loginOrLinkIdentity(
        IdentityProvider.GOOGLE,
        'google-sub-intruder',
        email,
        false,
      ),
    );

    expect(code).toBe('EMAIL_NOT_VERIFIED' satisfies ErrorCode);
    const identities = await testPrisma.identity.findMany({
      where: { userId: owner?.id },
    });
    expect(identities.map((i) => i.providerUid)).toEqual(['google-sub-owner']);
  });

  it('создаёт аккаунт и identity, когда email подтверждён', async () => {
    const email = freshEmail('new');

    const session = await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-new',
      email,
      true,
    );

    expect(session.user).toMatchObject({ email, hasPassword: false });
    const user = await userByEmail(email);
    expect(user).not.toBeNull();
    const identities = await testPrisma.identity.findMany({
      where: { userId: user?.id },
    });
    expect(identities).toHaveLength(1);
  });

  it('привязывает к существующему аккаунту, когда email подтверждён', async () => {
    const email = freshEmail('existing');
    await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-first',
      email,
      true,
    );
    const before = await userByEmail(email);
    // Вторая identity того же провайдера с другим `sub` — так выглядит смена
    // Google-аккаунта на том же адресе.
    await testPrisma.identity.deleteMany({ where: { userId: before?.id } });

    const session = await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-second',
      email,
      true,
    );

    // Тот же пользователь, не новый.
    expect(session.user.id).toBe(before?.id);
    const identities = await testPrisma.identity.findMany({
      where: { userId: before?.id },
    });
    expect(identities.map((i) => i.providerUid)).toEqual(['google-sub-second']);
  });

  it('пускает уже привязанного, даже если провайдер перевернул email_verified', async () => {
    const email = freshEmail('linked');
    const first = await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-linked',
      email,
      true,
    );

    // Тот же `sub`, но флаг стал false — владение уже доказано привязкой.
    const second = await auth.loginOrLinkIdentity(
      IdentityProvider.GOOGLE,
      'google-sub-linked',
      email,
      false,
    );

    expect(second.user.id).toBe(first.user.id);
  });
});
