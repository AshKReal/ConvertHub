import { PrismaClient } from '@prisma/client';

/**
 * Спека 015 (частично). `DATABASE_URL` уже подменён `test/setup-e2e.ts` до
 * того, как этот модуль впервые импортируется — обычный `PrismaClient()`
 * без явного `datasourceUrl` уже указывает на `convert_hub_test`.
 */
export const testPrisma = new PrismaClient();

/**
 * Очистка между e2e-тестами — не глобальный rollback транзакций (лишняя
 * сложность для первого прохода без единого существующего теста), а явное
 * удаление того, что создал сам тест — тот же приём, которым весь сеанс
 * 008/009 проверялось вручную (docker exec psql). Идемпотентно — email,
 * которого не было, не считается ошибкой вызывающего теста.
 */
export async function cleanupUser(email: string): Promise<void> {
  await testPrisma.user.deleteMany({ where: { email } });
}
