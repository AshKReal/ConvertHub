import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ApiKeyListResponse, IssuedApiKey } from '@convert-hub/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiKeyService } from './api-keys.service';

/**
 * Спека 011. Управление ключами — только под сессией (`JwtGuard`), никогда по
 * самому ключу (`TECH-SPEC.md` §8.1). Без логики и Prisma (`ARCHITECTURE.md`
 * §4.1). `:id` без Zod-проверки намеренно — кривой id не отличается от
 * «не твой»/«нет такого», всё сводится в `API_KEY_NOT_FOUND` (см. спеку).
 */
@Controller('v1/api-keys')
@UseGuards(JwtGuard)
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  async list(@CurrentUser() userId: string): Promise<ApiKeyListResponse> {
    return { items: await this.apiKeys.list(userId) };
  }

  @Post()
  @HttpCode(200) // ресурс с собственным URL не создаётся — тело несёт секрет один раз
  issue(@CurrentUser() userId: string): Promise<IssuedApiKey> {
    return this.apiKeys.issue(userId);
  }

  @Post(':id/reissue')
  @HttpCode(200)
  reissue(
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ): Promise<IssuedApiKey> {
    return this.apiKeys.reissue(userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.apiKeys.revoke(userId, id);
  }
}
