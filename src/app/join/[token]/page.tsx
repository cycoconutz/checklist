import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { db, tables } from '@/db'
import { getCurrentUser } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { JoinForm } from '@/components/join-form'

export const metadata: Metadata = {
  title: 'Join list',
}

type Props = PageProps<'/join/[token]'>

export default async function JoinPage({ params }: Props) {
  const { token } = await params

  const [list] = await db
    .select({ id: tables.lists.id, name: tables.lists.name })
    .from(tables.lists)
    .where(eq(tables.lists.inviteToken, token))
    .limit(1)

  if (!list) notFound()

  const user = await getCurrentUser()
  const alreadyMember = user ? await isMember(list.id, user.id) : false

  if (alreadyMember) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-lg border p-6 text-center">
          <Users aria-hidden className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{list.name}</h1>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            You are already on this list.
          </p>
          <Button render={<Link href={`/list/${list.id}`} />}>Open list</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <Users aria-hidden className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Join {list.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be able to add, change, and complete tasks on this list.
        </p>
      </div>

      <JoinForm token={token} needsName={!user} defaultName={user?.displayName ?? ''} />
    </main>
  )
}

async function isMember(listId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: tables.listMembers.userId })
    .from(tables.listMembers)
    .where(
      and(
        eq(tables.listMembers.listId, listId),
        eq(tables.listMembers.userId, userId),
      ),
    )
    .limit(1)
  return Boolean(row)
}