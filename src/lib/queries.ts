import { desc, eq, sql, count, and } from 'drizzle-orm'
import { db, tables } from '@/db'

/** Lists the signed-in user collaborates on, with live counts for each. */
export async function myLists(userId: string) {
  return db
    .select({
      id: tables.lists.id,
      name: tables.lists.name,
      role: tables.listMembers.role,
      openTasks: sql<number>`(
        select count(*) from ${tables.tasks}
        where ${tables.tasks.listId} = ${tables.lists.id}
          and ${tables.tasks.completed} = false
      )`,
      totalTasks: sql<number>`(
        select count(*) from ${tables.tasks}
        where ${tables.tasks.listId} = ${tables.lists.id}
      )`,
      memberCount: sql<number>`(
        select count(*) from ${tables.listMembers}
        where ${tables.listMembers.listId} = ${tables.lists.id}
      )`,
    })
    .from(tables.listMembers)
    .innerJoin(tables.lists, eq(tables.lists.id, tables.listMembers.listId))
    .where(eq(tables.listMembers.userId, userId))
    .orderBy(desc(tables.lists.createdAt))
}

/** Collaborators on a list. Callers must have already run the membership guard. */
export async function listMembers(listId: string) {
  return db
    .select({
      userId: tables.listMembers.userId,
      displayName: tables.users.displayName,
      avatarColor: tables.users.avatarColor,
      role: tables.listMembers.role,
      joinedAt: tables.listMembers.joinedAt,
      notifyOnCreate: tables.listMembers.notifyOnCreate,
      notifyOnUpdate: tables.listMembers.notifyOnUpdate,
      notifyOnDelete: tables.listMembers.notifyOnDelete,
    })
    .from(tables.listMembers)
    .innerJoin(tables.users, eq(tables.users.id, tables.listMembers.userId))
    .where(eq(tables.listMembers.listId, listId))
    .orderBy(tables.listMembers.joinedAt)
}

/** The invite token. Only ever exposed to a verified member of the list. */
export async function inviteTokenFor(listId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: tables.lists.inviteToken })
    .from(tables.lists)
    .where(eq(tables.lists.id, listId))
    .limit(1)
  return row?.token ?? null
}

/** Devices on which this user has push enabled. */
export async function pushSubscriptionsFor(userId: string) {
  return db
    .select({
      id: tables.pushSubscriptions.id,
      userAgent: tables.pushSubscriptions.userAgent,
      createdAt: tables.pushSubscriptions.createdAt,
      lastUsedAt: tables.pushSubscriptions.lastUsedAt,
    })
    .from(tables.pushSubscriptions)
    .where(eq(tables.pushSubscriptions.userId, userId))
    .orderBy(desc(tables.pushSubscriptions.createdAt))
}

export async function taskCountsByMember(listId: string) {
  return db
    .select({
      assigneeId: tables.tasks.assigneeId,
      count: count(tables.tasks.id),
    })
    .from(tables.tasks)
    .where(and(eq(tables.tasks.listId, listId), eq(tables.tasks.completed, false)))
    .groupBy(tables.tasks.assigneeId)
}