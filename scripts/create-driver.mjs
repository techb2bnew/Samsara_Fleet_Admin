/**
 * Creates a driver you can sign into the mobile app with.
 *
 *   npm run create-driver
 *   npm run create-driver -- driver2@b2bsamsarafleet.com "Ravi Deshmukh"
 *
 * The normal way a driver gets an account is the invite-driver Edge Function,
 * which generates a password nobody sees and emails it. That is right for a
 * real fleet and useless for testing: you cannot sign in with a password you
 * were never told.
 *
 * So this does the same three steps with a password you choose, and prints it.
 * Safe to run repeatedly — it resets the password on an existing account rather
 * than failing or making a second driver.
 *
 * It also gives the driver a depot and a truck, because without those the app
 * has nothing to show: the vehicle picker reads the driver's depot, and the
 * duty screen refuses to go on duty with no truck signed on.
 *
 * Uses the secret key, which bypasses row-level security — creating an auth
 * user is something no signed-in user may do.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')

const [emailArg, nameArg] = process.argv.slice(2)

const DRIVER_EMAIL = (emailArg || 'driver@b2bsamsarafleet.com').trim().toLowerCase()
const DRIVER_PASSWORD = 'Driver@Fleet2026'
const DRIVER_NAME = (nameArg || 'Test Driver').trim()

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

async function allAuthUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die('listing auth users', error)
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}

const [firstName, ...restName] = DRIVER_NAME.split(/\s+/)
const lastName = restName.join(' ') || 'Driver'

console.log('')

/* ------------------------------------------------------------ organisation */

const { data: org, error: orgError } = await db
  .from('organizations')
  .select('id, name, timezone')
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle()

if (orgError) die('reading the organisation', orgError)
if (!org) {
  console.error('\n  No organisation yet. Run `npm run create-admin` first.\n')
  process.exit(1)
}

/* -------------------------------------------------------------------- depot */
// The vehicle picker in the app is scoped to the driver's depot, so a driver
// with no depot sees an empty list and cannot start a shift.

let { data: depot, error: depotReadError } = await db
  .from('fleets')
  .select('id, name, timezone')
  .eq('org_id', org.id)
  .is('deleted_at', null)
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle()

if (depotReadError) die('reading depots', depotReadError)

if (!depot) {
  const created = await db
    .from('fleets')
    .insert({
      org_id: org.id,
      name: 'Pune depot',
      code: 'PNQ',
      timezone: org.timezone || 'Asia/Kolkata',
    })
    .select('id, name, timezone')
    .single()
  if (created.error) die('creating a depot', created.error)
  depot = created.data
  console.log(`  depot        created  ${depot.name}`)
} else {
  console.log(`  depot        found    ${depot.name}`)
}

/* ------------------------------------------------------------------ vehicle */

/*
 * A truck nobody else is on. The schema allows one open assignment per vehicle
 * (dva_active_vehicle_idx), so grabbing the first truck would either fail or
 * take it off whoever is driving it. Neither is acceptable in a shared test
 * database — another driver quietly losing their truck is worse than making a
 * second one.
 */
const [trucks, openAssignments] = await Promise.all([
  db
    .from('vehicles')
    .select('id, name, plate')
    .eq('org_id', org.id)
    .eq('kind', 'truck')
    .is('deleted_at', null),
  db
    .from('driver_vehicle_assignments')
    .select('vehicle_id, driver_id')
    .eq('org_id', org.id)
    .is('ended_at', null),
])

if (trucks.error) die('reading vehicles', trucks.error)
if (openAssignments.error) die('reading assignments', openAssignments.error)

const takenByOthers = new Set(
  (openAssignments.data ?? [])
    .filter((a) => a.vehicle_id)
    .map((a) => a.vehicle_id),
)

let vehicle = (trucks.data ?? []).find((v) => !takenByOthers.has(v.id)) ?? null

if (!vehicle) {
  const created = await db
    .from('vehicles')
    .insert({
      org_id: org.id,
      fleet_id: depot.id,
      kind: 'truck',
      name: `Truck ${200 + (trucks.data ?? []).length}`,
      plate: `MH12AB${1000 + (trucks.data ?? []).length}`,
      make: 'Tata',
      model: 'Signa 4825',
      year: 2022,
      status: 'active',
      odometer_km: 142500,
    })
    .select('id, name, plate')
    .single()
  if (created.error) die('creating a vehicle', created.error)
  vehicle = created.data
  console.log(`  vehicle      created  ${vehicle.name}  (every other truck is taken)`)
} else {
  // Make sure it is at this depot, or the picker will not show it.
  await db.from('vehicles').update({ fleet_id: depot.id }).eq('id', vehicle.id)
  console.log(`  vehicle      free     ${vehicle.name}`)
}

/* -------------------------------------------------------------- auth account */

const existing = (await allAuthUsers()).find(
  (u) => (u.email ?? '').toLowerCase() === DRIVER_EMAIL,
)

let userId
if (existing) {
  const { error } = await db.auth.admin.updateUserById(existing.id, {
    password: DRIVER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DRIVER_NAME },
  })
  if (error) die('resetting the password', error)
  userId = existing.id
  console.log(`  account      reset    ${DRIVER_EMAIL}`)
} else {
  const { data, error } = await db.auth.admin.createUser({
    email: DRIVER_EMAIL,
    password: DRIVER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DRIVER_NAME },
  })
  if (error) die('creating the account', error)
  userId = data.user.id
  console.log(`  account      created  ${DRIVER_EMAIL}`)
}

// The profile row. loadProfile in the app reads drivers, but the users row is
// what the rest of the schema joins to for a name.
const profile = await db
  .from('users')
  .upsert({ id: userId, email: DRIVER_EMAIL, full_name: DRIVER_NAME }, { onConflict: 'id' })
if (profile.error) die('writing the profile row', profile.error)

/* ------------------------------------------------------------------- driver */

let { data: driver, error: driverReadError } = await db
  .from('drivers')
  .select('id')
  .eq('org_id', org.id)
  .eq('email', DRIVER_EMAIL)
  .is('deleted_at', null)
  .maybeSingle()

if (driverReadError) die('reading the driver', driverReadError)

if (driver) {
  const { error } = await db
    .from('drivers')
    .update({
      user_id: userId,
      fleet_id: depot.id,
      first_name: firstName,
      last_name: lastName,
      status: 'active',
      timezone: depot.timezone || 'Asia/Kolkata',
    })
    .eq('id', driver.id)
  if (error) die('linking the driver', error)
  console.log(`  driver       updated  ${DRIVER_NAME}`)
} else {
  const created = await db
    .from('drivers')
    .insert({
      org_id: org.id,
      fleet_id: depot.id,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email: DRIVER_EMAIL,
      status: 'active',
      timezone: depot.timezone || 'Asia/Kolkata',
    })
    .select('id')
    .single()
  if (created.error) die('creating the driver', created.error)
  driver = created.data
  console.log(`  driver       created  ${DRIVER_NAME}`)
}

/* --------------------------------------------------------------- assignment */
// Signed on to the truck already, so the app opens on a usable Duty screen
// instead of the picker. The driver can change it in the app.

const openAssignment = await db
  .from('driver_vehicle_assignments')
  .select('id')
  .eq('driver_id', driver.id)
  .is('ended_at', null)
  .maybeSingle()

if (openAssignment.error) die('reading the assignment', openAssignment.error)

if (openAssignment.data) {
  // Their own previous shift. Closed rather than left open, so the insert below
  // does not trip the one-open-assignment-per-driver rule.
  await db
    .from('driver_vehicle_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', openAssignment.data.id)
}

{
  const { error } = await db.from('driver_vehicle_assignments').insert({
    org_id: org.id,
    driver_id: driver.id,
    vehicle_id: vehicle.id,
    started_at: new Date().toISOString(),
  })
  if (error) die('signing the driver on to the truck', error)
  console.log(`  assignment   created  ${DRIVER_NAME} → ${vehicle.name}`)
}

console.log(`
  Sign into the mobile app with:

    email     ${DRIVER_EMAIL}
    password  ${DRIVER_PASSWORD}

  Depot ${depot.name} · truck ${vehicle.name} (${vehicle.plate})

  This is a test account with a password in the repo. Do not use it for a real
  driver — real ones get a generated password by email from the invite flow.
`)
