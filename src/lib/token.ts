import { createHash, randomBytes } from 'node:crypto'

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const SESSION_COOKIE = 'checklist_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365