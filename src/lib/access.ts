import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, tables } from '@/db'
import { getCurrentUser, type CurrentUser } from '@/lib/session'
import { isUuid } from '@/lib/validate'

/**
 * The single privacy boundary for this app.
 *
 * Every read and write of list-scoped data goes through here. A client-supplied
 * `listId` is never sufficient on its own: we resolve the session cookie to a
 * user, then require a row in `list_members` for that exact pair.
 *
 * A miss calls `notFound()` rather than `forbidden()` deliberately. Returning 403
 * would confirm that the list exists to someone who has no access to it; 404
 * leaks nothing.
 */
export const requireMember = cache(async (listId: string): Promise<Membership> => {
  if (!isUuid(listId)) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const [row] = await db
    .select({
      listId: tables.listMembers.listId,
      userId: tables.listMembers.userId,
      role: tables.listMembers.role,
      notifyOnCreate: tables.listMembers.notifyOnCreate,
      notifyOnUpdate: tables.listMembers.notifyOnUpdate,
      notifyOnDelete: tables.listMembers.notifyOnDelete,
      listName: tables.lists.name,
      ownerId: tables.lists.ownerId,
    })
    .from(tables.listMembers)
    .innerJoin(tables.lists, eq(tables.lists.id, tables.listMembers.listId))
    .where(and(eq(tables.listMembers.listId, listId), eq(tables.listMembers.userId, user.id)))
    .limit(1)

  if (!row) notFound()

  return {
    listId: row.listId,
    userId: row.userId,
    role: row.role,
    listName: row.listName,
    ownerId: row.ownerId,
    isOwner: row.ownerId === row.userId,
    notifyOnCreate: row.notifyOnCreate,
    notifyOnUpdate: row.notifyOnUpdate,
    notifyOnDelete: row.notifyOnDelete,
  }
})

export type Membership = {
  listId: string
  userId: string
  role: 'owner' | 'member'
  listName: string
  ownerId: string
  isOwner: boolean
  notifyOnCreate: boolean
  notifyOnUpdate: boolean
  notifyOnDelete: boolean
}

/**
 * Route-handler variant. Calls `notFound()` outside a render scope throws a
 * digest that Next converts to a 404 only for pages, so API routes get an
 * explicit boolean check instead.
 */
export async function findMembership(
  listId: string,
  user: CurrentUser,
): Promise<Membership | null> {
  if (!isUuid(listId)) return null

  const [row] = await db
    .select({
      listId: tables.listMembers.listId,
      userId: tables.listMembers.userId,
      role: tables.listMembers.role,
      notifyOnCreate: tables.listMembers.notifyOnCreate,
      notifyOnUpdate: tables.listMembers.notifyOnUpdate,
      notifyOnDelete: tables.listMembers.notifyOnDelete,
      listName: tables.lists.name,
      ownerId: tables.lists.ownerId,
    })
    .from(tables.listMembers)
    .innerJoin(tables.lists, eq(tables.lists.id, tables.listMembers.listId))
    .where(and(eq(tables.listMembers.listId, listId), eq(tables.listMembers.userId, user.id)))
    .limit(1)

  if (!row) return null

  return {
    listId: row.listId,
    userId: row.userId,
    role: row.role,
    listName: row.listName,
    ownerId: row.ownerId,
    isOwner: row.ownerId === row.userId,
    notifyOnCreate: row.notifyOnCreate,
    notifyOnUpdate: row.notifyOnUpdate,
    notifyOnDelete: row.notifyOnDelete,
  }
}