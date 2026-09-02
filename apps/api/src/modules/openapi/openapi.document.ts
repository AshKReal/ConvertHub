/**
 * Спека 013. Документ OpenAPI 3.1, собранный из тех же Zod-схем
 * `packages/shared`, что валидируют запросы.
 *
 * Динамический `import()` для `zod`, `@convert-hub/shared` и
 * `@asteasolutions/zod-to-openapi` — не статический: `packages/shared` —
 * ESM (`"type": "module"`), `apps/api` (nest) — CJS. Статический
 * `import { z } from 'zod'` в CJS-контексте даёт CJS-инстанс `zod`, а схемы
 * из `shared` собраны ESM-инстансом — разные классы `ZodType`, генератор их
 * не распознаёт и `.openapi()` на них нет. `import()` резолвит все три через
 * `exports.import` → один ESM-инстанс `zod`, всё сходится.
 *
 * Собирается один раз при первом запросе, дальше — из кеша.
 */

type ZodToOpenApi = typeof import('@asteasolutions/zod-to-openapi');
type OpenApiDoc = ReturnType<
  InstanceType<ZodToOpenApi['OpenApiGeneratorV31']>['generateDocument']
>;

let cached: Promise<OpenApiDoc> | null = null;

export function getOpenApiDocument(): Promise<OpenApiDoc> {
  cached ??= buildDocument();
  return cached;
}

async function buildDocument(): Promise<OpenApiDoc> {
  const [zto, zodModule, shared] = await Promise.all([
    import('@asteasolutions/zod-to-openapi'),
    import('zod'),
    import('@convert-hub/shared'),
  ]);
  const { z } = zodModule;
  const { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } = zto;

  extendZodWithOpenApi(z);
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description:
      'API-ключ вида `ch_live_…`, выпущенный в веб-интерфейсе (`/api-keys`). Тот же заголовок принимает JWT сессии, но публичный API рассчитан на ключ.',
  });

  const errorCodes = Object.keys(shared.ERROR_CODES);
  const problemSchema = registry.register(
    'Problem',
    z
      .object({
        type: z.string().openapi({
          example: 'https://api.convert-hub.io/errors/file-too-large',
        }),
        title: z.string().openapi({ example: 'File too large' }),
        status: z.number().int().openapi({ example: 413 }),
        code: z.enum(errorCodes as [string, ...string[]]).openapi({
          description:
            'Машиночитаемый код ошибки (`packages/shared` `ERROR_CODES`).',
        }),
        detail: z.string().openapi({
          example:
            'Uploaded file is 14680064 bytes, maximum allowed is 10485760',
        }),
        instance: z.string().openapi({ example: '/v1/convert' }),
        request_id: z.string().openapi({ example: 'req_01J8XKQ2M9' }),
        meta: z
          .record(z.union([z.string(), z.number()]))
          .optional()
          .openapi({ description: 'Числа/строки, поясняющие ошибку.' }),
      })
      .openapi({ description: 'Ошибка API в формате RFC 9457.' }),
  );

  const bearer = [{ bearerAuth: [] as string[] }];
  const problem = (description: string) => ({
    description,
    content: { 'application/problem+json': { schema: problemSchema } },
  });
  const binary = z.string().openapi({ type: 'string', format: 'binary' });

  registry.registerPath({
    method: 'post',
    path: '/v1/convert',
    operationId: 'convertFile',
    summary: 'Convert a file',
    description:
      'Multipart-загрузка. Исходный формат определяется по содержимому (magic bytes), целевой — явно в поле `target`. Тело успешного ответа — байты результата.',
    security: bearer,
    request: {
      headers: z.object({
        'Idempotency-Key': shared.idempotencyKeySchema.optional().openapi({
          param: { name: 'Idempotency-Key', in: 'header' },
          description:
            'UUID. Повтор с тем же ключом в течение 24 часов возвращает сохранённый результат без повторной конвертации.',
        }),
      }),
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: shared.convertRequestSchema.extend({
              file: binary.openapi({
                type: 'string',
                format: 'binary',
                description: `Файл для конвертации, до ${shared.MAX_FILE_SIZE_BYTES} байт.`,
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description:
          'Байты результата. Заголовки: `X-File-Id` (если сохранён), `X-Save-Skipped-Reason`, `X-Idempotent-Replay`, `X-RateLimit-*`.',
        content: { 'application/octet-stream': { schema: binary } },
      },
      401: problem('`INVALID_API_KEY` — ключ отозван или не существует.'),
      409: problem(
        '`IDEMPOTENCY_KEY_CONFLICT` — запрос с этим ключом ещё выполняется.',
      ),
      413: problem('`FILE_TOO_LARGE`.'),
      415: problem('`UNSUPPORTED_FILE_TYPE` / `FILE_TYPE_MISMATCH`.'),
      422: problem(
        '`IMAGE_TOO_LARGE` / `TOO_MANY_PAGES` / `FILE_CORRUPTED` / `INVALID_PARAMETER`.',
      ),
      429: problem(
        '`RATE_LIMIT_EXCEEDED`. Ответ несёт `Retry-After` и `X-RateLimit-*`.',
      ),
      500: problem('`CONVERSION_FAILED` / `INTERNAL_ERROR`.'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/v1/files',
    operationId: 'listFiles',
    summary: 'List your files',
    description:
      'Курсорная пагинация по `id` (ULID). Требует ключ или сессию — у гостя файлов нет.',
    security: bearer,
    request: { query: shared.listFilesQuerySchema },
    responses: {
      200: {
        description: 'Страница файлов.',
        content: {
          'application/json': { schema: shared.listFilesResponseSchema },
        },
      },
      401: problem('`UNAUTHENTICATED`.'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/v1/files/{id}/download',
    operationId: 'downloadFile',
    summary: 'Download a file',
    description:
      '`302` на подписанную ссылку (TTL 15 минут). Ключ/сессия необязательны для гостевого файла; неверный ключ — отказ.',
    // Bearer необязателен (гостевой файл) — поэтому и `{}` в списке.
    security: [{ bearerAuth: [] as string[] }, {}],
    request: {
      params: z.object({
        id: z.string().openapi({
          param: { name: 'id', in: 'path' },
          example: 'file_01J8XKQ2M9',
        }),
      }),
    },
    responses: {
      302: {
        description:
          'Redirect: заголовок `Location` — подписанная ссылка на скачивание.',
      },
      401: problem('`INVALID_API_KEY`.'),
      404: problem('`FILE_NOT_FOUND` — не существует, чужой или истёк.'),
    },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'ConvertHub API',
      version: '1',
      description:
        'Публичный API конвертации файлов. API-ключ выпускается в веб-интерфейсе (`/api-keys`). Только HTTPS.',
      license: { name: 'UNLICENSED' },
    },
    servers: [{ url: 'https://api.convert-hub.io' }],
  });
}
