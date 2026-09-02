import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { ulid } from 'ulid';
import { env } from '../../config/env';

/** Служебные маршруты в поток запрос-логов не пишутся — иначе опрос площадки затопит лог. */
const IGNORED_PATHS = new Set(['/health', '/ready', '/metrics']);

/**
 * Спека 014. Опции `pino-http` для `nestjs-pino`. Один JSON-поток в stdout:
 * строка на каждый `/v1/*` (`req_id`, метод, путь, статус, длительность) +
 * `this.logger` во всех сервисах. `X-Request-Id` — сквозной: берётся из
 * заголовка запроса либо генерируется, и возвращается заголовком ответа.
 * В лог не попадают заголовки, IP, тела (`critical-zones.md`).
 */
export function buildLoggerParams(): Params {
  const pretty = env.NODE_ENV !== 'production';

  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage, res: ServerResponse): string => {
        const header = req.headers['x-request-id'];
        const id =
          typeof header === 'string' && header.length > 0
            ? header
            : `req_${ulid()}`;
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customProps: (req: IncomingMessage) => ({ req_id: req.id }),
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          IGNORED_PATHS.has((req.url ?? '').split('?')[0] ?? ''),
      },
      // Без `headers`/`remoteAddress`/`remotePort` — там `Authorization`,
      // `Cookie`, полный IP.
      serializers: {
        req: (req: IncomingMessage) => ({ method: req.method, url: req.url }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
      // Страховка, если что-то залогируют вручную с объектом запроса/тела.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["idempotency-key"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
        ],
        censor: '[redacted]',
      },
      ...(pretty
        ? {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
            },
          }
        : {}),
    },
  };
}
