import { Injectable, Logger } from '@nestjs/common';
import type { ConversionStatus } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordConversionInput {
  readonly userId: string | null;
  readonly target: string;
  readonly directionId: string | null;
  readonly status: ConversionStatus;
  readonly errorCode: string | null;
  readonly durationMs: number;
  readonly fileId: string | null;
}

/**
 * Не экспортируется модулем — вызывается только изнутри `conversion`
 * (`.claude/rules/backend.md`: сервис экспортируется, только если его зовёт
 * другой модуль). Собственные сбои глушит: аудит-лог не должен маскировать
 * реальный ответ клиенту (спека 003).
 */
@Injectable()
export class ConversionHistoryService {
  private readonly logger = new Logger(ConversionHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordConversion(input: RecordConversionInput): Promise<void> {
    try {
      await this.prisma.conversion.create({
        data: {
          id: ulid(),
          userId: input.userId,
          target: input.target,
          directionId: input.directionId,
          status: input.status,
          errorCode: input.errorCode,
          durationMs: input.durationMs,
          fileId: input.fileId,
        },
      });
    } catch (error) {
      this.logger.error('Не удалось записать историю конвертации', error);
    }
  }
}
