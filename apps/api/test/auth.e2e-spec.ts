import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { authResponseSchema, type ErrorCode } from '@convert-hub/shared';

import { AppModule } from '../src/app.module';
import { cleanupUser } from './utils/test-db';

// Тело problem+json (026) — `response.body` у supertest типизирован как
// `any`, тот же приём, что `google-oauth.service.ts` (008): узить локальной
// Zod-схемой, не кастом (`any` запрещён, `AGENTS.md`). Не в `packages/shared`
// — это форма ответа сервера, для теста хватает одного поля.
const errorBodySchema = z.object({ code: z.string() });

/**
 * Спека 015 (частично). Поднимает весь `AppModule` против настоящего
 * `convert_hub_test` (`test/setup-e2e.ts` подменяет `DATABASE_URL` раньше
 * этого импорта) — тот же принцип, которым весь сеанс 008/009 проверялся
 * вручную curl'ом: реальный HTTP-вызов к реальной БД ловит то, что юнит-тест
 * с мокнутым Prisma не поймает.
 */
describe('POST /v1/auth/register, GET /v1/auth/me (e2e)', () => {
  // Тип-параметр — `getHttpServer()` иначе типизирован как `any` (сигнатура
  // самого NestJS: платформенный HTTP-сервер varies по адаптеру) — без него
  // каждый `request(app.getHttpServer())` ловил бы `no-unsafe-argument`.
  let app: INestApplication<Server>;
  const email = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Тот же приём, что main.ts#bootstrap — без него register()/login() не
    // видели бы refresh-cookie ни на запись, ни на чтение.
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await cleanupUser(email);
    await app.close();
  });

  it('registers a new user and issues an access token + refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'correcthorsebatterystaple',
        firstName: 'Ада',
        lastName: 'Лавлейс',
      })
      .expect(200);

    const body = authResponseSchema.parse(response.body);
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.user).toMatchObject({
      email,
      hasPassword: true,
      providers: [],
      firstName: 'Ада',
      lastName: 'Лавлейс',
    });
    expect(response.headers['set-cookie']?.[0]).toMatch(/^refresh_token=/);
  });

  /**
   * Спека 029. Имя собирается в шести местах, и пропущенный маппер не падает,
   * а теряет имя после F5 — то есть именно на `GET /me`, а не на регистрации.
   * Проверяем вторым запросом, а не телом `register`.
   *
   * Регистрация здесь одна на четыре проверки намеренно: `AUTH_RATE_LIMIT_MAX`
   * считается по хешу IP, а из теста он у всех спеков один. Отдельная
   * регистрация на каждый случай упирается в 429 — и это не помеха тестам, а
   * работающий лимит, ослаблять его ради удобства нельзя.
   */
  it('имя переживает второй запрос, обрезается и меняется через PATCH', async () => {
    const registration = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `profile-${email}`,
        password: 'correcthorsebatterystaple',
        firstName: '  Грейс  ',
        lastName: '  Хоппер  ',
      })
      .expect(200);
    const { accessToken, user } = authResponseSchema.parse(registration.body);

    // Пробелы по краям обрезаны, а не сохранены: `trim` в схеме стоит ДО
    // ограничений длины.
    expect(user.firstName).toBe('Грейс');
    expect(user.lastName).toBe('Хоппер');

    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ firstName: 'Грейс', lastName: 'Хоппер' });

    const updated = await request(app.getHttpServer())
      .patch('/v1/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Ада', lastName: 'Лавлейс' })
      .expect(200);
    expect(updated.body).toMatchObject({
      firstName: 'Ада',
      lastName: 'Лавлейс',
    });

    // Тот же токен продолжает работать: смена имени сессию не отзывает
    // (`docs/AUTH.md` — отличие от смены пароля).
    const after = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body).toMatchObject({ firstName: 'Ада' });
  });

  /** Лимит частоты не расходуется: схема отклоняет тело до входа в обработчик. */
  it('отклоняет имя из одних пробелов', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `blank-${email}`,
        password: 'correcthorsebatterystaple',
        firstName: '   ',
        lastName: 'Лавлейс',
      })
      .expect(422);

    const body = errorBodySchema.parse(response.body);
    expect(body.code).toBe('INVALID_PARAMETER' satisfies ErrorCode);
  });

  it('rejects a second registration with the same email', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'correcthorsebatterystaple',
        firstName: 'Ада',
        lastName: 'Лавлейс',
      })
      .expect(409);

    const body = errorBodySchema.parse(response.body);
    // Литерал справа — не `body.code` слева — проверяется `satisfies ErrorCode`:
    // ловит опечатку в самом тесте, не сужает ответ сервера искусственно.
    expect(body.code).toBe('EMAIL_ALREADY_REGISTERED' satisfies ErrorCode);
  });

  it('rejects GET /v1/auth/me without a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .expect(401);

    const body = errorBodySchema.parse(response.body);
    expect(body.code).toBe('UNAUTHENTICATED' satisfies ErrorCode);
  });
});
