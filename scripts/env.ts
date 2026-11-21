import { resolve } from 'node:path'
import { config } from 'dotenv'

// Must be the first import in any script that touches src/db: the neon
// client reads DATABASE_URL at module load, before any script body runs.
// An explicit DATABASE_URL in the environment wins over .env.local, so
//   DATABASE_URL="postgresql://..." npm run demo:seed
// seeds a specific database without editing anything.
config({
  path: [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')],
  quiet: true,
})

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env.local, or run with\n' +
      '  DATABASE_URL="postgresql://..." npm run demo:seed',
  )
  process.exit(1)
}
