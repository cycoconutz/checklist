import type { Priority } from '@/db/schema'

export const SORT_MODES = ['manual', 'priority', 'due', 'assignee', 'title', 'recent'] as const
export type SortMode = (typeof SORT_MODES)[number]

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Custom order',
  priority: 'Priority',
  due: 'Due date',
  assignee: 'Assignee',
  title: 'Title',
  recent: 'Recently changed',
}

export const STATUS_FILTERS = ['all', 'active', 'completed'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  completed: 'Done',
}

export const PRIORITIES = ['high', 'medium', 'low'] as const

export type TaskQuery = {
  sort: SortMode
  status: StatusFilter
  priority: Priority[]
  assignee: string
  meId: string
}

export const DEFAULT_QUERY = {
  sort: 'manual',
  status: 'active',
} as const

/** Pure: safe to import from client components. */
export function parseTaskQuery(
  params: URLSearchParams,
  currentUserId: string,
): TaskQuery {
  const rawSort = params.get('sort')
  const sort: SortMode = SORT_MODES.includes(rawSort as SortMode)
    ? (rawSort as SortMode)
    : 'manual'

  const rawStatus = params.get('status')
  const status: StatusFilter = STATUS_FILTERS.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : 'active'

  const priority = (params.get('priority')?.split(',') ?? []).filter((p): p is Priority =>
    (PRIORITIES as readonly string[]).includes(p),
  )

  const assignee = params.get('assignee') ?? 'all'

  return { sort, status, priority, assignee, meId: currentUserId }
}