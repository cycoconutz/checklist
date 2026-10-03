'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PrioritySelect } from '@/components/priority-select'
import { AssigneeSelect } from '@/components/assignee-select'
import { createTask } from '@/app/actions/tasks'
import type { SerializedMember } from '@/lib/task-types'

type Props = {
  listId: string
  members: SerializedMember[]
  onCreated: () => void | Promise<void>
}

export function TaskComposer({ listId, members, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [pending, startTransition] = useTransition()

  function reset() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setAssigneeId('')
  }

  function submit() {
    const clean = title.trim()
    if (!clean || pending) return

    startTransition(async () => {
      const result = await createTask(listId, {
        title: clean,
        description,
        priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      reset()
      await onCreated()
      setOpen(false)
    })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-2xl px-4 py-3">
        {open ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-task-title" className="sr-only">
                Task title
              </Label>
              <Input
                id="new-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                  if (e.key === 'Escape') setOpen(false)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-task-description" className="sr-only">
                Description
              </Label>
              <Textarea
                id="new-task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details (optional)"
                maxLength={2000}
                rows={2}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PrioritySelect value={priority} onChange={setPriority} />
              <AssigneeSelect
                value={assigneeId}
                onChange={setAssigneeId}
                members={members}
                defaultLabel="Unassigned"
              />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
                className="w-auto"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="lg"
                onClick={submit}
                disabled={!title.trim() || pending}
                className="flex-1"
              >
                {pending ? 'Adding…' : 'Add task'}
              </Button>
              <Button type="button" size="lg" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full justify-start gap-2"
            onClick={() => setOpen(true)}
          >
            <Plus aria-hidden className="size-4" />
            Add a task
          </Button>
        )}
      </div>
    </div>
  )
}