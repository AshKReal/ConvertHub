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
import { RequestIdentityService } from '../../common/auth/request-identity.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FilesService } from './files.service';

/**
 * Без логики и без Prisma напрямую (ARCHITECTURE.md §4.1) — вся работа с
 * БД и `Storage` — в `FilesService`.
 *
 * Спека 012. `GET`-маршруты принимают и сессию, и API-ключ
 * (`RequestIdentityService`): `PATCH` — веб-действие, остаётся под `JwtGuard`
 * (`TECH-SPEC.md` §8.1). Плохой/отозванный ключ на любом из них →
 * `INVALID_API_KEY` (кидает `resolve`).
 */
@Controller('v1/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly requestIdentity: RequestIdentityService,
  ) {}

  /** Спека 010/012. Список — только «мои файлы»; гостю показывать нечего → `UNAUTHENTICATED`. */
  @Get()
  async list(
    @Req() req: Request,
    @Query(new ZodValidationPipe(listFilesQuerySchema)) query: ListFilesQuery,
  ): Promise<ListFilesResponse> {
    const identity = await this.requestIdentity.resolve(
      req.headers.authorization,
    );
    if (identity.kind === 'guest') {
      throw new AppException('UNAUTHENTICATED');
    }
    return this.filesService.listFiles(
      identity.userId,
      query.cursor,
      query.limit,
    );
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Гостевой маршрут — сессия/ключ опциональны, гость получает `null`
    // (владение проверит `FilesService`); только плохой ключ — явный отказ.
    const identity = await this.requestIdentity.resolve(
      req.headers.authorization,
    );
    const userId = identity.kind === 'guest' ? null : identity.userId;
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
