import { Module } from '@nestjs/common';
import { OpenapiController } from './openapi.controller';

/**
 * Спека 013. Свой маршрут (`GET /v1/openapi.json`) — условие `backend.md`
 * для модуля выполнено. Провайдеров нет: документ строит чистая функция
 * `getOpenApiDocument()`, БД/Redis не нужны.
 */
@Module({
  controllers: [OpenapiController],
})
export class OpenapiModule {}
