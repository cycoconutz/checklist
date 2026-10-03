import { cache } from 'react'
import { cookies } from 'next/headers'
import { eq, and, gt } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db, tables } from '@/db'
import {
  generateSessionToken,
  hashToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/token'

/**
 * Resolves the current user from the session cookie, or null when signed out.
 *
 * `cache` dedupes this within a single render pass so a page that checks the
 * user in a layout and again in a page only hits the database once.
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const [row] = await db
    .select({
      id: tables.users.id,
      displayName: tables.users.displayName,
      avatarColor: tables.users.avatarColor,
    })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.users.id, tables.sessions.userId))
    .where(
      and(
        eq(tables.sessions.tokenHash, hashToken(token)),
        gt(tables.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return row ?? null
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken()

  await db.insert(tables.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  })

  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  if (token) {
    await db.delete(tables.sessions).where(eq(tables.sessions.tokenHash, hashToken(token)))
  }

  store.delete(SESSION_COOKIE)
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/')
  return user
}