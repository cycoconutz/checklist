import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { CreateListForm, JoinByCodeForm } from '@/components/create-list-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckSquare, Bell, ShieldCheck, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Welcome',
}

export default async function WelcomePage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="mb-8 text-center">
        <CheckSquare aria-hidden className="mx-auto mb-3 size-10 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Shared checklists</h1>
        <p className="mt-2 text-muted-foreground">
          Make a list, send the link, and everyone can add to it.
        </p>
      </div>

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

      <ul className="mt-10 grid gap-4 text-sm sm:grid-cols-3">
        <Feature icon={Users} title="Collaborative">
          Everyone edits the same list, with their name on every change.
        </Feature>
        <Feature icon={Bell} title="Push alerts">
          Get notified on your phone when a task is added, changed, or done.
        </Feature>
        <Feature icon={ShieldCheck} title="Private">
          Only people with the invite link can open the list.
        </Feature>
      </ul>
    </main>
  )
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="rounded-lg border p-3">
      <Icon aria-hidden className="mb-2 size-4 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </li>
  )
}