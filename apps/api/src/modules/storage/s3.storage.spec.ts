import { beforeEach, describe, expect, it, vi } from 'vitest';

const S3_CONFIG = {
  endpoint: 'http://minio:9000',
  publicEndpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'convert-hub',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  forcePathStyle: true,
};

const h = vi.hoisted(() => {
  class FakeCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    FakeCommand,
    send: vi.fn(),
    getSignedUrl: vi.fn(),
  };
});

vi.mock('../../config/env', () => ({
  env: { STORAGE_DRIVER: 's3' },
  s3Config: () => S3_CONFIG,
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = h.send;
  },
  PutObjectCommand: h.FakeCommand,
  GetObjectCommand: h.FakeCommand,
  DeleteObjectCommand: h.FakeCommand,
  ListObjectsV2Command: h.FakeCommand,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: h.getSignedUrl,
}));

import { S3Storage } from './s3.storage';

type FakeCommand = InstanceType<typeof h.FakeCommand>;

describe('S3Storage', () => {
  let storage: S3Storage;

  beforeEach(() => {
    h.send.mockReset();
    h.getSignedUrl.mockReset();
    storage = new S3Storage();
  });

  it('put sends PutObject with the bucket, key, body and ContentType', async () => {
    h.send.mockResolvedValue({});
    const body = Buffer.from('png-bytes');

    await storage.put('u1/abc.png', body, 'image/png');

    expect(h.send).toHaveBeenCalledTimes(1);
    const command = h.send.mock.calls[0]?.[0] as FakeCommand;
    expect(command.input).toEqual({
      Bucket: 'convert-hub',
      Key: 'u1/abc.png',
      Body: body,
      ContentType: 'image/png',
    });
  });

  it('getSignedUrl presigns a GetObject with attachment disposition and the TTL', async () => {
    h.getSignedUrl.mockResolvedValue('http://localhost:9000/signed');

    const url = await storage.getSignedUrl('u1/abc.png', 900);

    expect(url).toBe('http://localhost:9000/signed');
    const call = h.getSignedUrl.mock.calls[0];
    expect((call?.[1] as FakeCommand).input).toMatchObject({
      Bucket: 'convert-hub',
      Key: 'u1/abc.png',
      ResponseContentDisposition: 'attachment',
    });
    expect(call?.[2]).toEqual({ expiresIn: 900 });
  });

  it('delete sends DeleteObject for the key', async () => {
    h.send.mockResolvedValue({});

    await storage.delete('u1/abc.png');

    const command = h.send.mock.calls[0]?.[0] as FakeCommand;
    expect(command.input).toEqual({ Bucket: 'convert-hub', Key: 'u1/abc.png' });
  });

  it('list pages through ContinuationToken and yields every key', async () => {
    h.send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'u1/a.png' }, { Key: 'u1/b.png' }],
        IsTruncated: true,
        NextContinuationToken: 'page-2',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'u1/c.png' }],
        IsTruncated: false,
      });

    const keys: string[] = [];
    for await (const key of storage.list('u1/')) {
      keys.push(key);
    }

    expect(keys).toEqual(['u1/a.png', 'u1/b.png', 'u1/c.png']);
    expect(h.send).toHaveBeenCalledTimes(2);
    expect((h.send.mock.calls[1]?.[0] as FakeCommand).input).toMatchObject({
      Prefix: 'u1/',
      ContinuationToken: 'page-2',
    });
  });
});
