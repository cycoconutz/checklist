'use client'

import { useState, useTransition } from 'react'
import { mutate } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PrioritySelect } from '@/components/priority-select'
import { AssigneeSelect } from '@/components/assignee-select'
import { updateTask } from '@/app/actions/tasks'
import type { SerializedMember, SerializedTask } from '@/lib/task-types'
import type { Priority } from '@/db/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: SerializedTask
  listId: string
  members: SerializedMember[]
}

export function EditTaskDialog({ open, onOpenChange, task, listId, members }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Changes notify the other collaborators on this list.
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while open and keyed by task, so the fields always start
            from the current values with no syncing effect. */}
        {open && (
          <EditTaskForm
            key={task.id}
            task={task}
            listId={listId}
            members={members}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = {
  task: SerializedTask
  listId: string
  members: SerializedMember[]
  onDone: () => void
}

function EditTaskForm({ task, listId, members, onDone }: FormProps) {
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '')

  function save() {
    const clean = title.trim()
    if (!clean || pending) return

    startTransition(async () => {
      const result = await updateTask(listId, task.id, {
        title: clean,
        description,
        priority,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Task updated')
      onDone()
      void mutate(() => true)
    })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Optional details"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Priority</Label>
          <PrioritySelect value={priority} onChange={setPriority} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-due">Due date</Label>
          <Input
            id="edit-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Assignee</Label>
          <AssigneeSelect
            value={assigneeId}
            onChange={setAssigneeId}
            members={members}
            includeUnassigned
            defaultLabel="Unassigned"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}