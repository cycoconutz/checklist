'use client'

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ListToolbar } from '@/components/list-toolbar'
import { TaskComposer } from '@/components/task-composer'
import { SortableTaskList } from '@/components/sortable-task-list'
import { useSortAndFilter } from '@/hooks/use-sort-and-filter'
import type { SerializedMember, SerializedTask } from '@/lib/task-types'
import type { SortMode, StatusFilter } from '@/lib/task-query'
import type { Priority } from '@/db/schema'

type Props = {
  listId: string
  isOwner: boolean
  currentUserId: string
  initialTasks: SerializedTask[]
  members: SerializedMember[]
  query: {
    sort: SortMode
    status: StatusFilter
    priority: Priority[]
    assignee: string
  }
}

const POLL_INTERVAL_MS = 10_000

export function Checklist({
  listId,
  isOwner,
  currentUserId,
  initialTasks,
  members,
  query,
}: Props) {
  const view = useSortAndFilter(listId, query)

  const searchKey = view.toSearchParams().toString()
  const fetcher = useCallback(
    async (key: string) => {
      const res = await fetch(key, { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not refresh')
      return (await res.json()) as { tasks: SerializedTask[] }
    },
    [],
  )

  const {
    data,
    mutate,
    isLoading,
    error,
  } = useSWR<{ tasks: SerializedTask[] }>(
    `/api/lists/${listId}/tasks?${searchKey}`,
    fetcher,
    {
      fallbackData: { tasks: initialTasks },
      refreshInterval: POLL_INTERVAL_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      // Keeps the list from jumping under someone mid-edit.
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  )

  const tasks = data?.tasks ?? []

  // Dragging only makes sense in manual order with nothing filtered out. Every
  // other mode is ordered by SQL, so a local reorder would be discarded on the
  // next poll, and a filtered drag would have to renumber hidden tasks too.
  const canDrag = view.sort === 'manual' && !view.hasActiveFilters

  const emptyMessage = useMemo(() => {
    if (view.status === 'completed') return 'Nothing completed yet.'
    if (view.assignee === 'me') return 'Nothing assigned to you.'
    if (view.assignee === 'unassigned') return 'Everything has an owner.'
    if (view.priority.length > 0) return 'No tasks at those priorities.'
    return 'No tasks yet. Add the first one below.'
  }, [view.status, view.assignee, view.priority])

  async function handleReorder(orderedIds: string[]) {
    // Optimistic: show the new order immediately, roll back if the write fails.
    const previous = data?.tasks
    mutate(
      {
        tasks: (previous ?? []).map((t) => ({
          ...t,
          position: orderedIds.indexOf(t.id),
        })),
      },
      { revalidate: false },
    )

    const { reorderTasks } = await import('@/app/actions/tasks')
    const result = await reorderTasks(listId, orderedIds)
    if (!result.ok) {
      if (previous) mutate({ tasks: previous }, { revalidate: false })
      toast.error(result.error)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-28 pt-4">
      <ListToolbar
        sort={view.sort}
        status={view.status}
        priority={view.priority}
        assignee={view.assignee}
        listId={listId}
        isOwner={isOwner}
        members={members}
        currentUserId={currentUserId}
        onSortChange={view.setSort}
        onStatusChange={view.setStatus}
        onPriorityToggle={view.togglePriority}
        onAssigneeChange={(next) => view.setAssignee(next ?? 'all')}
        onClearFilters={view.clearFilters}
        hasActiveFilters={view.hasActiveFilters}
      />

      <div className="mt-4 flex-1">
        {isLoading && tasks.length === 0 ? (
          <TaskSkeleton />
        ) : tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <SortableTaskList
            tasks={tasks}
            listId={listId}
            members={members}
            currentUserId={currentUserId}
            draggable={canDrag}
            onReorder={handleReorder}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="py-2 text-center text-sm text-destructive">
          Could not refresh this list. Retrying automatically.
        </p>
      )}

      <TaskComposer
        listId={listId}
        members={members}
        onCreated={async () => {
          await mutate()
        }}
      />

      <span className="sr-only" aria-live="polite">
        {tasks.length} task{tasks.length === 1 ? '' : 's'} shown
      </span>
    </main>
  )
}

function TaskSkeleton() {
  return (
    <ul className="divide-y" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <div className="size-5 rounded border bg-muted" />
          <div className="h-4 flex-1 rounded bg-muted" />
        </li>
      ))}
    </ul>
  )
}