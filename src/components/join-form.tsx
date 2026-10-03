'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { joinListAction } from '@/app/actions/lists'

type Props = {
  token: string
  needsName: boolean
  defaultName: string
}

export function JoinForm({ token, needsName, defaultName }: Props) {
  const [state, action, pending] = useActionState(joinListAction.bind(null, token), {
    error: null,
  })

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {needsName && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            name="displayName"
            required
            maxLength={40}
            placeholder="Alex"
            autoComplete="nickname"
            defaultValue={defaultName}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Joining…' : 'Join list'}
      </Button>
    </form>
  )
}