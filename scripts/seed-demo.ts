/**
 * Seeds (or reseeds) the public demo list for the portfolio.
 *
 * The demo is an invite link. The app has no passwords: anyone holding a
 * list's invite token opens /join/<token>, types a display name, and lands
 * in a working collaborative list they can actually edit.
 *
 * Idempotent by design:
 *   - The demo list resolves owner-first: lists owned by the "Demo Host"
 *     user, preferring the one named below, falling back to the name only
 *     before the first seed. Identity never resolves by bare display name
 *     once the list exists, because visitors can create same-named users
 *     and lists; the list's ownerId is immutable in the app and is the
 *     stable anchor.
 *   - Collaborators are reused only from THIS list's member rows. A
 *     same-named stranger elsewhere in the database is never adopted.
 *   - The invite token is NEVER regenerated here, so the URL printed on
 *     the first run stays valid on every future reseed. Rotating the token
 *     is a deliberate act in the app's list settings, not a seed side
 *     effect; if you rotate it, update the printed link.
 *   - The wipe and the reseed run as one db.batch transaction: a failed run
 *     leaves the previous demo intact rather than half-replaced.
 *
 * Run: npm run demo:seed
 * Or against a specific database: DATABASE_URL="postgresql://..." npm run demo:seed
 */
import './env'
import { randomBytes, randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db, tables } from '../src/db'
import type { Priority } from '../src/db/schema'

const DEMO_LIST_NAME = 'Kisatchie Camping Trip'
const PROD_ORIGIN = 'https://checklist-cyco.vercel.app'

// Avatar colors from the app's own palette (src/app/actions/lists.ts).
const PEOPLE = [
  { displayName: 'Demo Host', avatarColor: '#e11d48' },
  { displayName: 'Riley Chen', avatarColor: '#4f46e5' },
  { displayName: 'Sam Ruiz', avatarColor: '#059669' },
  { displayName: 'Alex Kim', avatarColor: '#db2777' },
] as const

type Person = (typeof PEOPLE)[number]

type SeedTask = {
  title: string
  description?: string
  priority: Priority
  by: Person
  assignee?: Person
  /** Who completed it; presence marks the task done. */
  completedBy?: Person
  due?: 'thursday' | 'friday'
}

/** Dates are relative to the upcoming Friday so a reseed never looks stale. */
function nextFriday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7))
  return d
}

const friday = nextFriday()
const thursday = new Date(friday)
thursday.setDate(thursday.getDate() - 1)

/** Local date parts, not UTC: keeps the date correct from any timezone. */
function isoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function dueDate(due: SeedTask['due']): string | null {
  if (due === 'friday') return isoDate(friday)
  if (due === 'thursday') return isoDate(thursday)
  return null
}

const TASKS: SeedTask[] = [
  {
    title: 'Reserve the Red Bluff campsite (loop 12)',
    description: 'Two nights, first-come lot. Call the ranger office right at 8am.',
    priority: 'high',
    by: PEOPLE[0],
    assignee: PEOPLE[2],
    due: 'thursday',
  },
  {
    title: 'Buy propane, fire starters, and one more lantern',
    description: 'One canister left from the last trip.',
    priority: 'medium',
    by: PEOPLE[2],
    assignee: PEOPLE[2],
    due: 'thursday',
  },
  { title: 'Borrow the four-person tent from Dad', priority: 'medium', by: PEOPLE[1], assignee: PEOPLE[1] },
  {
    title: 'Charge the satellite messenger and pack spare AAs',
    priority: 'high',
    by: PEOPLE[0],
    assignee: PEOPLE[3],
    due: 'friday',
  },
  { title: 'Restock the first aid kit: moleskin, ibuprofen, tick key', priority: 'medium', by: PEOPLE[3] },
  { title: 'Download the offline map pack for Kisatchie', priority: 'low', by: PEOPLE[2], assignee: PEOPLE[2] },
  { title: 'Print the Wild Azalea trail map (two copies)', priority: 'low', by: PEOPLE[1] },
  {
    title: 'Check the truck: tire pressure, oil, spare',
    description: 'Hitch too, for the cooler rack.',
    priority: 'high',
    by: PEOPLE[0],
    assignee: PEOPLE[3],
    completedBy: PEOPLE[3],
    due: 'thursday',
  },
  {
    title: 'Pre-cook the jambalaya and freeze it flat',
    description: 'Flat bags keep the cooler organized.',
    priority: 'medium',
    by: PEOPLE[0],
    assignee: PEOPLE[1],
    completedBy: PEOPLE[1],
    due: 'thursday',
  },
  { title: 'Confirm dry bags and who owns which cooler', priority: 'low', by: PEOPLE[0], completedBy: PEOPLE[0] },
]

/**
 * Resolves the demo list owner-first.
 *
 * Lists have no unique name and users have no unique display name, and any
 * visitor can create either. The one anchor the app never rewrites is
 * lists.ownerId: the owner's membership row cannot be removed and ownership
 * never transfers. So: lists owned by a "Demo Host" user (oldest first for
 * determinism), preferring the one with the demo name; the bare name lookup
 * is only a bootstrap for the very first run.
 */
async function findList(): Promise<typeof tables.lists.$inferSelect | null> {
  const owned = await db
    .select({ list: tables.lists })
    .from(tables.lists)
    .innerJoin(tables.users, eq(tables.users.id, tables.lists.ownerId))
    .where(eq(tables.users.displayName, PEOPLE[0].displayName))
    .orderBy(asc(tables.lists.createdAt))

  const preferred = owned.find((row) => row.list.name === DEMO_LIST_NAME) ?? owned[0]
  if (preferred) return preferred.list

  const [named] = await db
    .select()
    .from(tables.lists)
    .where(eq(tables.lists.name, DEMO_LIST_NAME))
    .orderBy(asc(tables.lists.createdAt))
    .limit(1)
  return named ?? null
}

/**
 * Returns the id for a demo person, never adopting a same-named stranger.
 *
 * `knownId` short-circuits lookup (the host is always list.ownerId). For
 * collaborators, reuse happens only among THIS list's member rows: a member
 * of the demo who happens to share a name is legitimately the person on
 * screen; a same-named user elsewhere in the database is not.
 */
async function ensurePerson(
  listId: string,
  person: Person,
  role: 'owner' | 'member',
  knownId?: string,
): Promise<string> {
  if (knownId) {
    await db.insert(tables.listMembers).values({ listId, userId: knownId, role }).onConflictDoNothing()
    return knownId
  }

  const [member] = await db
    .select({ userId: tables.users.id })
    .from(tables.listMembers)
    .innerJoin(tables.users, eq(tables.users.id, tables.listMembers.userId))
    .where(and(eq(tables.listMembers.listId, listId), eq(tables.users.displayName, person.displayName)))
    .limit(1)

  if (member) return member.userId

  const [created] = await db
    .insert(tables.users)
    .values({ displayName: person.displayName, avatarColor: person.avatarColor })
    .returning({ id: tables.users.id })

  // Idempotent membership, mirroring the app's join action.
  await db
    .insert(tables.listMembers)
    .values({ listId, userId: created!.id, role })
    .onConflictDoNothing()

  return created!.id
}

async function main(): Promise<void> {
  // Fail before any write if the connection string is malformed.
  const dbUrl = new URL(process.env.DATABASE_URL!)

  let list = await findList()
  if (!list) {
    const [host] = await db
      .insert(tables.users)
      .values({ displayName: PEOPLE[0].displayName, avatarColor: PEOPLE[0].avatarColor })
      .returning({ id: tables.users.id })

    const [created] = await db
      .insert(tables.lists)
      .values({
        name: DEMO_LIST_NAME,
        ownerId: host!.id,
        inviteToken: randomBytes(24).toString('base64url'),
      })
      .returning()

    await db.insert(tables.listMembers).values({ listId: created.id, userId: host!.id, role: 'owner' })
    list = created
    console.log(`created demo list "${list.name}"`)
  } else if (list.name === DEMO_LIST_NAME) {
    console.log(`reusing existing demo list "${list.name}" (invite token unchanged)`)
  } else {
    console.log(`reusing demo list "${list.name}" (was renamed from "${DEMO_LIST_NAME}"; invite token unchanged)`)
  }

  // The host is the list's immutable ownerId, never a name lookup on a
  // reseed. Collaborators resolve within this list only.
  const ids: string[] = [list.ownerId]
  for (const person of PEOPLE.slice(1)) {
    ids.push(await ensurePerson(list.id, person, 'member'))
  }

  // Staggered timestamps so the activity feed reads like real history. The
  // span stays inside the 48-hour window so nothing lands in the future.
  const start = Date.now() - 48 * 3600_000
  const step = 4.5 * 3600_000
  const created = (i: number): Date => new Date(start + i * step)

  // Task ids are generated up front so the activity rows can reference them
  // without reading anything back, which lets the whole reset run as one
  // batch (neon-http executes a batch as a single transaction).
  const taskRows: (typeof tables.tasks.$inferInsert)[] = []
  const activityRows: (typeof tables.activity.$inferInsert)[] = []

  for (const [index, task] of TASKS.entries()) {
    const taskId = randomUUID()
    const createdAt = created(index)
    const completedAt = task.completedBy ? new Date(createdAt.getTime() + 4 * 3600_000) : null

    taskRows.push({
      id: taskId,
      listId: list.id,
      title: task.title,
      description: task.description ?? null,
      priority: task.priority,
      completed: Boolean(task.completedBy),
      dueDate: dueDate(task.due),
      assigneeId: task.assignee ? ids[PEOPLE.indexOf(task.assignee)] : null,
      position: index,
      createdBy: ids[PEOPLE.indexOf(task.by)],
      updatedBy: ids[PEOPLE.indexOf(task.completedBy ?? task.by)],
      createdAt,
      updatedAt: completedAt ?? createdAt,
    })

    activityRows.push({
      listId: list.id,
      taskId,
      actorId: ids[PEOPLE.indexOf(task.by)],
      kind: 'created',
      summary: task.title,
      createdAt,
    })

    if (completedAt && task.completedBy) {
      activityRows.push({
        listId: list.id,
        taskId,
        actorId: ids[PEOPLE.indexOf(task.completedBy)],
        kind: 'completed',
        summary: task.title,
        createdAt: completedAt,
      })
    }
  }

  await db.batch([
    db.delete(tables.tasks).where(eq(tables.tasks.listId, list.id)),
    db.delete(tables.activity).where(eq(tables.activity.listId, list.id)),
    db.insert(tables.tasks).values(taskRows),
    db.insert(tables.activity).values(activityRows),
  ])

  const completedCount = TASKS.filter((t) => t.completedBy).length
  console.log(`database: ${dbUrl.hostname}`)
  console.log(`seeded ${TASKS.length} tasks (${completedCount} completed) and ${ids.length} members`)
  console.log(`demo URL (prod): ${PROD_ORIGIN}/join/${list.inviteToken}`)
  const local = process.env.NEXT_PUBLIC_SITE_URL
  if (local && !local.includes('localhost')) {
    console.log(`demo URL (site):  ${local}/join/${list.inviteToken}`)
  }
  console.log('re-run any time: the invite token never changes; tasks and activity are reset.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
