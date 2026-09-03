import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { env, s3Config } from '../../config/env';
import type { Storage } from './storage.interface';

/**
 * Спека 016. Вторая реализация `Storage` (первая — `LocalDiskStorage`, 003)
 * — S3-совместимое объектное хранилище: MinIO локально, Cloudflare R2 в
 * проде (TECH-SPEC.md §3.1). Сигнатура интерфейса не менялась — это и есть
 * проверка, что абстракция не протекла (`storage.interface.ts`).
 *
 * `getSignedUrl` подписывает ссылку `S3_SECRET_ACCESS_KEY` (SigV4), браузер
 * клиента качает по ней напрямую у хранилища, минуя приложение
 * (`ARCHITECTURE.md` §2, граница 3). Подпись — от `publicEndpoint`: из
 * compose приложение видит MinIO как `minio:9000`, а клиент — как
 * `localhost:9000`, ссылка с внутренним хостом из браузера не открылась бы.
 */
@Injectable()
export class S3Storage implements Storage {
  private readonly config = s3Config();
  private readonly client: S3Client;
  private readonly presignClient: S3Client;

  constructor() {
    const credentials = {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    };
    const shared = {
      region: this.config.region,
      credentials,
      forcePathStyle: this.config.forcePathStyle,
    };
    this.client = new S3Client({ ...shared, endpoint: this.config.endpoint });
    this.presignClient = new S3Client({
      ...shared,
      endpoint: this.config.publicEndpoint,
    });
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );
  }

  getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  async *list(prefix: string): AsyncIterable<string> {
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key !== undefined) {
          yield object.Key;
        }
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken !== undefined);
  }
}

/** `STORAGE_DRIVER=s3` → `S3Storage`, иначе `LocalDiskStorage` (`storage.module.ts`). */
export const isS3Driver = (): boolean => env.STORAGE_DRIVER === 's3';
