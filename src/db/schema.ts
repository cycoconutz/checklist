import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Declared high -> low so that `ORDER BY priority ASC` yields high-to-low
// without needing a CASE expression. Postgres orders enums by declaration order.
export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low'])

export const memberRoleEnum = pgEnum('member_role', ['owner', 'member'])

export const activityKindEnum = pgEnum('activity_kind', [
  'created',
  'updated',
  'completed',
  'reopened',
  'deleted',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // sha256 of the cookie token. The raw token never touches the database.
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sessions_token_hash_idx').on(t.tokenHash)],
)

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // 32-char base64url secret. Regenerating revokes every outstanding invite link.
    inviteToken: text('invite_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('lists_invite_token_idx').on(t.inviteToken)],
)

export const listMembers = pgTable(
  'list_members',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    notifyOnCreate: boolean('notify_on_create').notNull().default(true),
    notifyOnUpdate: boolean('notify_on_update').notNull().default(true),
    notifyOnDelete: boolean('notify_on_delete').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.userId] }),
    index('list_members_user_idx').on(t.userId),
  ],
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: priorityEnum('priority').notNull().default('medium'),
    completed: boolean('completed').notNull().default(false),
    dueDate: date('due_date'),
    // Nullable: an unassigned task keeps its history when a member leaves.
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    // Manual ordering. Always maintained on drag regardless of the active sort mode,
    // so switching back to "manual" restores the arrangement.
    position: integer('position').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_list_completed_idx').on(t.listId, t.completed),
    index('tasks_list_priority_idx').on(t.listId, t.priority),
    index('tasks_list_position_idx').on(t.listId, t.position),
  ],
)

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Unique so re-subscribing the same browser updates rather than duplicates.
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint),
    index('push_subscriptions_user_idx').on(t.userId),
  ],
)

export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    // Kept after the task is deleted so the feed still shows what happened.
    taskId: uuid('task_id'),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: activityKindEnum('kind').notNull(),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_list_created_idx').on(t.listId, t.createdAt)],
)

export type User = typeof users.$inferSelect
export type List = typeof lists.$inferSelect
export type ListMember = typeof listMembers.$inferSelect
export type Task = typeof tasks.$inferSelect
export type PushSubscription = typeof pushSubscriptions.$inferSelect
export type Priority = (typeof priorityEnum.enumValues)[number]
export type ActivityKind = (typeof activityKindEnum.enumValues)[number]