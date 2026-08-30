import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Классический паттерн Nest+Prisma: жизненный цикл подключения привязан к
 * жизненному циклу модуля, не к первому запросу. Driver adapters
 * (`@prisma/adapter-pg`) не нужны — простое подключение к Postgres без
 * edge-рантайма (спека 003, «Отвергнутые варианты»).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
