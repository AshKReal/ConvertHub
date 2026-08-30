const BEARER_SCHEME = 'Bearer';

/** `Authorization: Bearer <token>` → `<token>`, иначе `undefined` — общий для `JwtGuard` и опционального пути в `conversion`/`files`. */
export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | undefined {
  if (authorizationHeader === undefined) {
    return undefined;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === BEARER_SCHEME && token ? token : undefined;
}
