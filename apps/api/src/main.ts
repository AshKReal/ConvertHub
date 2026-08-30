import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  // Читает refresh-cookie (спека 007) в `req.cookies` — без этого пришлось
  // бы вручную парсить заголовок `Cookie` в каждом месте, где он нужен.
  app.use(cookieParser());
  await app.listen(env.PORT);
}
void bootstrap();
