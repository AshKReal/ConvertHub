import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  USER_STORAGE_QUOTA_BYTES,
  authResponseSchema,
  listFilesResponseSchema,
} from '@convert-hub/shared';

import { AppModule } from '../src/app.module';
import { cleanupUser, testPrisma } from './utils/test-db';

/**
 * Спека 010 + 015. Транзакционная сторона квоты (`file.create` +
 * `user.storageUsedBytes` атомарно, «мягкое» истечение через `expiresAt`)
 * проверяется здесь, на реальном Postgres — юнит с мокнутым Prisma её
 * показать не может (`specs/015-testing.md`, «Отвергнутые варианты»).
 * `jpg-to-png` — движок `sharp`, в процессе, без Python/Gotenberg.
 */
const jpeg = readFileSync(
  join(process.cwd(), 'test', 'fixtures', 'sample.jpg'),
);

describe('POST /v1/convert — storage quota (e2e)', () => {
  let app: INestApplication<Server>;
  const email = `e2e-quota-${Date.now()}@example.com`;
  let token = '';
  let userId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const registration = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'correcthorsebatterystaple',
        firstName: 'Ада',
        lastName: 'Лавлейс',
      })
      .expect(200);
    token = authResponseSchema.parse(registration.body).accessToken;
    userId = (await testPrisma.user.findUniqueOrThrow({ where: { email } })).id;
  });

  afterAll(async () => {
    await cleanupUser(email);
    await app.close();
  });

  const setUsage = (bytes: number) =>
    testPrisma.user.update({
      where: { id: userId },
      data: { storageUsedBytes: bytes },
    });

  const usage = async (): Promise<number> =>
    (
      await testPrisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { storageUsedBytes: true },
      })
    ).storageUsedBytes;

  const convert = () =>
    request(app.getHttpServer())
      .post('/v1/convert')
      .set('Authorization', `Bearer ${token}`)
      .field('target', 'png')
      .field('save', 'true')
      .attach('file', jpeg, {
        filename: 'sample.jpg',
        contentType: 'image/jpeg',
      });

  const listFiles = async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/files')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return listFilesResponseSchema.parse(response.body);
  };

  it('saves the result and grows storage_used_bytes when the quota allows', async () => {
    await setUsage(0);

    const response = await convert().expect(200);
    expect(response.headers['x-save-skipped-reason']).toBeUndefined();
    const fileId = response.headers['x-file-id'];
    expect(fileId).toBeDefined();

    const { items } = await listFiles();
    expect(items.map((file) => file.id)).toContain(fileId);
    expect(await usage()).toBeGreaterThan(0);
  });

  it('skips saving and leaves storage untouched when the quota is full', async () => {
    await setUsage(USER_STORAGE_QUOTA_BYTES);
    const before = await usage();
    const countBefore = (await listFiles()).items.length;

    const response = await convert().expect(200);
    expect(response.headers['x-save-skipped-reason']).toBe('quota-full');
    expect(response.headers['x-file-id']).toBeUndefined();

    expect((await listFiles()).items.length).toBe(countBefore);
    expect(await usage()).toBe(before);
  });

  it('PATCH /v1/files/:id frees the quota on save=false and re-reserves it on save=true', async () => {
    await setUsage(0);
    const created = await convert().expect(200);
    const fileId = created.headers['x-file-id'];
    expect(fileId).toBeDefined();
    const reserved = await usage();
    expect(reserved).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ save: false })
      .expect(204);
    expect(await usage()).toBe(0);

    await request(app.getHttpServer())
      .patch(`/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ save: true })
      .expect(204);
    expect(await usage()).toBe(reserved);
  });
});
