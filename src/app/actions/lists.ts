'use server'

import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, tables } from '@/db'
import { createSession, destroySession, getCurrentUser } from '@/lib/session'
import { requireMember } from '@/lib/access'
import { pushIsConfigured } from '@/lib/push'
import { isUuid } from '@/lib/validate'

type ActionResult = { ok: true } | { ok: false; error: string }

const AVATAR_COLORS = [
  '#e11d48',
  '#db2777',
  '#9333ea',
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#ca8a04',
  '#ea580c',
]

function pickColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

function newInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Signs a brand new person in, creating the user first. */
async function signIn(displayName: string): Promise<string> {
  const [user] = await db
    .insert(tables.users)
    .values({ displayName, avatarColor: pickColor() })
    .returning({ id: tables.users.id })

  await createSession(user.id)
  return user.id
}

export async function createListAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 80)
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 40)

  if (!name) return { error: 'Give the list a name.' }
  if (!displayName) return { error: 'Enter your name so collaborators know who you are.' }

  const user = await getCurrentUser()
  const userId = user ? user.id : await signIn(displayName)

  const [list] = await db
    .insert(tables.lists)
    .values({ name, ownerId: userId, inviteToken: newInviteToken() })
    .returning({ id: tables.lists.id })

  await db.insert(tables.listMembers).values({
    listId: list.id,
    userId,
    role: 'owner',
  })

  redirect(`/list/${list.id}`)
}

export async function joinListAction(
  token: string,
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 40)

  const [list] = await db
    .select({ id: tables.lists.id, name: tables.lists.name })
    .from(tables.lists)
    .where(eq(tables.lists.inviteToken, token))
    .limit(1)

  if (!list) return { error: 'That invite link is no longer valid.' }

  const user = await getCurrentUser()

  // A first-time joiner must supply a name before we create anything for them.
  if (!user && !displayName) return { error: 'Enter your name to join.' }

  const userId = user ? user.id : await signIn(displayName)

  // Idempotent: following the same link twice must not fail on the PK.
  await db
    .insert(tables.listMembers)
    .values({ listId: list.id, userId, role: 'member' })
    .onConflictDoNothing()

  redirect(`/list/${list.id}`)
}

export async function renameListAction(
  listId: string,
  name: string,
): Promise<ActionResult> {
  if (!isUuid(listId)) return { ok: false, error: 'Invalid list.' }
  await requireMember(listId)

  const clean = name.trim().slice(0, 80)
  if (!clean) return { ok: false, error: 'A list needs a name.' }

  await db.update(tables.lists).set({ name: clean }).where(eq(tables.lists.id, listId))
  revalidatePath(`/list/${listId}`)
  revalidatePath(`/list/${listId}/settings`)
  return { ok: true }
}

/** Rotating the token instantly revokes every outstanding invite link. */
export async function regenerateInviteAction(listId: string): Promise<ActionResult> {
  if (!isUuid(listId)) return { ok: false, error: 'Invalid list.' }
  const member = await requireMember(listId)

  if (!member.isOwner) return { ok: false, error: 'Only the owner can do that.' }

  await db
    .update(tables.lists)
    .set({ inviteToken: newInviteToken() })
    .where(eq(tables.lists.id, listId))

  revalidatePath(`/list/${listId}/settings`)
  return { ok: true }
}

export async function removeMemberAction(
  listId: string,
  targetUserId: string,
): Promise<ActionResult> {
  if (!isUuid(listId) || !isUuid(targetUserId)) return { ok: false, error: 'Invalid request.' }
  const member = await requireMember(listId)

  // The owner can remove anyone. A member can only remove themselves.
  if (!member.isOwner && targetUserId !== member.userId) {
    return { ok: false, error: 'Only the owner can remove other people.' }
  }

  // Access is derived from the membership row, so deleting the owner's row would
  // lock the owner out of their own list with no way to restore membership.
  if (member.ownerId === targetUserId) {
    return { ok: false, error: 'The owner has to stay on the list.' }
  }

  await db
    .delete(tables.listMembers)
    .where(and(eq(tables.listMembers.listId, listId), eq(tables.listMembers.userId, targetUserId)))

  revalidatePath(`/list/${listId}/settings`)
  return { ok: true }
}

export async function updateNotifyPrefsAction(
  listId: string,
  prefs: { create?: boolean; update?: boolean; delete?: boolean },
): Promise<ActionResult> {
  if (!isUuid(listId)) return { ok: false, error: 'Invalid list.' }
  const member = await requireMember(listId)

  const patch: Partial<typeof tables.listMembers.$inferInsert> = {}
  if (typeof prefs.create === 'boolean') patch.notifyOnCreate = prefs.create
  if (typeof prefs.update === 'boolean') patch.notifyOnUpdate = prefs.update
  if (typeof prefs.delete === 'boolean') patch.notifyOnDelete = prefs.delete

  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to change.' }

  await db
    .update(tables.listMembers)
    .set(patch)
    .where(
      and(
        eq(tables.listMembers.listId, member.listId),
        eq(tables.listMembers.userId, member.userId),
      ),
    )

  revalidatePath(`/list/${listId}/settings`)
  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  await destroySession()
  redirect('/')
}

export async function getPushConfigured(): Promise<boolean> {
  return pushIsConfigured()
}