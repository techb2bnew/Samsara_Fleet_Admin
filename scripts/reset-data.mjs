/**
 * Empties the database of everything except what the admin needs to sign in.
 *
 *   npm run reset-data          show what would go, change nothing
 *   npm run reset-data -- --yes actually delete
 *
 * Kept:
 *   organizations   the admin's own organisation - deleting it revokes their
 *                   role grant and locks them out
 *   users           the admin
 *   user_roles      the admin's fleet_admin grant
 *   roles           the seven system roles
 *                   (their per-module permissions travel with them, on the
 *                   roles rows themselves)
 *
 * Everything else goes: drivers, vehicles, documents, work orders, routes,
 * forms, messages, safety events, courses, hours records, and
 * any organisation that is not the admin's - which also removes the tenants the
 * RLS suite creates.
 *
 * Uses the secret key, so row-level security does not apply. It is also exempt
 * from the append-only triggers on duty_status_events and audit_log, which is
 * exactly why that exemption exists.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const KEEP_ORG = 'Northline Haulage'
const KEEP_ADMIN_EMAIL = 'admin@b2bsamsarafleet.com'

const APPLY = process.argv.includes('--yes')

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const appEnv = readEnvFile(path.join(ROOT, '.env.local'))
const dbEnv = readEnvFile(path.join(ROOT, 'supabase', '.env'))

const URL = appEnv.VITE_SUPABASE_URL
const SECRET = dbEnv.SUPABASE_SECRET_KEY

if (!URL || !SECRET) {
  console.error(
    '\n  Missing config.\n' +
      '  Need VITE_SUPABASE_URL in .env.local and SUPABASE_SECRET_KEY in supabase/.env\n',
  )
  process.exit(1)
}

const db = createClient(URL, SECRET, { auth: { persistSession: false } })

/**
 * Child tables first, parents last.
 *
 * Most of these would cascade from organizations anyway. They are listed so the
 * dry run can say how many rows each holds - "this will delete 12 drivers" is a
 * decision, "this will delete an organisation" is a shrug.
 */
const TABLES = [
  'route_stops',
  'routes',
  'form_submissions',
  'defects',
  'forms',
  'documents',
  'messages',
  'course_assignments',
  'courses',
  'safety_events',
  'duty_status_events',
  'hos_daily_logs',
  'work_orders',
  'maintenance_schedules',
  'driver_vehicle_assignments',
  'driver_devices',
  'driver_settings',
  'drivers',
  'vehicles',
  'invitations',
  'alert_rules',
  'audit_log',
  'fleets',
]

async function countOf(table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  return error ? null : (count ?? 0)
}

console.log('')

/* ------------------------------------------------------------ what is kept */

const { data: keepOrg, error: orgError } = await db
  .from('organizations')
  .select('id, name')
  .eq('name', KEEP_ORG)
  .maybeSingle()

if (orgError) {
  console.error(`  Could not read organisations: ${orgError.message}\n`)
  process.exit(1)
}
if (!keepOrg) {
  console.error(
    `  No organisation named "${KEEP_ORG}".\n` +
      '  Run `npm run create-admin` first, or this would empty everything.\n',
  )
  process.exit(1)
}

const { data: otherOrgs } = await db
  .from('organizations')
  .select('id, name')
  .neq('id', keepOrg.id)

/* -------------------------------------------------------------- the report */

console.log(`  Keeping   organisation  ${keepOrg.name}`)
console.log(`            admin         ${KEEP_ADMIN_EMAIL}`)
console.log('            roles and their permissions\n')

let total = 0
const present = []
for (const table of TABLES) {
  const n = await countOf(table)
  if (n === null || n === 0) continue
  present.push([table, n])
  total += n
}

if (otherOrgs?.length) {
  console.log('  Removing  other organisations:')
  for (const org of otherOrgs) console.log(`              ${org.name}`)
  console.log('')
}

if (present.length === 0 && !otherOrgs?.length) {
  console.log('  Nothing to remove. The database is already clean.\n')
  process.exit(0)
}

console.log('  Removing  rows:')
for (const [table, n] of present) {
  console.log(`              ${String(table).padEnd(28)} ${n}`)
}
console.log(`\n            ${total} rows in total\n`)

if (!APPLY) {
  console.log('  Nothing was deleted. To go ahead:\n')
  console.log('    npm run reset-data -- --yes\n')
  process.exit(0)
}

/* ------------------------------------------------------------- the deleting */

// PostgREST refuses an unfiltered delete, on purpose. `not id is null` matches
// every row while still being a filter.
for (const table of TABLES) {
  const { error } = await db.from(table).delete().not('id', 'is', null)
  // A table that no longer exists is fine - it is listed for older databases.
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    console.error(`  Failed clearing ${table}: ${error.message}`)
    process.exit(1)
  }
}

for (const org of otherOrgs ?? []) {
  const { error } = await db.from('organizations').delete().eq('id', org.id)
  if (error) {
    console.error(`  Failed removing organisation ${org.name}: ${error.message}`)
    process.exit(1)
  }
}

// Any auth account that is not the admin. The console has one way in while the
// fleet is being set up.
const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
for (const user of authUsers?.users ?? []) {
  if (user.email?.toLowerCase() === KEEP_ADMIN_EMAIL) continue
  await db.auth.admin.deleteUser(user.id).catch(() => undefined)
}

/* ------------------------------------------------------------ what is left */

console.log('  Done. What is left:\n')
for (const table of ['organizations', 'users', 'user_roles', 'roles']) {
  console.log(`    ${String(table).padEnd(16)} ${await countOf(table)}`)
}
console.log('')
