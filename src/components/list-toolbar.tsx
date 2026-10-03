'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Filter, X, Settings2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  initials,
  type SerializedMember,
} from '@/lib/task-types'
import { SORT_LABELS, PRIORITIES, type SortMode, type StatusFilter } from '@/lib/task-query'
import type { Priority } from '@/db/schema'

type Props = {
  sort: SortMode
  status: StatusFilter
  priority: Priority[]
  assignee: string
  members: SerializedMember[]
  currentUserId: string
  listId: string
  isOwner: boolean
  onSortChange: (next: SortMode) => void
  onStatusChange: (next: StatusFilter) => void
  onPriorityToggle: (next: Priority) => void
  onAssigneeChange: (next: string | null) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

const ANYONE = 'all'
const ME = 'me'
const UNASSIGNED = 'unassigned'

export function ListToolbar({
  sort,
  status,
  priority,
  assignee,
  members,
  currentUserId,
  listId,
  isOwner,
  onSortChange,
  onStatusChange,
  onPriorityToggle,
  onAssigneeChange,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount =
    priority.length + (assignee !== ANYONE ? 1 : 0) + (status !== 'active' ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
        <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Sort by">
          <ArrowUpDown aria-hidden className="size-3.5" />
          <SelectValue>{(selected) => SORT_LABELS[selected as SortMode]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
            <SelectItem key={mode} value={mode}>
              {SORT_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        role="group"
        aria-label="Filter by status"
        className="flex items-center gap-0.5 rounded-lg border p-0.5"
      >
        {(
          [
            ['all', 'All'],
            ['active', 'Active'],
            ['completed', 'Done'],
          ] as [StatusFilter, string][]
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={status === value ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="More filters"
            />
          }
        >
          <Filter aria-hidden className="size-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="px-1.5 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Filters apply to everyone and are kept in this page&rsquo;s link.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Priority</legend>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const active = priority.includes(p)
                  return (
                    <Button
                      key={p}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => onPriorityToggle(p)}
                    >
                      <span aria-hidden className={`size-2 rounded-full ${PRIORITY_DOT[p]}`} />
                      {PRIORITY_LABEL[p]}
                    </Button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Assignee</legend>
              <Select value={assignee} onValueChange={onAssigneeChange}>
                <SelectTrigger size="sm" className="w-full" aria-label="Filter by assignee">
                  <SelectValue placeholder="Anyone">
                    {(selected) => {
                      if (selected === ME) return 'Assigned to me'
                      if (selected === UNASSIGNED) return 'Unassigned'
                      const member = members.find((m) => m.userId === selected)
                      if (!member) return 'Anyone'
                      return (
                        <span className="flex items-center gap-2">
                          <Avatar
                            className="size-4"
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            <AvatarFallback className="text-[8px] text-white">
                              {initials(member.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          {member.userId === currentUserId
                            ? `${member.displayName} (you)`
                            : member.displayName}
                        </span>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANYONE}>Anyone</SelectItem>
                  <SelectItem value={ME}>Assigned to me</SelectItem>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span className="flex items-center gap-2">
                        <Avatar
                          className="size-4"
                          style={{ backgroundColor: m.avatarColor }}
                        >
                          <AvatarFallback className="text-[8px] text-white">
                            {initials(m.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        {m.userId === currentUserId
                          ? `${m.displayName} (you)`
                          : m.displayName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>

            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={onClearFilters}>
                <X aria-hidden className="size-3.5" />
                Clear all filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        render={<Link href={`/list/${listId}/settings`} />}
      >
        {isOwner ? (
          <Users aria-hidden className="size-3.5" />
        ) : (
          <Settings2 aria-hidden className="size-3.5" />
        )}
        Settings
      </Button>
    </div>
  )
}