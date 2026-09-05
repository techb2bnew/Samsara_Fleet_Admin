/**
 * Puts a small, believable fleet into the database.
 *
 *   npm run seed-demo
 *
 * This exists because a wired screen cannot be checked against an empty table.
 * Every module switched over from here needs a few real rows to prove the query,
 * the empty state and the formatting — and typing them by hand each time is how
 * you end up testing against data that could never occur.
 *
 * Deliberately small: one depot, six trucks, one trailer, six drivers. Enough to
 * see a list, a selection, a marker and an empty case; not so much that reading
 * the console tells you nothing.
 *
 * Safe to run repeatedly — it clears its own rows first. `npm run reset-data`
 * removes everything it made.
 *
 * Uses the secret key, so row-level security does not apply here.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
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

/** Timestamps are relative to the run, so "8 sec ago" stays true. */
const now = Date.now()
const minutesAgo = (m) => new Date(now - m * 60_000).toISOString()
const secondsAgo = (s) => new Date(now - s * 1000).toISOString()

console.log('')

/* ------------------------------------------------------------ organisation */

const { data: org, error: orgError } = await db
  .from('organizations')
  .select('id')
  .eq('name', ORG_NAME)
  .maybeSingle()
if (orgError) die('reading the organisation', orgError)
if (!org) {
  console.error(
    `  No organisation named "${ORG_NAME}".\n  Run \`npm run create-admin\` first.\n`,
  )
  process.exit(1)
}

/* --------------------------------------------------------------- clear out */
// Child rows first. Anything this script wrote before goes, so running it twice
// does not double the fleet.

for (const table of ['documents', 'driver_vehicle_assignments', 'drivers', 'vehicles', 'fleets']) {
  const { error } = await db.from(table).delete().eq('org_id', org.id)
  if (error) die(`clearing ${table}`, error)
}

/* ------------------------------------------------------------------- depot */

const { data: fleet, error: fleetError } = await db
  .from('fleets')
  .insert({
    org_id: org.id,
    name: 'Pune depot',
    address: 'Hadapsar Industrial Estate, Pune, Maharashtra',
    latitude: 18.5089,
    longitude: 73.9260,
    timezone: 'Asia/Kolkata',
  })
  .select('id')
  .single()
if (fleetError) die('creating the depot', fleetError)

/* ---------------------------------------------------------------- vehicles */
/*
 * Positions are real coordinates around Pune and Nashik, and the mix is
 * deliberate: some moving, one idling in a yard, one parked, one that has not
 * reported for hours, and one that has never reported at all. Those last two
 * are the cases a live map gets wrong.
 */

const VEHICLES = [
  { name: 'Truck 214', plate: 'MH 12 AB 1214', make: 'Tata',    model: 'Signa 4018', year: 2021, lat: 18.3742, lng: 73.8570, speed: 62, ignition: true,  at: secondsAgo(8),      odo: 214_500 },
  { name: 'Truck 187', plate: 'MH 12 CD 0187', make: 'Ashok Leyland', model: '2820',  year: 2020, lat: 18.5089, lng: 73.9260, speed: 48, ignition: true,  at: secondsAgo(12),     odo: 331_200 },
  { name: 'Truck 155', plate: 'MH 12 EF 0155', make: 'Tata',    model: 'Prima 3138',  year: 2022, lat: 18.4529, lng: 74.0210, speed: 71, ignition: true,  at: secondsAgo(5),      odo: 128_900 },
  // Reporting, stopped, engine running — idling.
  { name: 'Truck 133', plate: 'MH 15 GH 0133', make: 'BharatBenz', model: '2823R',    year: 2019, lat: 19.9975, lng: 73.7898, speed: 0,  ignition: true,  at: minutesAgo(1),      odo: 402_750 },
  // Reporting, stopped, engine off — parked up.
  { name: 'Truck 202', plate: 'MH 12 IJ 0202', make: 'Tata',    model: 'Signa 3518',  year: 2021, lat: 18.4880, lng: 73.8700, speed: 0,  ignition: false, at: minutesAgo(3),      odo: 187_300 },
  // Quiet for hours — should read as offline, not parked.
  { name: 'Truck 108', plate: 'MH 15 KL 0108', make: 'Ashok Leyland', model: '3520',  year: 2018, lat: 19.9615, lng: 73.7600, speed: 0,  ignition: false, at: minutesAgo(260),    odo: 511_400 },
  // Never reported: a truck the office added that has no device in it yet.
  { name: 'Truck 176', plate: 'MH 12 MN 0176', make: 'Tata',    model: 'Ultra 1918',  year: 2023, lat: null,    lng: null,    speed: null, ignition: null, at: null,             odo: 12_050 },
]

const { data: vehicles, error: vehicleError } = await db
  .from('vehicles')
  .insert(
    VEHICLES.map((v) => ({
      org_id: org.id,
      fleet_id: fleet.id,
      kind: 'truck',
      name: v.name,
      plate: v.plate,
      make: v.make,
      model: v.model,
      year: v.year,
      status: v.name === 'Truck 108' ? 'out_of_service' : 'active',
      odometer_km: v.odo,
      odometer_at: v.at ?? minutesAgo(600),
      last_latitude: v.lat,
      last_longitude: v.lng,
      last_speed_kph: v.speed,
      last_ignition_on: v.ignition,
      last_position_at: v.at,
    })),
  )
  .select('id, name')
if (vehicleError) die('creating vehicles', vehicleError)

// A trailer, to prove the map leaves them off: no engine, no position.
const { error: trailerError } = await db.from('vehicles').insert({
  org_id: org.id,
  fleet_id: fleet.id,
  kind: 'trailer',
  name: 'Trailer T-12',
  plate: 'MH 12 TR 0092',
  make: 'Flatbed',
  model: '40ft',
  year: 2020,
})
if (trailerError) die('creating the trailer', trailerError)

/* ----------------------------------------------------------------- drivers */

/*
 * Licence expiries are spread on purpose: one already expired, one inside the
 * 60-day warning window, the rest years out, and one driver with no licence on
 * file at all. Those are the four states the roster and the dashboard have to
 * tell apart.
 */
const DRIVERS = [
  { first: 'Ravi',  last: 'Deshmukh',  employee: 'NL-104', truck: 'Truck 214', licence: '2029-03-14' },
  { first: 'Amit',  last: 'Verma',     employee: 'NL-118', truck: 'Truck 187', licence: '2031-03-02' },
  { first: 'Lata',  last: 'Kulkarni',  employee: 'NL-121', truck: 'Truck 155', licence: '2030-01-17' },
  // Inside the warning window.
  { first: 'Sunita', last: 'Rao',      employee: 'NL-133', truck: 'Truck 133', licence: '2026-09-25' },
  // Already lapsed — this driver is not legal to drive.
  { first: 'Dev',   last: 'Singh',     employee: 'NL-140', truck: 'Truck 202', licence: '2026-08-20' },
  // No truck and no licence on file: the two empty cases.
  { first: 'Neha',  last: 'Joshi',     employee: 'NL-152', truck: null,        licence: null },
]

const { data: drivers, error: driverError } = await db
  .from('drivers')
  .insert(
    DRIVERS.map((d) => ({
      org_id: org.id,
      fleet_id: fleet.id,
      first_name: d.first,
      last_name: d.last,
      employee_number: d.employee,
      email: `${d.first.toLowerCase()}@northline.example`,
      home_terminal: 'Pune depot',
      timezone: 'Asia/Kolkata',
      status: 'active',
      hired_on: '2024-04-01',
    })),
  )
  .select('id, first_name, last_name')
if (driverError) die('creating drivers', driverError)

/* -------------------------------------------------------------- assignments */

const vehicleByName = new Map(vehicles.map((v) => [v.name, v.id]))
const driverByName = new Map(drivers.map((d) => [`${d.first_name} ${d.last_name}`, d.id]))

const assignments = DRIVERS.filter((d) => d.truck).map((d) => ({
  org_id: org.id,
  driver_id: driverByName.get(`${d.first} ${d.last}`),
  vehicle_id: vehicleByName.get(d.truck),
  started_at: minutesAgo(400),
}))

const { error: assignError } = await db.from('driver_vehicle_assignments').insert(assignments)
if (assignError) die('assigning drivers to vehicles', assignError)

/* ------------------------------------------------------------------ licences */
// A licence is a document, not a column on the driver — a renewal adds a row and
// the lapsed one stays on file for an audit.

const licences = DRIVERS.filter((d) => d.licence).map((d) => ({
  org_id: org.id,
  category: 'compliance',
  driver_id: driverByName.get(`${d.first} ${d.last}`),
  doc_type: 'licence',
  reference: `DL-${d.employee}`,
  issuing_authority: 'Maharashtra RTO',
  expires_on: d.licence,
}))

const { error: licenceError } = await db.from('documents').insert(licences)
if (licenceError) die('filing licences', licenceError)

console.log(`  ${VEHICLES.length} trucks + 1 trailer`)
console.log(`  ${DRIVERS.length} drivers, ${assignments.length} on a vehicle`)
console.log(`  ${licences.length} licences on file (1 lapsed, 1 expiring soon)`)
console.log(`
  Positions include the awkward cases on purpose:

    Truck 133   stopped, engine running   -> idle
    Truck 202   stopped, engine off       -> resting
    Truck 108   quiet for 4 hours         -> offline
    Truck 176   never reported            -> no position
    Trailer T-12                          -> not on the map at all

  Reload the console to see it.
  npm run reset-data removes all of this.
`)
