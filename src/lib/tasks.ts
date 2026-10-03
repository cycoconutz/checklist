import { and, asc, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import { db, tables } from '@/db'
import type { SortMode, TaskQuery } from '@/lib/task-query'

export { parseTaskQuery, SORT_MODES, STATUS_FILTERS } from '@/lib/task-query'
export type { SortMode, StatusFilter, TaskQuery } from '@/lib/task-query'

type TaskRow = typeof tables.tasks.$inferSelect & {
  assigneeName: string | null
  assigneeColor: string | null
}

/**
 * Sort and filter both compose in SQL so ordering stays correct as a list grows,
 * and so a cursor can be added later without changing the shape.
 */
export async function listTasks(listId: string, query: TaskQuery): Promise<TaskRow[]> {
  const where: SQL[] = [eq(tables.tasks.listId, listId)]

  if (query.status === 'active') where.push(eq(tables.tasks.completed, false))
  if (query.status === 'completed') where.push(eq(tables.tasks.completed, true))

  if (query.priority.length > 0) {
    where.push(or(...query.priority.map((p) => eq(tables.tasks.priority, p)))!)
  }

  if (query.assignee === 'unassigned') {
    where.push(isNull(tables.tasks.assigneeId))
  } else if (query.assignee === 'me') {
    where.push(eq(tables.tasks.assigneeId, query.meId))
  } else if (query.assignee !== 'all') {
    where.push(eq(tables.tasks.assigneeId, query.assignee))
  }

  return db
    .select({
      id: tables.tasks.id,
      listId: tables.tasks.listId,
      title: tables.tasks.title,
      description: tables.tasks.description,
      priority: tables.tasks.priority,
      completed: tables.tasks.completed,
      dueDate: tables.tasks.dueDate,
      assigneeId: tables.tasks.assigneeId,
      position: tables.tasks.position,
      createdBy: tables.tasks.createdBy,
      updatedBy: tables.tasks.updatedBy,
      createdAt: tables.tasks.createdAt,
      updatedAt: tables.tasks.updatedAt,
      assigneeName: tables.users.displayName,
      assigneeColor: tables.users.avatarColor,
    })
    .from(tables.tasks)
    .leftJoin(tables.users, eq(tables.users.id, tables.tasks.assigneeId))
    .where(and(...where))
    .orderBy(...buildOrderBy(query.sort))
}

function buildOrderBy(sort: SortMode) {
  switch (sort) {
    case 'priority':
      // Enum is declared high->low, so ascending is already high-first.
      return [asc(tables.tasks.priority), asc(tables.tasks.position)]
    case 'due':
      // Tasks with no due date sink to the bottom rather than sorting as epoch 0.
      return [
        asc(sql`${tables.tasks.dueDate} is null`),
        asc(tables.tasks.dueDate),
        asc(tables.tasks.priority),
        asc(tables.tasks.position),
      ]
    case 'assignee':
      return [
        asc(sql`${tables.tasks.assigneeId} is null`),
        asc(tables.users.displayName),
        asc(tables.tasks.position),
      ]
    case 'title':
      return [asc(tables.tasks.title), asc(tables.tasks.position)]
    case 'recent':
      return [desc(tables.tasks.updatedAt)]
    case 'manual':
    default:
      return [asc(tables.tasks.position), asc(tables.tasks.createdAt)]
  }
}

export type { TaskRow }