import type { Priority } from '@/db/schema'
import type { TaskRow } from '@/lib/tasks'

/** Wire shape. Dates become ISO strings so it survives JSON round-trips. */
export type SerializedTask = {
  id: string
  title: string
  description: string | null
  priority: Priority
  completed: boolean
  dueDate: string | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeColor: string | null
  position: number
  updatedAt: string
  createdAt: string
}

export function serializeTask(task: TaskRow): SerializedTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    completed: task.completed,
    dueDate: task.dueDate,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    assigneeColor: task.assigneeColor,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export function serializeTasks(tasks: TaskRow[]): SerializedTask[] {
  return tasks.map(serializeTask)
}

export type SerializedMember = {
  userId: string
  displayName: string
  avatarColor: string
  role: 'owner' | 'member'
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Tailwind classes per priority. Kept here so the pill and legend cannot drift. */
export const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
}

export const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
}

/** True when a task is past its due date and not yet done. */
export function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false
  const today = new Date().toISOString().slice(0, 10)
  return dueDate < today
}

export function formatDueDate(dueDate: string): string {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)

  if (dueDate === todayStr) return 'Today'
  if (dueDate === tomorrow) return 'Tomorrow'

  const parsed = new Date(`${dueDate}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Up to two letters for avatars. Shared so every avatar cannot drift. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}