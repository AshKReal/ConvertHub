import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * `@Global()` — как `PrismaModule`: инфраструктура, нужная любому модулю,
 * не заводится заново под правило «модуль только под свой маршрут/сущность»
 * (`.claude/rules/backend.md`) — тот же прецедент, что и у Prisma. `useExisting`,
 * не `useClass`: глобальный фильтр и инжектируемый в `MulterExceptionFilter`
 * экземпляр — один и тот же объект, не два независимых.
 */
@Global()
@Module({
  providers: [
    AllExceptionsFilter,
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
  ],
  exports: [AllExceptionsFilter],
})
export class ExceptionsModule {}
