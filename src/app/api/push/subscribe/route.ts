import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '@/db'
import { getCurrentUser } from '@/lib/session'

/**
 * Push subscriptions are per user and per device, and outlive any single list:
 * the same phone should get notified about every list it belongs to.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseSubscription(body)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const existing = await db
    .select({ id: tables.pushSubscriptions.id })
    .from(tables.pushSubscriptions)
    .where(eq(tables.pushSubscriptions.endpoint, parsed.endpoint))
    .limit(1)

  if (existing.length > 0) {
    // The endpoint identifies the device, so a repeat call is an update. Keys
    // rotate on some browsers, so always refresh them. Reassign the owner too:
    // on a shared device the subscription must follow whoever is signed in,
    // never keep notifying the previous account.
    await db
      .update(tables.pushSubscriptions)
      .set({
        userId: user.id,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        userAgent: request.headers.get('user-agent'),
        lastUsedAt: new Date(),
      })
      .where(eq(tables.pushSubscriptions.endpoint, parsed.endpoint))
  } else {
    await db.insert(tables.pushSubscriptions).values({
      userId: user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent: request.headers.get('user-agent'),
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const endpoint =
    typeof body === 'object' && body !== null && 'endpoint' in body
      ? (body as { endpoint: unknown }).endpoint
      : null

  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Scoped to the caller so one user cannot delete another's subscription.
  await db
    .delete(tables.pushSubscriptions)
    .where(
      and(
        eq(tables.pushSubscriptions.endpoint, endpoint),
        eq(tables.pushSubscriptions.userId, user.id),
      ),
    )

  return NextResponse.json({ ok: true })
}

function parseSubscription(
  body: unknown,
): { endpoint: string; p256dh: string; auth: string } | null {
  if (typeof body !== 'object' || body === null) return null

  const sub = body as Record<string, unknown>
  const endpoint = sub.endpoint
  const keys = sub.keys

  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null
  if (typeof keys !== 'object' || keys === null) return null

  const p256dh = (keys as Record<string, unknown>).p256dh
  const auth = (keys as Record<string, unknown>).auth

  if (typeof p256dh !== 'string' || p256dh.length === 0) return null
  if (typeof auth !== 'string' || auth.length === 0) return null

  return { endpoint, p256dh, auth }
}