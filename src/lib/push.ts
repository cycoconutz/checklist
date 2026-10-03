import webpush from 'web-push'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db, tables } from '@/db'
import type { ActivityKind, Priority } from '@/db/schema'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT

export function pushIsConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY && SUBJECT)
}

function configure(): void {
  if (!pushIsConfigured()) {
    throw new Error('VAPID keys are not configured')
  }
  webpush.setVapidDetails(SUBJECT!, PUBLIC_KEY!, PRIVATE_KEY!)
}

type NotifyInput = {
  listId: string
  actorId: string
  actorName: string
  listName: string
  kind: ActivityKind
  taskId?: string
  taskTitle: string
  priority?: Priority
  dueDate?: string | null
}

const HEADLINE: Record<ActivityKind, string> = {
  created: 'added a task',
  updated: 'updated a task',
  completed: 'completed a task',
  reopened: 'reopened a task',
  deleted: 'deleted a task',
}

/**
 * Fans a single task mutation out to every other collaborator's subscribed devices.
 *
 * Two deliberate rules:
 *  1. The actor is always excluded. You do not need to be told what you just did.
 *  2. Recipients are filtered by their per-list event toggles, so a member who
 *     muted deletions never gets one.
 *
 * Deliberately fire-and-forget with a full catch: a push service outage must never
 * fail the task mutation that triggered it. Push is a convenience, the write is
 * the source of truth.
 */
export async function notifyList(input: NotifyInput): Promise<void> {
  if (!pushIsConfigured()) return

  try {
    const flagColumn = {
      created: tables.listMembers.notifyOnCreate,
      updated: tables.listMembers.notifyOnUpdate,
      completed: tables.listMembers.notifyOnUpdate,
      reopened: tables.listMembers.notifyOnUpdate,
      deleted: tables.listMembers.notifyOnDelete,
    }[input.kind]

    const recipients = await db
      .select({ userId: tables.listMembers.userId })
      .from(tables.listMembers)
      .where(
        and(
          eq(tables.listMembers.listId, input.listId),
          ne(tables.listMembers.userId, input.actorId),
          eq(flagColumn, true),
        ),
      )

    if (recipients.length === 0) return

    const subs = await db
      .select({
        id: tables.pushSubscriptions.id,
        endpoint: tables.pushSubscriptions.endpoint,
        p256dh: tables.pushSubscriptions.p256dh,
        auth: tables.pushSubscriptions.auth,
      })
      .from(tables.pushSubscriptions)
      .where(
        inArray(
          tables.pushSubscriptions.userId,
          recipients.map((r) => r.userId),
        ),
      )

    if (subs.length === 0) return

    configure()

    // Only the title travels in the payload. Descriptions stay on the server.
    const payload = JSON.stringify({
      title: input.actorName,
      body:
        input.kind === 'deleted'
          ? `${input.taskTitle} (${input.listName})`
          : `${HEADLINE[input.kind]}: ${input.taskTitle}`,
      tag: `${input.listId}:${input.taskId ?? 'none'}`,
      listId: input.listId,
      listName: input.listName,
      taskId: input.taskId,
      kind: input.kind,
      priority: input.priority,
      url: `/list/${input.listId}`,
    })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 },
        ),
      ),
    )

    await pruneDeadSubscriptions(results, subs)
  } catch (err) {
    console.error('[push] notifyList failed:', err)
  }
}

/**
 * A 404 or 410 means the push service has permanently dropped that endpoint.
 * Re-sending to it forever is pointless, so the row goes.
 */
async function pruneDeadSubscriptions(
  results: PromiseSettledResult<unknown>[],
  subs: { id: string }[],
): Promise<void> {
  const dead = results
    .map((r, i) => ({ r, sub: subs[i] }))
    .filter(({ r }) => r.status === 'rejected' && isGone((r as PromiseRejectedResult).reason))
    .map(({ sub }) => sub.id)

  if (dead.length === 0) return

  try {
    await db.delete(tables.pushSubscriptions).where(inArray(tables.pushSubscriptions.id, dead))
    console.log(`[push] pruned ${dead.length} dead subscription(s)`)
  } catch (err) {
    console.error('[push] prune failed:', err)
  }
}

function isGone(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode
  return status === 404 || status === 410
}

/** Sends a single push to one user's devices, used by the "test" button. */
export async function notifyUser(userId: string, title: string, body: string, url: string) {
  if (!pushIsConfigured()) throw new Error('VAPID keys are not configured')

  const subs = await db
    .select()
    .from(tables.pushSubscriptions)
    .where(eq(tables.pushSubscriptions.userId, userId))

  if (subs.length === 0) return { sent: 0, devices: 0 }

  configure()

  const payload = JSON.stringify({ title, body, tag: 'test', url })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 },
      ),
    ),
  )

  await pruneDeadSubscriptions(results, subs)

  return { sent: results.filter((r) => r.status === 'fulfilled').length, devices: subs.length }
}