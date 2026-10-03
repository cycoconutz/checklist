'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createListAction } from '@/app/actions/lists'

const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

/**
 * Accepts a bare invite code or any full invite URL, including one pasted
 * without its scheme, because that is what actually lands in the clipboard.
 */
function extractInviteToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (INVITE_TOKEN_RE.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const segments = url.pathname.split('/').filter(Boolean)
    const joinIndex = segments.lastIndexOf('join')
    const candidate = joinIndex >= 0 ? segments[joinIndex + 1] : undefined
    return candidate && INVITE_TOKEN_RE.test(candidate) ? candidate : null
  } catch {
    return null
  }
}

type Props = {
  /** Prefills the list name for signed-in users. */
  defaultName?: string
  /** Prefills the display name for signed-in users and makes it optional. */
  defaultDisplayName?: string
}

export function CreateListForm({ defaultName = '', defaultDisplayName = '' }: Props) {
  const [state, action, pending] = useActionState(createListAction, { error: null })
  const signedIn = defaultDisplayName.length > 0

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">List name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="Household chores"
          defaultValue={defaultName}
          autoComplete="off"
        />
      </div>

      {!signedIn && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            name="displayName"
            required
            maxLength={40}
            placeholder="Alex"
            autoComplete="nickname"
          />
          <p className="text-sm text-muted-foreground">
            Collaborators see this on every task you add.
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create list'}
      </Button>
    </form>
  )
}

export function JoinByCodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()

    const token = extractInviteToken(code)
    if (!token) {
      setError('That does not look like an invite link or code.')
      return
    }

    setError(null)
    router.push(`/join/${encodeURIComponent(token)}`)
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="code">Invite link or code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
          placeholder="Paste the invite link"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
      </div>
      <Button type="submit" className="w-full">
        Join list
      </Button>
    </form>
  )
}