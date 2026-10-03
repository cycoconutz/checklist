'use client'

import { useCallback, useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  DEFAULT_QUERY,
  PRIORITIES,
  SORT_MODES,
  STATUS_FILTERS,
  type SortMode,
  type StatusFilter,
} from '@/lib/task-query'
import type { Priority } from '@/db/schema'

type InitialQuery = {
  sort: SortMode
  status: StatusFilter
  priority: Priority[]
  assignee: string
}

/**
 * Sort and filter live in the URL so a view is shareable, survives reload, and
 * works with the back button. The router push is wrapped in a transition so the
 * list does not flash while the new query loads.
 */
export function useSortAndFilter(listId: string, initial: InitialQuery) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const sort = (searchParams.get('sort') as SortMode) ?? initial.sort
  const status = (searchParams.get('status') as StatusFilter) ?? initial.status
  const assignee = searchParams.get('assignee') ?? initial.assignee

  const priority = useMemo(() => {
    const raw = searchParams.get('priority')
    if (!raw) return initial.priority
    return raw
      .split(',')
      .filter((p): p is Priority => (PRIORITIES as readonly string[]).includes(p))
  }, [searchParams, initial.priority])

  const write = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())

      const sortValue = params.get('sort')
      if (!sortValue || sortValue === DEFAULT_QUERY.sort) params.delete('sort')

      const statusValue = params.get('status')
      if (!statusValue || statusValue === DEFAULT_QUERY.status) params.delete('status')

      const assigneeValue = params.get('assignee')
      if (!assigneeValue || assigneeValue === 'all') params.delete('assignee')

      const priorityValue = params.get('priority')
      if (!priorityValue) params.delete('priority')

      mutate(params)

      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [searchParams, pathname, router],
  )

  const setSort = useCallback(
    (next: SortMode) =>
      write((params) => {
        if (next === DEFAULT_QUERY.sort) params.delete('sort')
        else params.set('sort', next)
      }),
    [write],
  )

  const setStatus = useCallback(
    (next: StatusFilter) =>
      write((params) => {
        if (next === DEFAULT_QUERY.status) params.delete('status')
        else params.set('status', next)
      }),
    [write],
  )

  const setAssignee = useCallback(
    (next: string) =>
      write((params) => {
        if (next === 'all') params.delete('assignee')
        else params.set('assignee', next)
      }),
    [write],
  )

  const togglePriority = useCallback(
    (next: Priority) =>
      write((params) => {
        const current = (params.get('priority')?.split(',') ?? []).filter(Boolean)
        const updated = current.includes(next)
          ? current.filter((p) => p !== next)
          : [...current, next]

        if (updated.length === 0) params.delete('priority')
        else params.set('priority', updated.join(','))
      }),
    [write],
  )

  const clearFilters = useCallback(
    () =>
      write((params) => {
        for (const key of ['status', 'priority', 'assignee']) params.delete(key)
      }),
    [write],
  )

  /** Query string sent to the polling endpoint. Must match the server's parse. */
  const toSearchParams = useCallback(() => {
    const params = new URLSearchParams()
    if (sort !== DEFAULT_QUERY.sort) params.set('sort', sort)
    if (status !== DEFAULT_QUERY.status) params.set('status', status)
    if (priority.length > 0) params.set('priority', priority.join(','))
    if (assignee !== 'all') params.set('assignee', assignee)
    return params
  }, [sort, status, priority, assignee])

  const hasActiveFilters =
    status !== DEFAULT_QUERY.status || priority.length > 0 || assignee !== 'all'

  return {
    listId,
    sort,
    status,
    priority,
    assignee,
    setSort,
    setStatus,
    setAssignee,
    togglePriority,
    clearFilters,
    toSearchParams,
    hasActiveFilters,
    pending,
    sortModes: SORT_MODES,
    statusFilters: STATUS_FILTERS,
  }
}

export type SortFilterView = ReturnType<typeof useSortAndFilter>