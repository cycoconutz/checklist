'use server'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, tables } from '@/db'
import { requireMember } from '@/lib/access'
import { notifyList } from '@/lib/push'
import { isUuid } from '@/lib/validate'
import type { ActivityKind, Priority } from '@/db/schema'

type ActionResult = { ok: true } | { ok: false; error: string }

const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000

function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const title = raw.trim().slice(0, MAX_TITLE)
  return title.length > 0 ? title : null
}

function cleanDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const description = raw.trim().slice(0, MAX_DESCRIPTION)
  return description.length > 0 ? description : null
}

function cleanPriority(raw: unknown): Priority | null {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : null
}

function cleanDueDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  // Guard against arbitrary strings reaching a date column.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

export async function createTask(
  listId: string,
  input: {
    title: unknown
    description?: unknown
    priority?: unknown
    dueDate?: unknown
    assigneeId?: unknown
  },
): Promise<ActionResult> {
  const member = await requireMember(listId)

  const title = cleanTitle(input.title)
  if (!title) return { ok: false, error: 'A task needs a title.' }

  const assigneeId = await validateAssignee(listId, input.assigneeId)

  // New tasks land at the bottom in manual order rather than sharing position 0.
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${tables.tasks.position}), -1) + 1` })
    .from(tables.tasks)
    .where(eq(tables.tasks.listId, listId))

  const [task] = await db
    .insert(tables.tasks)
    .values({
      listId,
      title,
      description: cleanDescription(input.description),
      priority: cleanPriority(input.priority) ?? 'medium',
      dueDate: cleanDueDate(input.dueDate),
      assigneeId,
      position: next,
      createdBy: member.userId,
      updatedBy: member.userId,
    })
    .returning()

  await record(member.listId, task.id, member.userId, 'created', title)
  await notifyList({
    listId,
    actorId: member.userId,
    actorName: await displayNameOf(member.userId),
    listName: member.listName,
    kind: 'created',
    taskId: task.id,
    taskTitle: title,
    priority: task.priority,
  })

  revalidatePath(`/list/${listId}`)
  return { ok: true }
}

export async function updateTask(
  listId: string,
  taskId: string,
  input: {
    title?: unknown
    description?: unknown
    priority?: unknown
    dueDate?: unknown
    assigneeId?: unknown
  },
): Promise<ActionResult> {
  const member = await requireMember(listId)
  const existing = await loadTask(listId, taskId)
  if (!existing) return { ok: false, error: 'That task no longer exists.' }

  const patch: Partial<typeof tables.tasks.$inferInsert> = { updatedBy: member.userId }

  if (input.title !== undefined) {
    const title = cleanTitle(input.title)
    if (!title) return { ok: false, error: 'A task needs a title.' }
    patch.title = title
  }
  if (input.description !== undefined) patch.description = cleanDescription(input.description)
  if (input.priority !== undefined) {
    patch.priority = cleanPriority(input.priority) ?? existing.priority
  }
  if (input.dueDate !== undefined) patch.dueDate = cleanDueDate(input.dueDate)
  if (input.assigneeId !== undefined) {
    patch.assigneeId = await validateAssignee(listId, input.assigneeId)
  }

  const [task] = await db
    .update(tables.tasks)
    .set(patch)
    .where(and(eq(tables.tasks.id, taskId), eq(tables.tasks.listId, listId)))
    .returning()

  if (!task) return { ok: false, error: 'That task no longer exists.' }

  const changed = changedFields(existing, task)
  if (changed.length > 0) {
    await record(listId, taskId, member.userId, 'updated', task.title, changed.join(', '))
    await notifyList({
      listId,
      actorId: member.userId,
      actorName: await displayNameOf(member.userId),
      listName: member.listName,
      kind: 'updated',
      taskId,
      taskTitle: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
    })
  }

  revalidatePath(`/list/${listId}`)
  return { ok: true }
}

export async function setTaskCompleted(
  listId: string,
  taskId: string,
  completed: boolean,
): Promise<ActionResult> {
  const member = await requireMember(listId)
  const existing = await loadTask(listId, taskId)
  if (!existing) return { ok: false, error: 'That task no longer exists.' }

  if (existing.completed === completed) return { ok: true }

  const [task] = await db
    .update(tables.tasks)
    .set({ completed, updatedBy: member.userId })
    .where(and(eq(tables.tasks.id, taskId), eq(tables.tasks.listId, listId)))
    .returning()

  if (!task) return { ok: false, error: 'That task no longer exists.' }

  const kind: ActivityKind = completed ? 'completed' : 'reopened'
  await record(listId, taskId, member.userId, kind, task.title)
  await notifyList({
    listId,
    actorId: member.userId,
    actorName: await displayNameOf(member.userId),
    listName: member.listName,
    kind,
    taskId,
    taskTitle: task.title,
    priority: task.priority,
  })

  revalidatePath(`/list/${listId}`)
  return { ok: true }
}

export async function deleteTask(listId: string, taskId: string): Promise<ActionResult> {
  const member = await requireMember(listId)
  const existing = await loadTask(listId, taskId)
  if (!existing) return { ok: false, error: 'That task no longer exists.' }

  await db.delete(tables.tasks).where(and(eq(tables.tasks.id, taskId), eq(tables.tasks.listId, listId)))

  await record(listId, taskId, member.userId, 'deleted', existing.title)
  await notifyList({
    listId,
    actorId: member.userId,
    actorName: await displayNameOf(member.userId),
    listName: member.listName,
    kind: 'deleted',
    taskId,
    taskTitle: existing.title,
    priority: existing.priority,
  })

  revalidatePath(`/list/${listId}`)
  return { ok: true }
}

/**
 * Persists a drag-reorder. Ids are validated against the list before writing, so a
 * crafted payload cannot move another list's tasks into this list's ordering.
 */
export async function reorderTasks(
  listId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  if (!isUuid(listId)) return { ok: false, error: 'Invalid list.' }

  await requireMember(listId)

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: 'Nothing to reorder.' }
  }

  if (orderedIds.some((id) => typeof id !== 'string' || !isUuid(id))) {
    return { ok: false, error: 'Invalid task.' }
  }

  const requested = [...new Set(orderedIds)]

  const owned = await db
    .select({ id: tables.tasks.id })
    .from(tables.tasks)
    .where(and(eq(tables.tasks.listId, listId), inArray(tables.tasks.id, requested)))

  if (owned.length !== requested.length) {
    return { ok: false, error: 'Those tasks do not all belong to this list.' }
  }

  // The client may only see a filtered subset, so renumbering just those tasks
  // would collide with the hidden ones. Instead take the list's full order and
  // replay the client's order into the same slots the subset already occupied.
  const all = await db
    .select({ id: tables.tasks.id })
    .from(tables.tasks)
    .where(eq(tables.tasks.listId, listId))
    .orderBy(asc(tables.tasks.position), asc(tables.tasks.createdAt))

  const requestedSet = new Set(requested)
  const merged = all.map((row) => row.id)
  let cursor = 0
  const finalOrder = merged.map((id) => (requestedSet.has(id) ? requested[cursor++] : id))
  // Any requested task missing from `all` is appended, keeping it non-null-safe.
  while (cursor < requested.length) finalOrder.push(requested[cursor++])

  await db.transaction(async (tx) => {
    for (const [position, id] of finalOrder.entries()) {
      await tx
        .update(tables.tasks)
        .set({ position })
        .where(and(eq(tables.tasks.id, id), eq(tables.tasks.listId, listId)))
    }
  })

  revalidatePath(`/list/${listId}`)
  return { ok: true }
}

async function loadTask(listId: string, taskId: string) {
  if (!isUuid(taskId)) return null

  const [task] = await db
    .select()
    .from(tables.tasks)
    .where(and(eq(tables.tasks.id, taskId), eq(tables.tasks.listId, listId)))
    .limit(1)
  return task ?? null
}

/** An assignee must already be a collaborator on this list. */
async function validateAssignee(listId: string, raw: unknown): Promise<string | null> {
  if (typeof raw !== 'string' || raw.length === 0) return null

  const [member] = await db
    .select({ userId: tables.listMembers.userId })
    .from(tables.listMembers)
    .where(and(eq(tables.listMembers.listId, listId), eq(tables.listMembers.userId, raw)))
    .limit(1)

  return member ? raw : null
}

function changedFields(before: TaskLike, after: TaskLike): string[] {
  const changed: string[] = []
  if (before.title !== after.title) changed.push('title')
  if (before.description !== after.description) changed.push('description')
  if (before.priority !== after.priority) changed.push('priority')
  if (before.dueDate !== after.dueDate) changed.push('due date')
  if (before.assigneeId !== after.assigneeId) changed.push('assignee')
  return changed
}

type TaskLike = {
  title: string
  description: string | null
  priority: Priority
  dueDate: string | null
  assigneeId: string | null
}

async function record(
  listId: string,
  taskId: string,
  actorId: string,
  kind: ActivityKind,
  summary: string | null,
  detail: string | null = null,
): Promise<void> {
  await db.insert(tables.activity).values({
    listId,
    taskId,
    actorId,
    kind,
    summary: detail ? `${summary} (${detail})` : summary,
  })
}

async function displayNameOf(userId: string): Promise<string> {
  const [user] = await db
    .select({ displayName: tables.users.displayName })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1)
  return user?.displayName ?? 'Someone'
}