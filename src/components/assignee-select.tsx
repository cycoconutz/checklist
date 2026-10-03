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
  // Base UI resolves Select.Value's label from the Root `items` prop and ignores
  // the rendered SelectItem children, so without this the closed trigger falls
  // back to printing the raw value, which for an assignee is the user id.
  const labelFor = (selected: string | null) => {
    const member = members.find((m) => m.userId === selected)
    if (!member) return defaultLabel
    return (
      <span className="flex items-center gap-2">
        <Avatar className="size-4" style={{ backgroundColor: member.avatarColor }}>
          <AvatarFallback className="text-[8px] text-white">
            {initials(member.displayName)}
          </AvatarFallback>
        </Avatar>
        {member.displayName}
      </span>
    )
  }

  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next && next !== NONE ? next : '')}
    >
      <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Assignee">
        <SelectValue placeholder={defaultLabel}>
          {(selected: string | null) => labelFor(selected)}
        </SelectValue>
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