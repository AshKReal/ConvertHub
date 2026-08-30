import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * `@Global()` — единственный держатель соединения с БД в приложении,
 * импортируется один раз в `AppModule`; повторный импорт в каждом модуле,
 * которому нужна БД, добавлял бы ритуал без пользы.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
