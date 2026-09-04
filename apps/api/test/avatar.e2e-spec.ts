import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { authResponseSchema, type ErrorCode } from '@convert-hub/shared';

import { AppModule } from '../src/app.module';
import { cleanupUser } from './utils/test-db';

const errorBodySchema = z.object({ code: z.string() });

/** Настоящий PNG, а не байты наугад: проверка идёт по сигнатуре. */
const makePng = (size: number): Promise<Buffer> =>
  sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();

/**
 * Спека 029 🔒. Единственный auth-маршрут, принимающий файл. Юнит-тест сюда
 * не дотягивается: путь целиком состоит из взаимодействия multer, валидаторов,
 * sharp и `Storage`, и ломается он именно на стыках.
 *
 * Регистрация одна на весь файл: `AUTH_RATE_LIMIT_MAX` считается по хешу IP и
 * общий для всех e2e-спеков.
 */
describe('POST /v1/auth/avatar (e2e)', () => {
  let app: INestApplication<Server>;
  let token: string;
  const email = `avatar-e2e-${Date.now()}@example.com`;

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
  });

  afterAll(async () => {
    await cleanupUser(email);
    await app.close();
  });

  it('принимает PNG, отдаёт ссылку и не трогает квоту', async () => {
    const before = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body).toMatchObject({ avatarUrl: null });

    const uploaded = await request(app.getHttpServer())
      .post('/v1/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makePng(64), 'avatar.png')
      .expect(200);

    const user: unknown = uploaded.body;
    expect(user).toMatchObject({ avatarUrl: expect.any(String) as unknown });
    // Ключ наружу не уходит никогда — только подписанная ссылка.
    expect(Object.keys(user as object)).not.toContain('avatarKey');

    // Аватар вне квоты (решение владельца): счётчик обязан остаться нулевым.
    const after = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body).toMatchObject({ storageUsedBytes: 0 });
  });

  it('переживает F5: ссылка приходит и на GET /me, а не только в ответе загрузки', async () => {
    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body).toMatchObject({ avatarUrl: expect.any(String) as unknown });
  });

  it('отклоняет не-изображение с расширением .png — тип берётся из сигнатуры', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('не картинка, а текст'), 'avatar.png')
      .expect(415);

    const body = errorBodySchema.parse(response.body);
    expect(body.code).toBe('UNSUPPORTED_FILE_TYPE' satisfies ErrorCode);
  });

  it('отклоняет запрос без файла', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);

    const body = errorBodySchema.parse(response.body);
    expect(body.code).toBe('INVALID_PARAMETER' satisfies ErrorCode);
  });

  it('удаляет аватар и повторное удаление не считается ошибкой', async () => {
    const removed = await request(app.getHttpServer())
      .delete('/v1/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(removed.body).toMatchObject({ avatarUrl: null });

    const again = await request(app.getHttpServer())
      .delete('/v1/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(again.body).toMatchObject({ avatarUrl: null });
  });

  it('требует авторизации', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/avatar')
      .attach('avatar', await makePng(32), 'avatar.png')
      .expect(401);

    const body = errorBodySchema.parse(response.body);
    expect(body.code).toBe('UNAUTHENTICATED' satisfies ErrorCode);
  });
});
