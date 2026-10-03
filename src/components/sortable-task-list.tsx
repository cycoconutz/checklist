'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { TaskRow } from '@/components/task-row'
import type { SerializedMember, SerializedTask } from '@/lib/task-types'

type Props = {
  tasks: SerializedTask[]
  listId: string
  members: SerializedMember[]
  currentUserId: string
  /** False when the view is sorted or filtered, where drag order is not meaningful. */
  draggable: boolean
  onReorder: (orderedIds: string[]) => void | Promise<void>
}

export function SortableTaskList({
  tasks,
  listId,
  members,
  currentUserId,
  draggable,
  onReorder,
}: Props) {
  const [items, setItems] = useState(tasks)
  const router = useRouter()

  // Adopt polled/refreshed data as the source of truth. An in-flight optimistic
  // order is intentionally overwritten, since the server always wins.
  const [seenTasks, setSeenTasks] = useState(tasks)
  if (seenTasks !== tasks) {
    setSeenTasks(tasks)
    setItems(tasks)
  }

  const sensors = useSensors(
    // A short activation distance keeps taps from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // The delay lets a vertical scroll win over a drag attempt on touch devices.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!draggable) {
    return (
      <ul className="divide-y">
        {items.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            listId={listId}
            members={members}
            currentUserId={currentUserId}
          />
        ))}
      </ul>
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((t) => t.id === active.id)
    const newIndex = items.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    void onReorder(reordered.map((t) => t.id))
    router.refresh()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y">
          {items.map((task) => (
            <SortableRow
              key={task.id}
              task={task}
              listId={listId}
              members={members}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

type RowProps = {
  task: SerializedTask
  listId: string
  members: SerializedMember[]
  currentUserId: string
}

function SortableRow({ task, listId, members, currentUserId }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <TaskRow
      task={task}
      listId={listId}
      members={members}
      currentUserId={currentUserId}
      rowRef={setNodeRef}
      rowStyle={{ transform: CSS.Transform.toString(transform), transition }}
      rowClassName={isDragging ? 'relative z-10 rounded-lg bg-background shadow-lg' : undefined}
      handle={
        <button
          type="button"
          aria-label={`Reorder "${task.title}"`}
          className="mt-1.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      }
    />
  )
}