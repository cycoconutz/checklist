# Checklist

Checklist is a full-stack collaborative checklist app: create a list, share the invite link, and everyone edits the same tasks in one place. It has no passwords; a participant just picks a display name and joins via invite link or code. Tasks carry a priority, due date, description, and assignee, and every change is attributed, sortable, filterable, and pushed to other members' devices. Deployed at https://checklist-cyco.vercel.app.

## Features

- No-password collaboration: create a list or join one via invite link (`/join/<token>`) or invite code; a display name is the whole sign-up
- Tasks with title, description, priority (high / medium / low), due date, optional assignee, and completed state
- Drag-and-drop custom ordering (@dnd-kit); the manual order is preserved even while sorted by priority, due date, assignee, title, or recent activity
- Filter by status (all / active / done), priority, and assignee (anyone / me / unassigned / specific member)
- Web Push notifications (VAPID) when a task is added, changed, completed, reopened, or deleted, with per-member per-event toggles; the actor is never notified of their own change
- Per-list activity feed recording who created, updated, completed, reopened, or deleted each task, kept intact after a task is deleted
- List settings for owners: rotate the invite token (revokes all outstanding invite links) and manage members
- Web app manifest and service worker so the app installs on a phone
- Light and dark theme, with toast feedback on mutations
- `npm run demo:seed` seeds an idempotent public demo list for the portfolio

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Data | Drizzle ORM on Neon Postgres (`@neondatabase/serverless`, HTTP driver) |
| Migrations | drizzle-kit (SQL migrations in `drizzle/`) |
| UI | Tailwind CSS v4, shadcn-style components on Base UI, lucide-react icons |
| Drag and drop | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers` |
| Notifications | `web-push` (VAPID), service worker |
| Client data | SWR, sonner toasts, next-themes |
| Lint | ESLint (`eslint-config-next`) |

## Getting started

Prerequisites: Node.js 20.9+ and a Neon Postgres database (any Postgres reachable over HTTP works with the current driver).

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

- `DATABASE_URL`: Neon Postgres connection string (pooled endpoint, `sslmode=require`)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: generate once with `npx web-push generate-vapid-keys --json`
- `VAPID_SUBJECT`: contact URI for the push service, e.g. `mailto:you@example.com`
- `NEXT_PUBLIC_SITE_URL`: public origin of the deployment, no trailing slash

Push is optional in development: when the VAPID keys are unset, the app skips notifications and everything else works.

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run demo:seed  # optional: seed the public demo list
```

## Data layer

The Drizzle schema lives in `src/db/schema.ts` and covers seven tables:

- `users` (display name and avatar color; there are no passwords)
- `sessions` (hashed cookie tokens, expiry; the raw token never touches the database)
- `lists` (owner plus a secret `invite_token` that also forms the join URL)
- `list_members` (owner/member role and the three notification toggles)
- `tasks` (priority enum, due date, nullable assignee, manual `position`)
- `push_subscriptions` (one row per browser endpoint, unique on endpoint)
- `activity` (per-list event log; entries survive task deletion)

Generated SQL migrations are in `drizzle/`, configured by `drizzle.config.ts` (dialect `postgresql`, schema `src/db/schema.ts`). There are no dedicated npm scripts for migrations; use drizzle-kit directly:

```bash
npx drizzle-kit generate   # after editing src/db/schema.ts
npx drizzle-kit migrate   # apply pending migrations from drizzle/
```
