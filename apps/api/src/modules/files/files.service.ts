import { Inject, Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import {
  GUEST_FILE_TTL_SECONDS,
  SIGNED_URL_TTL_SECONDS,
  UNSAVED_FILE_GRACE_SECONDS,
  USER_STORAGE_QUOTA_BYTES,
  type FileListItem,
  type ListFilesResponse,
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

/**
 * Спека 010. Дискриминантное объединение (`ARCHITECTURE.md`, тот же принцип,
 * что состояние зоны загрузки), не `SavedFile | null`: вызывающему
 * (`ConversionService`) нужно различать «не сохранили из-за квоты» (успешная
 * конвертация, предупреждение в заголовке) от «сохранить не удалось»
 * (тоже успешная конвертация клиенту, но без предупреждения — тот же
 * принцип, что и раньше: побочный сбой не должен становиться 500).
 */
export type SaveConversionResultOutcome =
  | { readonly status: 'saved'; readonly fileId: string }
  | { readonly status: 'skipped-quota' }
  | { readonly status: 'failed' };

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
   * (TECH-SPEC.md §11), квота его не касается — `storageUsedBytes` считается
   * только для вошедших (спека 010).
   */
  async saveConversionResult(
    input: SaveConversionResultInput,
  ): Promise<SaveConversionResultOutcome> {
    if (input.userId !== null) {
      // Пред-чтение вне транзакции — тот же класс гонки, что уже принят у
      // in-memory rate/concurrency лимитеров (specs/010-user-files-quota.md,
      // «Риски»): переполнение на волосок при параллельных конвертациях
      // одного пользователя теоретически возможно, не 🔒-инвариант.
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { storageUsedBytes: true },
      });
      const currentUsage = user?.storageUsedBytes ?? 0;
      if (currentUsage + input.buffer.byteLength > USER_STORAGE_QUOTA_BYTES) {
        return { status: 'skipped-quota' };
      }
    }

    const storageKey = `${input.userId ?? 'guest'}/${ulid()}.${input.extension}`;
    const expiresAt =
      input.userId === null
        ? new Date(Date.now() + GUEST_FILE_TTL_SECONDS * 1000)
        : null;

    try {
      await this.storage.put(storageKey, input.buffer, input.mime);
    } catch (error) {
      this.logger.error(`Storage.put не удался для ${storageKey}`, error);
      return { status: 'failed' };
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
      return { status: 'saved', fileId };
    } catch (error) {
      this.logger.error(
        `Транзакция сохранения не удалась для ${storageKey}`,
        error,
      );
      // Best-effort уборка осиротевшего объекта — не замена ночной сверки
      // (вне зоны 003), одна попытка без гарантии.
      await this.storage.delete(storageKey).catch(() => undefined);
      return { status: 'failed' };
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

  /**
   * Спека 010. Курсор — `id` (ULID, лексикографически сортируемый по времени
   * создания) — вставки между запросами не сдвигают уже выданные страницы.
   * Истёкшие файлы (гостевые, разово гостю не актуально — этот маршрут
   * только для вошедших, но и «мягко снятые» с `save`) не возвращаются: у
   * пользователя они больше не «мои файлы» с его точки зрения.
   */
  async listFiles(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<ListFilesResponse> {
    const now = new Date();
    const rows = await this.prisma.file.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: FileListItem[] = page.map((file) => ({
      id: file.id,
      originalFilename: file.originalFilename,
      sizeBytes: file.sizeBytes,
      extension: file.extension,
      createdAt: file.createdAt.toISOString(),
      saved: file.expiresAt === null,
    }));

    return {
      items,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Тумблер `save` на уже существующем файле (спека 010). `save=false` —
   * мягкое истечение (решение владельца): `expiresAt` уходит в будущее тем
   * же полем, что у гостевых файлов, квота освобождается немедленно, не по
   * факту физического стирания. Обратимо повторным `save=true` до
   * истечения — `expiresAt` просто чистится обратно в `null`, с новой
   * проверкой квоты (могла заполниться за это время другими файлами).
   *
   * Истёкший, чужой и несуществующий файл дают один и тот же `FILE_NOT_FOUND`
   * — тот же принцип, что `getDownloadUrl`.
   */
  async updateSaveFlag(
    id: string,
    requesterId: string,
    save: boolean,
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    const now = new Date();
    const expired =
      file !== null &&
      file.expiresAt !== null &&
      file.expiresAt.getTime() < now.getTime();

    if (file === null || expired || file.userId !== requesterId) {
      throw new AppException('FILE_NOT_FOUND');
    }

    const alreadyInTargetState = save === (file.expiresAt === null);
    if (alreadyInTargetState) {
      return;
    }

    if (save) {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: requesterId },
          select: { storageUsedBytes: true },
        });
        if (user.storageUsedBytes + file.sizeBytes > USER_STORAGE_QUOTA_BYTES) {
          throw new AppException('STORAGE_QUOTA_EXCEEDED');
        }
        await tx.file.update({ where: { id }, data: { expiresAt: null } });
        await tx.user.update({
          where: { id: requesterId },
          data: { storageUsedBytes: { increment: file.sizeBytes } },
        });
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.file.update({
        where: { id },
        data: {
          expiresAt: new Date(
            now.getTime() + UNSAVED_FILE_GRACE_SECONDS * 1000,
          ),
        },
      }),
      this.prisma.user.update({
        where: { id: requesterId },
        data: { storageUsedBytes: { decrement: file.sizeBytes } },
      }),
    ]);
  }
}
