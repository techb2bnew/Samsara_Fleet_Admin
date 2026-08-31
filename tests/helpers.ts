/**
 * Test harness for the row-level-security suite.
 *
 * The point of these tests is to prove tenant isolation against the real API,
 * not against a mock. So they:
 *
 *   1. use the SECRET key to build two complete, separate companies
 *   2. sign in as a real user from each company, using the PUBLISHABLE key
 *      - exactly what the browser and the phone app use
 *   3. assert that each user can reach their own data and nothing else
 *
 * Everything created is prefixed with `rlstest-` and torn down afterwards.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/supabase/database'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
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

export const SUPABASE_URL = appEnv.VITE_SUPABASE_URL
export const PUBLISHABLE_KEY = appEnv.VITE_SUPABASE_PUBLISHABLE_KEY
export const SECRET_KEY = dbEnv.SUPABASE_SECRET_KEY

export function assertConfig() {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL (.env.local)')
  if (!PUBLISHABLE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (.env.local)')
  if (!SECRET_KEY) missing.push('SUPABASE_SECRET_KEY (supabase/.env)')
  if (missing.length) {
    throw new Error(`Cannot run RLS tests. Missing:\n  - ${missing.join('\n  - ')}`)
  }
}

/** Admin client. Bypasses RLS. Used only to build and tear down fixtures. */
export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** A signed-out client, exactly as an unauthenticated visitor would have. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** A client authenticated as a real user. This is what RLS actually sees. */
export async function signedInClient(
  email: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

export const TEST_PREFIX = 'rlstest'
export const TEST_PASSWORD = 'Rls-Test-Password-9147!'

export type Company = {
  orgId: string
  fleetId: string
  adminUserId: string
  adminEmail: string
  dispatcherUserId: string
  dispatcherEmail: string
  mechanicUserId: string
  mechanicEmail: string
  /** A driver who has accepted their invitation and can sign into the app. */
  driverUserId: string
  driverEmail: string
  driverId: string
  /** A second driver in the same company, used to prove drivers cannot see colleagues. */
  colleagueDriverId: string
  vehicleId: string
}

/**
 * Builds one complete company: an organisation, a fleet, a fleet admin and a
 * dispatcher. Created with the secret key, so RLS does not apply here.
 */
export async function createCompany(
  admin: SupabaseClient<Database>,
  label: string,
  runId: string,
): Promise<Company> {
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name: `${TEST_PREFIX} ${label} ${runId}`, country_code: 'US', timezone: 'UTC' })
    .select('id')
    .single()
  if (orgErr) throw new Error(`Could not create org ${label}: ${orgErr.message}`)

  const { data: fleet, error: fleetErr } = await admin
    .from('fleets')
    .insert({ org_id: org.id, name: `${TEST_PREFIX} ${label} depot` })
    .select('id')
    .single()
  if (fleetErr) throw new Error(`Could not create fleet for ${label}: ${fleetErr.message}`)

  const mkUser = async (roleKey: string) => {
    const email = `${TEST_PREFIX}-${label}-${roleKey}-${runId}@example.com`.toLowerCase()

    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (userErr) throw new Error(`Could not create user ${email}: ${userErr.message}`)

    const { data: role, error: roleErr } = await admin
      .from('roles')
      .select('id')
      .eq('key', roleKey)
      .is('org_id', null)
      .single()
    if (roleErr) throw new Error(`Could not find system role ${roleKey}: ${roleErr.message}`)

    const { error: grantErr } = await admin.from('user_roles').insert({
      user_id: created.user.id,
      org_id: org.id,
      role_id: role.id,
    })
    if (grantErr) throw new Error(`Could not grant ${roleKey} to ${email}: ${grantErr.message}`)

    return { id: created.user.id, email }
  }

  const adminUser = await mkUser('fleet_admin')
  const dispatcher = await mkUser('dispatcher')
  const mechanic = await mkUser('mechanic')

  // A driver who has signed into the app. Drivers get no console role - their
  // access comes entirely from drivers.user_id, which is what
  // current_driver_id() resolves.
  const driverEmail = `${TEST_PREFIX}-${label}-driver-${runId}@example.com`.toLowerCase()
  const { data: driverAuth, error: driverAuthErr } = await admin.auth.admin.createUser({
    email: driverEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (driverAuthErr) throw new Error(`Could not create driver user: ${driverAuthErr.message}`)

  const { data: driverRows, error: driverErr } = await admin
    .from('drivers')
    .insert([
      {
        org_id: org.id,
        fleet_id: fleet.id,
        user_id: driverAuth.user.id,
        first_name: 'Test',
        last_name: `Driver ${label}`,
        timezone: 'UTC',
      },
      {
        org_id: org.id,
        fleet_id: fleet.id,
        first_name: 'Colleague',
        last_name: `Driver ${label}`,
        timezone: 'UTC',
      },
    ])
    .select('id, user_id')
  if (driverErr) throw new Error(`Could not create drivers for ${label}: ${driverErr.message}`)

  const signedInDriver = driverRows!.find((d) => d.user_id !== null)!
  const colleague = driverRows!.find((d) => d.user_id === null)!

  const { data: vehicle, error: vehicleErr } = await admin
    .from('vehicles')
    .insert({
      org_id: org.id,
      fleet_id: fleet.id,
      plate: `${TEST_PREFIX}-${label}-${runId}`.toUpperCase().slice(0, 20),
      name: `${TEST_PREFIX} truck ${label}`,
    })
    .select('id')
    .single()
  if (vehicleErr) throw new Error(`Could not create vehicle for ${label}: ${vehicleErr.message}`)

  return {
    orgId: org.id,
    fleetId: fleet.id,
    adminUserId: adminUser.id,
    adminEmail: adminUser.email,
    dispatcherUserId: dispatcher.id,
    dispatcherEmail: dispatcher.email,
    mechanicUserId: mechanic.id,
    mechanicEmail: mechanic.email,
    driverUserId: driverAuth.user.id,
    driverEmail,
    driverId: signedInDriver.id,
    colleagueDriverId: colleague.id,
    vehicleId: vehicle.id,
  }
}

/** Removes everything a run created. Organisations cascade to fleets and grants. */
export async function destroyCompany(admin: SupabaseClient<Database>, company: Company) {
  for (const userId of [
    company.adminUserId,
    company.dispatcherUserId,
    company.mechanicUserId,
    company.driverUserId,
  ]) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
  }
  await admin.from('organizations').delete().eq('id', company.orgId)
}
