import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  listFilesQuerySchema,
  updateFileRequestSchema,
  type ListFilesQuery,
  type ListFilesResponse,
  type UpdateFileRequest,
} from '@convert-hub/shared';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { extractBearerToken } from '../../common/guards/extract-bearer-token';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  /** Спека 010. Список — только «мои файлы», гостю показывать нечего (как и `/files` на фронте). */
  @Get()
  @UseGuards(JwtGuard)
  async list(
    @CurrentUser() userId: string,
    @Query(new ZodValidationPipe(listFilesQuerySchema)) query: ListFilesQuery,
  ): Promise<ListFilesResponse> {
    return this.filesService.listFiles(userId, query.cursor, query.limit);
  }

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

  /** Спека 010. Тумблер `save` на строке `/files` — см. `FilesService.updateSaveFlag` за семантикой. */
  @Patch(':id')
  @UseGuards(JwtGuard)
  @HttpCode(204)
  async update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFileRequestSchema))
    body: UpdateFileRequest,
  ): Promise<void> {
    await this.filesService.updateSaveFlag(id, userId, body.save);
  }
}
