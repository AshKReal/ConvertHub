import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Header, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { extractBearerToken } from '../../common/guards/extract-bearer-token';
import { env } from '../../config/env';
import { MetricsService } from './metrics.service';

/**
 * Спека 014. `GET /metrics` за `METRICS_TOKEN` (`Authorization: Bearer`) —
 * открытый наружу раскрывает объёмы и кардинальность лейблов. Сравнение
 * токена постоянно по времени (`critical-zones.md`).
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!isAuthorized(authorization)) {
      throw new AppException('UNAUTHENTICATED');
    }
    await this.metrics.refreshDynamicGauges();
    res.type(this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}

function isAuthorized(authorization: string | undefined): boolean {
  const token = extractBearerToken(authorization);
  if (token === undefined) {
    return false;
  }
  const expected = Buffer.from(env.METRICS_TOKEN);
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
