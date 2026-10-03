'use client'

import {
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { mutate } from 'swr'
import { toast } from 'sonner'
import { CalendarDays, AlignLeft, Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EditTaskDialog } from '@/components/edit-task-dialog'
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  formatDueDate,
  initials,
  isOverdue,
  type SerializedMember,
  type SerializedTask,
} from '@/lib/task-types'
import { setTaskCompleted, deleteTask } from '@/app/actions/tasks'

type Props = {
  task: SerializedTask
  listId: string
  members: SerializedMember[]
  currentUserId: string
  /** Rendered before the checkbox. Used for the drag handle in manual order. */
  handle?: ReactNode
  /** Lets a sortable wrapper make this <li> the drag node, keeping ul/li valid. */
  rowRef?: (node: HTMLLIElement | null) => void
  rowStyle?: CSSProperties
  rowClassName?: string
}

export function TaskRow({
  task,
  listId,
  members,
  currentUserId,
  handle,
  rowRef,
  rowStyle,
  rowClassName,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)

  // Local mirror so the checkbox flips instantly. Re-synced whenever the polled
  // row changes, which is how another collaborator's completion shows up.
  const [checked, setChecked] = useState(task.completed)
  const [synced, setSynced] = useState(task.completed)
  if (synced !== task.completed) {
    setSynced(task.completed)
    setChecked(task.completed)
  }

  const overdue = isOverdue(task.dueDate, checked)

  function toggle() {
    if (pending) return
    const next = !checked
    setChecked(next)

    startTransition(async () => {
      const result = await setTaskCompleted(listId, task.id, next)
      if (!result.ok) {
        setChecked(task.completed)
        toast.error(result.error)
        return
      }
      void mutate(() => true)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTask(listId, task.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Task deleted')
      void mutate(() => true)
    })
  }

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={`flex gap-2 py-3 ${rowClassName ?? ''}`}
    >
      {handle}

      <div className="pt-0.5">
        <Checkbox
          checked={checked}
          onCheckedChange={toggle}
          aria-label={checked ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          disabled={pending}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={checked ? 'text-muted-foreground line-through' : 'font-medium'}>
          {task.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge className={PRIORITY_CLASS[task.priority]} variant="secondary">
            {PRIORITY_LABEL[task.priority]}
          </Badge>

          {task.dueDate && (
            <Badge
              variant="secondary"
              className={
                overdue
                  ? 'gap-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  : 'gap-1 text-muted-foreground'
              }
            >
              <CalendarDays aria-hidden className="size-3" />
              {formatDueDate(task.dueDate)}
              {overdue ? ' · overdue' : ''}
            </Badge>
          )}

          {task.description && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlignLeft aria-hidden className="size-3" />
              Has details
            </span>
          )}

          {task.assigneeId && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Avatar className="size-4" style={{ backgroundColor: task.assigneeColor ?? '#888' }}>
                <AvatarFallback className="text-[8px] text-white">
                  {initials(task.assigneeName ?? '?')}
                </AvatarFallback>
              </Avatar>
              {task.assigneeId === currentUserId ? 'You' : task.assigneeName}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit "${task.title}"`}
          onClick={() => setShowEdit(true)}
        >
          <Pencil aria-hidden className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete "${task.title}"`}
          disabled={pending}
          onClick={remove}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </div>

      <EditTaskDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        task={task}
        listId={listId}
        members={members}
      />
    </li>
  )
}