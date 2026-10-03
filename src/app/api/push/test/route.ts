import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { notifyUser, pushIsConfigured } from '@/lib/push'

/** Sends a push only to the caller's own devices, to verify setup end to end. */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!pushIsConfigured()) {
    return NextResponse.json(
      { error: 'Push is not configured on this server.' },
      { status: 503 },
    )
  }

  try {
    const result = await notifyUser(
      user.id,
      'Push is working',
      'You will get a notification when a collaborator changes a task.',
      '/',
    )

    if (result.sent === 0) {
      return NextResponse.json(
        { error: 'No subscriptions registered for this account yet.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not send push.' },
      { status: 500 },
    )
  }
}