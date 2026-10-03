'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/app/actions/lists'

export function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      disabled={pending}
      onClick={() => startTransition(() => void signOutAction())}
    >
      <LogOut aria-hidden className="size-4" />
    </Button>
  )
}