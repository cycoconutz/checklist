import { requireMember } from '@/lib/access'
import { listMembers, inviteTokenFor, pushSubscriptionsFor } from '@/lib/queries'
import { getCurrentUser } from '@/lib/session'
import { pushIsConfigured } from '@/lib/push'
import { ListSettings } from '@/components/list-settings'

export default async function ListSettingsPage(props: PageProps<'/list/[listId]/settings'>) {
  const { listId } = await props.params
  const member = await requireMember(listId)
  const user = await getCurrentUser()

  // Only the owner ever sees or rotates the link, so the token is not even read
  // for members and cannot leak into a member's page payload.
  const inviteToken = member.isOwner ? await inviteTokenFor(listId) : null

  const [members, subscriptions] = await Promise.all([
    listMembers(listId),
    user ? pushSubscriptionsFor(user.id) : Promise.resolve([]),
  ])

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  return (
    <ListSettings
      listId={listId}
      listName={member.listName}
      isOwner={member.isOwner}
      currentUserId={member.userId}
      inviteUrl={inviteToken ? `${siteUrl}/join/${inviteToken}` : null}
      pushConfigured={pushIsConfigured()}
      subscriptionCount={subscriptions.length}
      notifyPrefs={{
        create: member.notifyOnCreate,
        update: member.notifyOnUpdate,
        delete: member.notifyOnDelete,
      }}
      members={members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        avatarColor: m.avatarColor,
        role: m.role,
      }))}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
    />
  )
}