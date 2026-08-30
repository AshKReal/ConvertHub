import { Inject, Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import {
  GUEST_FILE_TTL_SECONDS,
  SIGNED_URL_TTL_SECONDS,
} from '@convert-hub/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE } from '../storage/storage.interface';
import type { Storage } from '../storage/storage.interface';

export interface SaveConversionResultInput {
  readonly userId: string | null;
  readonly buffer: Buffer;
  readonly mime: string;
  /** Расширение результата (`target` запроса) — часть storage key. */
  readonly extension: string;
  readonly originalFilename?: string;
}

export interface SavedFile {
  readonly fileId: string;
}

/**
 * Владеет и `files`-таблицей, и обращением к `Storage` для результатов
 * конвертации — `LocalDiskRawController` в `modules/storage` этого не
 * делает намеренно (остаётся БД-агностичным, спека 003).
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /**
   * Вызывается только при `save=true` (спека 003, решённое расхождение
   * ARCHITECTURE.md/TECH-SPEC.md — см. спеку). Гость получает TTL в час
   * (TECH-SPEC.md §11); для настоящего пользователя — бессрочно, квота
   * пока не проверяется (010). Собственные сбои глушит: упавший побочный
   * save не должен превращать успешный ответ клиенту в 500.
   */
  async saveConversionResult(
    input: SaveConversionResultInput,
  ): Promise<SavedFile | null> {
    const storageKey = `${input.userId ?? 'guest'}/${ulid()}.${input.extension}`;
    const expiresAt =
      input.userId === null
        ? new Date(Date.now() + GUEST_FILE_TTL_SECONDS * 1000)
        : null;

    try {
      await this.storage.put(storageKey, input.buffer, input.mime);
    } catch (error) {
      this.logger.error(`Storage.put не удался для ${storageKey}`, error);
      return null;
    }

    const fileId = ulid();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.file.create({
          data: {
            id: fileId,
            userId: input.userId,
            storageKey,
            sizeBytes: input.buffer.byteLength,
            mime: input.mime,
            extension: input.extension,
            originalFilename: input.originalFilename ?? null,
            expiresAt,
          },
        });
        if (input.userId !== null) {
          await tx.user.update({
            where: { id: input.userId },
            data: {
              storageUsedBytes: { increment: input.buffer.byteLength },
            },
          });
        }
      });
      return { fileId };
    } catch (error) {
      this.logger.error(
        `Транзакция сохранения не удалась для ${storageKey}`,
        error,
      );
      // Best-effort уборка осиротевшего объекта — не замена ночной сверки
      // (вне зоны 003), одна попытка без гарантии.
      await this.storage.delete(storageKey).catch(() => undefined);
      return null;
    }
  }

  /**
   * `requesterId` — задел под 007 (сейчас всегда `null`, как и `file.userId`
   * гостя, поэтому проверка ownership — не-операция уже сегодня, но написана
   * заранее, чтобы 007 не пришлось возвращаться в этот файл). Несуществующий
   * id, истёкший файл и чужой файл дают один и тот же `FILE_NOT_FOUND`.
   */
  async getDownloadUrl(
    id: string,
    requesterId: string | null,
  ): Promise<string> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    const expired =
      file !== null &&
      file.expiresAt !== null &&
      file.expiresAt.getTime() < Date.now();

    if (file === null || expired || file.userId !== requesterId) {
      throw new AppException('FILE_NOT_FOUND');
    }

    return this.storage.getSignedUrl(file.storageKey, SIGNED_URL_TTL_SECONDS);
  }
}
