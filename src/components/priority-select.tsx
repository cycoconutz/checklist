'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIORITY_DOT, PRIORITY_LABEL } from '@/lib/task-types'
import type { Priority } from '@/db/schema'

type Props = {
  value: Priority
  onChange: (next: Priority) => void
}

export function PrioritySelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Priority)}>
      <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Priority">
        <SelectValue>{(selected) => PRIORITY_LABEL[selected as Priority]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <SelectItem key={p} value={p}>
            <span className="flex items-center gap-2">
              <span aria-hidden className={`size-2 rounded-full ${PRIORITY_DOT[p]}`} />
              {PRIORITY_LABEL[p]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}