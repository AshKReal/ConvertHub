import { readFile } from 'node:fs/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { ulid } from 'ulid';
import { AVATAR_DIMENSION } from '@convert-hub/shared';

import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
// Валидаторы взяты из `modules/conversion`, а не скопированы: правило «тип
// файла определяется по сигнатуре» должно иметь ОДНУ реализацию, иначе второй
// путь загрузки рано или поздно разойдётся с первым. Переносить их в
// `common/` было бы чище по границам модулей, но это правка внутри 🔒-зоны
// конверсии ради чужой фичи — отдельным изменением, если владелец захочет.
import { detectFileType } from '../conversion/validators/magic-bytes.validator';
import { assertWithinPixelLimit } from '../conversion/validators/pixel-count.validator';
import { STORAGE, type Storage } from '../storage/storage.interface';

/** Что принимаем на вход. Выход всегда WebP — один формат, один mime, один путь кода. */
const ACCEPTED_INPUT_MIMES = new Set(['image/jpeg', 'image/png']);

const OUTPUT_MIME = 'image/webp';

/**
 * Спека 029. Загрузка и удаление аватара.
 *
 * Отдельный сервис, а не метод `AccountService`: тот про пароли, сессии и
 * удаление аккаунта, а здесь разбор недоверенного файла — своя ответственность
 * и свой набор отказов.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /**
   * Возвращает новый ключ. Порядок шагов не косметика:
   *
   * 1. Тип по сигнатуре, не по `Content-Type` и не по расширению
   *    (`critical-zones.md`): и то и другое пишет тот, кто прислал файл.
   * 2. Разрешение из заголовка — до декодирования пикселей, иначе
   *    decompression bomb разворачивается в память раньше проверки.
   * 3. Только потом `sharp` реально читает изображение.
   *
   * Старый объект удаляется ПОСЛЕ успешной записи нового и коммита: наоборот
   * означало бы, что упавшая запись оставляет пользователя вообще без аватара.
   */
  async replace(userId: string, uploadPath: string): Promise<string> {
    const detected = await detectFileType(uploadPath);
    if (detected === undefined || !ACCEPTED_INPUT_MIMES.has(detected.mime)) {
      throw new AppException('UNSUPPORTED_FILE_TYPE');
    }

    await assertWithinPixelLimit(uploadPath);

    const source = await readFile(uploadPath);
    let body: Buffer;
    try {
      body = await sharp(source)
        .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, { fit: 'cover' })
        .webp()
        .toBuffer();
    } catch (error) {
      // Сигнатура и заголовок уже прошли, а декодирование упало — файл битый
      // внутри. Конкретный код, не общий отказ (`critical-zones.md`: «каждый
      // catch вокруг парсера различает причины»). Содержимое файла в лог не
      // идёт, только факт и владелец.
      this.logger.warn(
        `Не удалось декодировать аватар пользователя ${userId}`,
        error,
      );
      throw new AppException('FILE_CORRUPTED');
    }

    // Ключ генерирует система, имя от клиента не участвует (🔒). Новый ULID на
    // каждую замену — старый URL не залипает в кеше браузера.
    const key = `${userId}/avatar/${ulid()}.webp`;
    await this.storage.put(key, body, OUTPUT_MIME);

    const previousKey = await this.swapKey(userId, key);
    if (previousKey !== null) {
      await this.deleteQuietly(previousKey);
    }

    return key;
  }

  /** Идемпотентно: аватара не было — не ошибка вызывающего, как `logout`. */
  async remove(userId: string): Promise<void> {
    const previousKey = await this.swapKey(userId, null);
    if (previousKey !== null) {
      await this.deleteQuietly(previousKey);
    }
  }

  /** Записывает новый ключ и возвращает прежний — одним запросом, без гонки read-then-write. */
  private async swapKey(
    userId: string,
    key: string | null,
  ): Promise<string | null> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key },
    });
    return previous.avatarKey;
  }

  /**
   * Осиротевший объект в хранилище — деньги и мусор, но не поломка: новый
   * аватар уже записан и виден. Роняя здесь запрос, мы бы отняли у
   * пользователя успешный результат ради нашей же уборки.
   */
  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(`Не удалось удалить прежний аватар ${key}`, error);
    }
  }
}
