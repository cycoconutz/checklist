'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Copy, RefreshCw, UserMinus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  renameListAction,
  regenerateInviteAction,
  removeMemberAction,
  updateNotifyPrefsAction,
} from '@/app/actions/lists'
import { initials, type SerializedMember } from '@/lib/task-types'

type Props = {
  listId: string
  listName: string
  isOwner: boolean
  currentUserId: string
  inviteUrl: string | null
  pushConfigured: boolean
  subscriptionCount: number
  notifyPrefs: { create: boolean; update: boolean; delete: boolean }
  members: SerializedMember[]
  vapidPublicKey: string
}

export function ListSettings({
  listId,
  listName,
  isOwner,
  currentUserId,
  inviteUrl,
  pushConfigured,
  subscriptionCount,
  notifyPrefs,
  members,
  vapidPublicKey,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4"
        render={<a href={`/list/${listId}`} />}
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to list
      </Button>

      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <div className="space-y-6">
        <RenameSection listId={listId} listName={listName} />

        {isOwner && <InviteSection listId={listId} inviteUrl={inviteUrl} />}

        <NotificationSection
          pushConfigured={pushConfigured}
          subscriptionCount={subscriptionCount}
          vapidPublicKey={vapidPublicKey}
        />

        <NotifyPrefsSection listId={listId} initial={notifyPrefs} />

        <MembersSection
          listId={listId}
          members={members}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      </div>
    </main>
  )
}

function RenameSection({ listId, listName }: { listId: string; listName: string }) {
  const [name, setName] = useState(listName)
  const [pending, startTransition] = useTransition()

  const dirty = name.trim().length > 0 && name.trim() !== listName

  return (
    <Card>
      <CardHeader>
        <CardTitle>List name</CardTitle>
        <CardDescription>Everyone on the list sees this.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              const result = await renameListAction(listId, name)
              if (!result.ok) toast.error(result.error)
              else toast.success('List renamed')
            })
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="List name"
          />
          <Button type="submit" disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function InviteSection({
  listId,
  inviteUrl,
}: {
  listId: string
  inviteUrl: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  async function copy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite link</CardTitle>
        <CardDescription>
          Anyone with this link can join and see every task on the list. Rotate it
          to revoke the old one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            readOnly
            value={inviteUrl ?? ''}
            aria-label="Invite link"
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={copy} disabled={!inviteUrl}>
            {copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await regenerateInviteAction(listId)
              if (!result.ok) toast.error(result.error)
              else toast.success('Invite link replaced')
            })
          }
        >
          <RefreshCw aria-hidden className="size-3.5" />
          {pending ? 'Rotating…' : 'Rotate link'}
        </Button>
      </CardContent>
    </Card>
  )
}

function NotificationSection({
  pushConfigured,
  subscriptionCount,
  vapidPublicKey,
}: {
  pushConfigured: boolean
  subscriptionCount: number
  vapidPublicKey: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Capability is browser state, not React state. Reading it through
  // useSyncExternalStore keeps server and client snapshots distinct, so there is
  // no hydration mismatch and no effect needed.
  const supported = useSyncExternalStore(subscribeNever, detectPushSupport, serverFalse)
  const permission = useSyncExternalStore(
    subscribeNever,
    detectNotificationPermission,
    serverDenied,
  )

  const [subscription, setSubscription] = useState<'checking' | 'on' | 'off'>('checking')

  useEffect(() => {
    if (!supported) return

    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscription(sub ? 'on' : 'off')
      })
      .catch(() => {
        if (!cancelled) setSubscription('off')
      })

    return () => {
      cancelled = true
    }
  }, [supported])

  async function enable() {
    if (!pushConfigured || !vapidPublicKey) {
      toast.error('Push is not configured on this server.')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      toast.error('Notification permission was denied.')
      return
    }

    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }))

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })

        if (!res.ok) throw new Error('Could not save this subscription.')

        setSubscription('on')
        toast.success('Push notifications enabled on this device')
        router.refresh()
      } catch (error) {
        setSubscription('off')
        toast.error(error instanceof Error ? error.message : 'Could not enable push.')
      }
    })
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (!existing) {
          setSubscription('off')
          return
        }

        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        })
        await existing.unsubscribe()

        setSubscription('off')
        toast.success('Push disabled on this device')
        router.refresh()
      } catch {
        toast.error('Could not turn push off.')
      }
    })
  }

  function sendTest() {
    startTransition(async () => {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) toast.error(body.error ?? 'Could not send a test notification.')
      else toast.success('Test notification sent')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
        <CardDescription>
          Get a notification when someone else on this list adds, changes, or
          finishes a task. Notifications show the task title, never its details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!pushConfigured && (
          <p className="text-sm text-muted-foreground">
            Push is not configured on this server, so it cannot be enabled yet.
          </p>
        )}

        {!supported && (
          <p className="text-sm text-muted-foreground">
            This browser cannot receive push notifications. On iOS, install the app
            to the home screen first.
          </p>
        )}

        {supported && permission === 'denied' && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked for this site. Re-enable them in your browser
            settings.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={subscription === 'on' ? 'outline' : 'default'}
            disabled={!supported || !pushConfigured || pending || subscription === 'on'}
            onClick={enable}
          >
            {subscription === 'on' ? 'Enabled on this device' : 'Enable on this device'}
          </Button>

          {subscription === 'on' && (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={sendTest}>
                Send test
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={disable}>
                Turn off
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {subscriptionCount} device{subscriptionCount === 1 ? '' : 's'} registered
          for your account.
        </p>
      </CardContent>
    </Card>
  )
}

function NotifyPrefsSection({
  listId,
  initial,
}: {
  listId: string
  initial: { create: boolean; update: boolean; delete: boolean }
}) {
  const [prefs, setPrefs] = useState(initial)

  const rows = [
    { key: 'create' as const, label: 'When a task is added' },
    { key: 'update' as const, label: 'When a task changes' },
    { key: 'delete' as const, label: 'When a task is deleted' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>What to notify me about</CardTitle>
        <CardDescription>
          You are never notified about your own changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.key}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`notify-${row.key}`}>{row.label}</Label>
                <Switch
                  id={`notify-${row.key}`}
                  checked={prefs[row.key]}
                  onCheckedChange={(checked) => {
                    setPrefs((prev) => ({ ...prev, [row.key]: checked }))
                    void updateNotifyPrefsAction(listId, { [row.key]: checked })
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MembersSection({
  listId,
  members,
  currentUserId,
  isOwner,
}: {
  listId: string
  members: SerializedMember[]
  currentUserId: string
  isOwner: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Everyone here can add, change, and finish tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {members.map((m, i) => {
            const isSelf = m.userId === currentUserId
            const isListOwner = m.role === 'owner'

            return (
              <li key={m.userId}>
                {i > 0 && <Separator className="mb-1" />}
                <div className="flex items-center gap-3 py-2">
                  <Avatar className="size-8" style={{ backgroundColor: m.avatarColor }}>
                    <AvatarFallback className="text-[10px] text-white">
                      {initials(m.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.displayName}
                      {isSelf && <span className="text-muted-foreground"> (you)</span>}
                    </p>
                    {isListOwner && <p className="text-xs text-muted-foreground">Owner</p>}
                  </div>

                  {!isListOwner && (isOwner || isSelf) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeMemberAction(listId, m.userId)
                          if (!result.ok) toast.error(result.error)
                          else toast.success(`${m.displayName} removed`)
                        })
                      }
                    >
                      <UserMinus aria-hidden className="size-3.5" />
                      {isSelf ? 'Leave' : 'Remove'}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// The snapshot never changes, so subscribe just returns an unsubscribe no-op.
function subscribeNever(): () => void {
  return () => {}
}

function serverFalse(): boolean {
  return false
}

function serverDenied(): NotificationPermission {
  return 'default'
}

function detectPushSupport(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  )
}

function detectNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission
}

/** VAPID keys are base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')

  const raw = atob(normalised)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}