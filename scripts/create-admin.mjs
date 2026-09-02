/**
 * Creates the one admin account the console signs in with.
 *
 *   npm run create-admin
 *
 * Makes an organisation if none exists, then an auth user with the fleet_admin
 * role in it. Safe to run repeatedly: it updates the existing account and resets
 * its password rather than failing or making a second one.
 *
 * Any other seeded accounts are removed, so there is exactly one way in while
 * the sign-in flow is being tested.
 *
 * Uses the secret key, which bypasses row-level security. That is required
 * here: creating the first organisation is something no signed-in user is
 * allowed to do, by design.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')

const ADMIN_EMAIL = 'admin@b2bsamsarafleet.com'
const ADMIN_PASSWORD = 'Admin@Fleet2026'
const ADMIN_NAME = 'Fleet Administrator'
const ORG_NAME = 'Northline Haulage'

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

function die(step, error) {
  console.error(`\n  Failed at: ${step}\n  ${error.message}\n`)
  process.exit(1)
}

/** listUsers is paged, so walk it rather than trusting the first page. */
async function allAuthUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die('listing auth users', error)
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}

console.log('')

/* ------------------------------------------------------------- organisation */

let { data: org, error: orgReadError } = await db
  .from('organizations')
  .select('id, name')
  .eq('name', ORG_NAME)
  .maybeSingle()
if (orgReadError) die('reading organisation', orgReadError)

if (!org) {
  const created = await db
    .from('organizations')
    .insert({ name: ORG_NAME, country_code: 'IN', timezone: 'Asia/Kolkata' })
    .select('id, name')
    .single()
  if (created.error) die('creating organisation', created.error)
  org = created.data
  console.log(`  created organisation ${ORG_NAME}`)
} else {
  console.log(`  organisation ${ORG_NAME} already exists`)
}

/* --------------------------------------------------------------- admin role */

const { data: adminRole, error: roleError } = await db
  .from('roles')
  .select('id')
  .eq('key', 'fleet_admin')
  .is('org_id', null)
  .single()
if (roleError) die('reading the fleet_admin role', roleError)

/* -------------------------------------------------------------- admin user */

const existingUsers = await allAuthUsers()
let admin = existingUsers.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL)

if (admin) {
  const updated = await db.auth.admin.updateUserById(admin.id, {
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  })
  if (updated.error) die('updating the admin account', updated.error)
  console.log('  admin account already existed — password reset')
} else {
  const created = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  })
  if (created.error) die('creating the admin account', created.error)
  admin = created.data.user
  console.log('  created admin account')
}

// The auth trigger writes the profile row; this fills in the display name.
const profile = await db
  .from('users')
  .upsert({ id: admin.id, email: ADMIN_EMAIL, full_name: ADMIN_NAME }, { onConflict: 'id' })
if (profile.error) die('writing the admin profile', profile.error)

const { data: grant, error: grantReadError } = await db
  .from('user_roles')
  .select('id')
  .eq('user_id', admin.id)
  .eq('org_id', org.id)
  .eq('role_id', adminRole.id)
  .is('revoked_at', null)
  .maybeSingle()
if (grantReadError) die('reading role grants', grantReadError)

if (!grant) {
  const granted = await db
    .from('user_roles')
    .insert({ user_id: admin.id, org_id: org.id, role_id: adminRole.id })
  if (granted.error) die('granting fleet_admin', granted.error)
}
console.log('  fleet_admin role granted')

/* ------------------------------------------------- remove any other accounts */

const others = existingUsers.filter((u) => u.email?.toLowerCase() !== ADMIN_EMAIL)
for (const user of others) {
  await db.auth.admin.deleteUser(user.id).catch(() => undefined)
}
if (others.length > 0) {
  console.log(`  removed ${others.length} other seeded account(s)`)
}

console.log(`
  Done. Sign in with:

    Email     ${ADMIN_EMAIL}
    Password  ${ADMIN_PASSWORD}

  Set VITE_USE_MOCK_DATA=false in .env.local and restart the dev server
  to use it. With the flag on true, the console stays on mock data.
`)
