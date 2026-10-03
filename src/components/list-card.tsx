import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Crown, Users } from 'lucide-react'

type Props = {
  id: string
  name: string
  role: 'owner' | 'member'
  openTasks: number
  totalTasks: number
  memberCount: number
}

export function ListCard({ id, name, role, openTasks, totalTasks, memberCount }: Props) {
  return (
    <Link
      href={`/list/${id}`}
      className="block rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium leading-snug">{name}</h3>
              {role === 'owner' && (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <Crown aria-hidden className="size-3" />
                  Owner
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{openTasks}</span> open
            </span>
            <span aria-hidden>·</span>
            <span>{totalTasks} total</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="size-3.5" />
              {memberCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}