import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  // `bufferLogs` — строки до инициализации `LoggerModule` копятся и
  // сбрасываются после; `useLogger` переводит `Logger` Nest на pino (спека 014).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // `exposedHeaders` — без него браузер видит только «простые» заголовки
  // ответа (CORS, cross-origin запрос apps/web -> apps/api): `X-File-Id`
  // (003) был нечитаем из JS с самого начала, просто этим никто не
  // пользовался до тоста на `X-Save-Skipped-Reason` (спека 010) — тот и
  // вскрыл пробел. `allowedHeaders` не задаётся — `cors` отражает
  // запрошенные заголовки, так кастомный `X-Request-Id` (014) проходит без
  // ручного перечисления.
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
      // Спека 014 — сквозной идентификатор запроса.
      'X-Request-Id',
    ],
  });
  // Читает refresh-cookie (спека 007) в `req.cookies` — без этого пришлось
  // бы вручную парсить заголовок `Cookie` в каждом месте, где он нужен.
  app.use(cookieParser());

  // Спека 017. Без этого вызова Nest не вешает слушатели сигналов ОС, и
  // `PrismaService.onModuleDestroy` ($disconnect) и
  // `RedisModule.onApplicationShutdown` (client.quit) не выполняются никогда:
  // оба хука написаны, но на `SIGTERM` — а именно его шлёт Railway при
  // остановке и передеплое — процесс просто умирает с открытыми соединениями.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}
void bootstrap();
