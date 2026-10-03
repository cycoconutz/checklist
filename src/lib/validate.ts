/**
 * Postgres raises 22P02 on a malformed uuid cast, which would surface as a 500
 * and confirm nothing useful to an attacker. Every id from a URL or form is
 * checked first so bad input becomes a clean 404 instead.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}