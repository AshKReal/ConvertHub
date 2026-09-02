import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // `exposedHeaders` — без него браузер видит только «простые» заголовки
  // ответа (CORS, cross-origin запрос apps/web -> apps/api): `X-File-Id`
  // (003) был нечитаем из JS с самого начала, просто этим никто не
  // пользовался до тоста на `X-Save-Skipped-Reason` (спека 010) — тот и
  // вскрыл пробел.
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: [
      'X-File-Id',
      'X-Save-Skipped-Reason',
      // Спека 012 — лимит частоты и повтор идемпотентного запроса.
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Idempotent-Replay',
      'Retry-After',
    ],
  });
  // Читает refresh-cookie (спека 007) в `req.cookies` — без этого пришлось
  // бы вручную парсить заголовок `Cookie` в каждом месте, где он нужен.
  app.use(cookieParser());
  await app.listen(env.PORT);
}
void bootstrap();
