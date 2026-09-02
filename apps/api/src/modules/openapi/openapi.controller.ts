import { Controller, Get, Header } from '@nestjs/common';
import { getOpenApiDocument } from './openapi.document';

/**
 * Спека 013. `GET /v1/openapi.json` — публичный, без guard: описание API не
 * требует аккаунта. Возвращает закешированный документ (`openapi.document.ts`).
 */
@Controller()
export class OpenapiController {
  @Get('v1/openapi.json')
  @Header('Cache-Control', 'public, max-age=300')
  document(): Promise<unknown> {
    return getOpenApiDocument();
  }
}
