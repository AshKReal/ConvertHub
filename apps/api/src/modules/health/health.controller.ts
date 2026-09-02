import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type Readiness } from './health.service';

/**
 * Спека 014. Вне `/v1`, без guard — сигналы для площадки развёртывания.
 * `/health` — живость (процесс отвечает), `/ready` — готовность (`503` при
 * недоступной базе).
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Readiness> {
    const result = await this.health.readiness();
    if (result.status === 'down') {
      res.status(503);
    }
    return result;
  }
}
