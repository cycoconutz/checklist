'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { initials, type SerializedMember } from '@/lib/task-types'

const NONE = '__none__'

type Props = {
  value: string
  onChange: (next: string) => void
  members: SerializedMember[]
  currentUserId?: string
  includeMe?: boolean
  includeUnassigned?: boolean
  defaultLabel?: string
}

export function AssigneeSelect({
  value,
  onChange,
  members,
  currentUserId,
  includeMe,
  includeUnassigned,
  defaultLabel = 'Anyone',
}: Props) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next && next !== NONE ? next : '')}
    >
      <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Assignee">
        <SelectValue placeholder={defaultLabel} />
      </SelectTrigger>
      <SelectContent>
        {includeMe && currentUserId && (
          <SelectItem value={currentUserId}>Assigned to me</SelectItem>
        )}
        {/* The sentinel is internal, so this item's text is what the closed
            trigger shows. Rendering the raw value would display "__none__". */}
        {includeUnassigned && <SelectItem value={NONE}>{defaultLabel}</SelectItem>}
        {!includeMe && <SelectItem value={NONE}>{defaultLabel}</SelectItem>}
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            <span className="flex items-center gap-2">
              <Avatar className="size-4" style={{ backgroundColor: m.avatarColor }}>
                <AvatarFallback className="text-[8px] text-white">
                  {initials(m.displayName)}
                </AvatarFallback>
              </Avatar>
              {m.displayName}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}