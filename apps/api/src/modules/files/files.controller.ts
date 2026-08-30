import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FilesService } from './files.service';

/**
 * Без логики и без Prisma напрямую (ARCHITECTURE.md §4.1) — вся работа с
 * БД и `Storage` — в `FilesService`.
 */
@Controller('v1/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    // TODO(007): реальный id из сессии/API-ключа вместо гостевого null
    const url = await this.filesService.getDownloadUrl(id, null);
    res.redirect(302, url);
  }
}
