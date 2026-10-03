import type { Metadata } from 'next'
import { requireMember } from '@/lib/access'
import { listTasks, parseTaskQuery } from '@/lib/tasks'
import { serializeTasks } from '@/lib/task-types'
import { listMembers } from '@/lib/queries'
import { Checklist } from '@/components/checklist'

type Props = PageProps<'/list/[listId]'>
type SearchParams = { [key: string]: string | string[] | undefined }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listId } = await params
  // requireMember 404s on a non-member, which is the correct behaviour for the
  // title too: they must not learn the list name.
  const member = await requireMember(listId)
  return { title: member.listName }
}

export default async function ListPage({
  params,
  searchParams,
}: Props & { searchParams: Promise<SearchParams> }) {
  const { listId } = await params
  const sp = await searchParams

  const member = await requireMember(listId)

  const flat = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') flat.set(key, value)
  }

  const query = parseTaskQuery(flat, member.userId)
  const [tasks, members] = await Promise.all([
    listTasks(listId, query),
    listMembers(listId),
  ])

  return (
    <Checklist
      listId={listId}
      isOwner={member.isOwner}
      currentUserId={member.userId}
      initialTasks={serializeTasks(tasks)}
      members={members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        avatarColor: m.avatarColor,
        role: m.role,
      }))}
      query={{ sort: query.sort, status: query.status, priority: query.priority, assignee: query.assignee }}
    />
  )
}