#!/usr/bin/env node
// Спека 015. Помощник для Playwright-сценариев (`apps/web/e2e/**`): выставить
// `storageUsedBytes` пользователю (сценарий «квота заполнена») и убрать за
// собой созданных тестами пользователей. Отдельный процесс, а не импорт из
// теста: `@prisma/client` живёт в `apps/api`, тянуть его в `apps/web` ради
// пары запросов не нужно.
//
// БД берётся из `DATABASE_URL` в окружении — Playwright передаёт туда
// `TEST_DATABASE_URL` (`convert_hub_test`), тот же контейнер, что e2e-слой
// `apps/api`. `dotenv/config` как фолбэк для ручного запуска из консоли.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Предохранитель против потери данных: `cleanup` делает `deleteMany` с
// FK-каскадом. Если `DATABASE_URL` случайно указывает на не-тестовую БД
// (TEST_DATABASE_URL == DATABASE_URL), лучше упасть, чем стереть dev-данные.
const dbUrl = process.env.DATABASE_URL ?? '';
const dbName = dbUrl.split('/').pop()?.split('?')[0] ?? '';
if (!dbName.endsWith('_test')) {
  console.error(
    `refusing to run: DATABASE_URL points at "${dbName || '(unknown)'}", not a *_test database`,
  );
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const prisma = new PrismaClient();

try {
  if (command === 'set-usage') {
    const [email, bytes] = args;
    if (email === undefined || bytes === undefined) {
      throw new Error('usage: e2e-db.mjs set-usage <email> <bytes>');
    }
    await prisma.user.update({
      where: { email },
      data: { storageUsedBytes: Number(bytes) },
    });
  } else if (command === 'cleanup') {
    const [emailContains] = args;
    if (emailContains === undefined || emailContains.length < 4) {
      throw new Error('usage: e2e-db.mjs cleanup <email-substring> (>= 4 chars)');
    }
    // Каскад из schema.prisma убирает files/conversions/refresh_tokens вместе
    // со строкой users.
    const { count } = await prisma.user.deleteMany({
      where: { email: { contains: emailContains } },
    });
    console.log(`removed ${count} user(s)`);
  } else {
    throw new Error(`unknown command: ${command ?? '(none)'}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
