import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { extractBearerToken } from '../../common/guards/extract-bearer-token';
import { TokenService } from '../auth/token.service';
import { FilesService } from './files.service';

/**
 * Без логики и без Prisma напрямую (ARCHITECTURE.md §4.1) — вся работа с
 * БД и `Storage` — в `FilesService`.
 */
@Controller('v1/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly tokenService: TokenService,
  ) {}

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Гостевой маршрут — невалидный/просроченный токен тихо даёт `null`,
    // как и в `conversion.controller.ts` (спека 007).
    const userId =
      this.tokenService.verifyAccessToken(
        extractBearerToken(req.headers.authorization),
      )?.userId ?? null;
    const url = await this.filesService.getDownloadUrl(id, userId);
    res.redirect(302, url);
  }
}
