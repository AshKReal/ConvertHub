import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authResponseSchema, type ErrorCode } from '@convert-hub/shared';

import { env } from '../src/config/env';
import { AppModule } from '../src/app.module';
import { cleanupUser } from './utils/test-db';

/**
 * Спека 018. Полный HTTP-путь `DOCX → PDF` против настоящего Gotenberg.
 * Запускается только при `E2E_DOCX=1` (нужен поднятый Gotenberg —
 * `docker compose --profile full` либо опубликованный порт, docs/SETUP.md).
 * В CI `e2e`-джобе Gotenberg-а нет, флаг не выставлен. ZIP-бомба и снятие
 * исключения `docx-to-pdf` покрыты юнит-тестами и Gotenberg не требуют.
 */
const runDocxE2e = process.env.E2E_DOCX === '1';

const fixture = (name: string): Buffer =>
  readFileSync(join(process.cwd(), 'test', 'fixtures', name));
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe.skipIf(!runDocxE2e)('POST /v1/convert — DOCX to PDF (e2e)', () => {
  let app: INestApplication<Server>;
  const email = `e2e-docx-${Date.now()}@example.com`;
  let token = '';

  beforeAll(async () => {
    const gotenbergUp = await fetch(`${env.GOTENBERG_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!gotenbergUp) {
      throw new Error(
        `E2E_DOCX=1, но Gotenberg недоступен на ${env.GOTENBERG_URL} (docs/SETUP.md).`,
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const registration = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'correcthorsebatterystaple' })
      .expect(200);
    token = authResponseSchema.parse(registration.body).accessToken;
  });

  afterAll(async () => {
    await cleanupUser(email);
    await app.close();
  });

  it('converts a real .docx into a PDF', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/convert')
      .set('Authorization', `Bearer ${token}`)
      .field('target', 'pdf')
      .attach('file', fixture('sample.docx'), {
        filename: 'sample.docx',
        contentType: DOCX_MIME,
      })
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejects a zip-bomb .docx before touching Gotenberg', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/convert')
      .set('Authorization', `Bearer ${token}`)
      .field('target', 'pdf')
      .attach('file', fixture('zip-bomb.docx'), {
        filename: 'zip-bomb.docx',
        contentType: DOCX_MIME,
      })
      .expect(413);

    expect((response.body as { code: string }).code).toBe(
      'FILE_TOO_LARGE' satisfies ErrorCode,
    );
  });

  it('rejects a bomb that lies in its headers (🔒 BE-DOCX-01)', async () => {
    // 41 КБ на диске, заголовки заявляют 100 байт, DEFLATE разворачивается в
    // 40 МиБ. Отличается от кейса выше тем, что проверку по заявленному
    // размеру проходит — отказ даёт только фактическая распаковка.
    const response = await request(app.getHttpServer())
      .post('/v1/convert')
      .set('Authorization', `Bearer ${token}`)
      .field('target', 'pdf')
      .attach('file', fixture('zip-bomb-deflate.docx'), {
        filename: 'zip-bomb-deflate.docx',
        contentType: DOCX_MIME,
      })
      .expect(413);

    expect((response.body as { code: string }).code).toBe(
      'FILE_TOO_LARGE' satisfies ErrorCode,
    );
  });
});
