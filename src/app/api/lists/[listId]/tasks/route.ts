import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { findMembership } from '@/lib/access'
import { listTasks, parseTaskQuery } from '@/lib/tasks'
import { serializeTasks } from '@/lib/task-types'

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/lists/[listId]/tasks'>,
) {
  const user = await getCurrentUser()
  // Unauthenticated callers get the same 404 as non-members, so this endpoint
  // cannot be used to probe which list ids exist.
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { listId } = await params

  const member = await findMembership(listId, user)
  if (!member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const query = parseTaskQuery(url.searchParams, user.id)
  const tasks = await listTasks(listId, query)

  return NextResponse.json(
    { tasks: serializeTasks(tasks), fetchedAt: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}