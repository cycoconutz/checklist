import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { myLists } from '@/lib/queries'
import { CreateListForm, JoinByCodeForm } from '@/components/create-list-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SignOutButton } from '@/components/sign-out-button'
import { ListCard } from '@/components/list-card'

export const metadata: Metadata = {
  title: 'Your checklists',
}

export default async function HomePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/welcome')

  const lists = await myLists(user.id)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <h1 className="truncate text-2xl font-semibold">{user.displayName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Avatar style={{ backgroundColor: user.avatarColor }}>
            <AvatarFallback className="text-white">
              {initials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <SignOutButton />
        </div>
      </header>

      <section aria-labelledby="your-lists">
        <h2 id="your-lists" className="mb-3 text-sm font-medium text-muted-foreground">
          Your checklists
        </h2>

        {lists.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No lists yet. Create one below, or join one with an invite link.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {lists.map((list) => (
              <li key={list.id}>
                <ListCard {...list} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="get-started" className="mt-10">
        <h2 id="get-started" className="mb-3 text-sm font-medium text-muted-foreground">
          Get started
        </h2>
        <Tabs defaultValue="create" className="rounded-lg border p-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">New list</TabsTrigger>
            <TabsTrigger value="join">Join one</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="pt-4">
            <CreateListForm defaultName="" />
          </TabsContent>
          <TabsContent value="join" className="pt-4">
            <JoinByCodeForm />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}