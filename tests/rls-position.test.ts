/**
 * report_position: the one write a driver's phone makes to a vehicle.
 *
 * The driver app cannot touch public.vehicles — `vehicles_write` is fleet_admin
 * only, and it has to stay that way, because row-level security grants a whole
 * row and that row holds the odometer. So the phone calls a security definer
 * function instead, and everything below is about proving that function is a
 * narrow door rather than a hole in the wall:
 *
 *   - it moves only the vehicle the caller is signed on to
 *   - it moves nothing at all for a driver with no vehicle signed on
 *   - it cannot be aimed at another company's vehicle, because it takes no
 *     vehicle argument to aim
 *   - it leaves everything except the five position columns alone
 *   - a replayed offline queue cannot move the map backwards
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/supabase/database'
import {
  adminClient,
  anonClient,
  assertConfig,
  createCompany,
  destroyCompany,
  signedInClient,
  TEST_PASSWORD,
  type Company,
} from './helpers'

const runId = Math.random().toString(36).slice(2, 8)

let admin: SupabaseClient<Database>
let acme: Company
let globex: Company

let acmeAdmin: SupabaseClient<Database>
let acmeDriver: SupabaseClient<Database>
let globexDriver: SupabaseClient<Database>

/** Puts the driver in their company's vehicle, the way the app does at shift start. */
async function signOn(company: Company, driverId: string, vehicleId: string) {
  await admin
    .from('driver_vehicle_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .is('ended_at', null)

  await admin.from('driver_vehicle_assignments').insert({
    org_id: company.orgId,
    driver_id: driverId,
    vehicle_id: vehicleId,
    started_at: new Date().toISOString(),
  })
}

async function signOff(driverId: string) {
  await admin
    .from('driver_vehicle_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .is('ended_at', null)
}

/** Reads a vehicle past RLS, so the assertions see what was really stored. */
async function readVehicle(vehicleId: string) {
  const { data } = await admin
    .from('vehicles')
    .select('last_latitude, last_longitude, last_speed_kph, last_heading_deg, last_ignition_on, last_position_at, plate, odometer_km, status')
    .eq('id', vehicleId)
    .single()
  return data
}

async function clearPosition(vehicleId: string) {
  await admin
    .from('vehicles')
    .update({
      last_latitude: null,
      last_longitude: null,
      last_speed_kph: null,
      last_heading_deg: null,
      last_ignition_on: null,
      last_position_at: null,
    })
    .eq('id', vehicleId)
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'posacme', runId)
  globex = await createCompany(admin, 'posglobex', runId)

  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  acmeDriver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
  globexDriver = await signedInClient(globex.driverEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  if (acme) await destroyCompany(admin, acme)
  if (globex) await destroyCompany(admin, globex)
}, 90_000)

// ---------------------------------------------------------------------------

describe('the driver cannot write to vehicles directly', () => {
  it('is refused, so the function is the only way in', async () => {
    // If this ever starts passing, report_position has become pointless and a
    // driver can edit the odometer.
    const { data, error } = await acmeDriver
      .from('vehicles')
      .update({ last_latitude: 1, last_longitude: 1 })
      .eq('id', acme.vehicleId)
      .select()

    expect(error !== null || (data ?? []).length === 0).toBe(true)
    const row = await readVehicle(acme.vehicleId)
    expect(row?.last_latitude).toBeNull()
  })

  it('cannot edit the odometer either', async () => {
    const before = await readVehicle(acme.vehicleId)
    await acmeDriver.from('vehicles').update({ odometer_km: 1 }).eq('id', acme.vehicleId)
    const after = await readVehicle(acme.vehicleId)
    expect(after?.odometer_km).toBe(before?.odometer_km)
  })
})

describe('reporting a position', () => {
  beforeAll(async () => {
    await signOn(acme, acme.driverId, acme.vehicleId)
  })

  it('stores the reading on the vehicle the driver is signed on to', async () => {
    await clearPosition(acme.vehicleId)
    const at = new Date().toISOString()

    const { data, error } = await acmeDriver.rpc('report_position', {
      latitude: 18.5204,
      longitude: 73.8567,
      speed_kph: 42.5,
      heading_deg: 180,
      ignition_on: true,
      reported_at: at,
    })

    expect(error).toBeNull()
    expect(data).toBe(acme.vehicleId)

    const row = await readVehicle(acme.vehicleId)
    expect(Number(row?.last_latitude)).toBeCloseTo(18.5204, 4)
    expect(Number(row?.last_longitude)).toBeCloseTo(73.8567, 4)
    expect(Number(row?.last_speed_kph)).toBeCloseTo(42.5, 1)
    expect(row?.last_heading_deg).toBe(180)
    expect(row?.last_ignition_on).toBe(true)
    expect(row?.last_position_at).not.toBeNull()
  })

  it('leaves everything that is not a position alone', async () => {
    const before = await readVehicle(acme.vehicleId)
    await acmeDriver.rpc('report_position', { latitude: 19, longitude: 74 })
    const after = await readVehicle(acme.vehicleId)

    expect(after?.plate).toBe(before?.plate)
    expect(after?.odometer_km).toBe(before?.odometer_km)
    expect(after?.status).toBe(before?.status)
  })

  it('works with only a latitude and longitude', async () => {
    const { error } = await acmeDriver.rpc('report_position', { latitude: 19.1, longitude: 74.1 })
    expect(error).toBeNull()
  })
})

describe('the stale-reading guard', () => {
  beforeAll(async () => {
    await signOn(acme, acme.driverId, acme.vehicleId)
  })

  it('ignores a reading older than the one already stored', async () => {
    /*
     * This is the offline queue: the phone lost signal, kept recording, and is
     * now sending the backlog. Without the guard the last write would win and
     * the map would show the truck back where it lost signal.
     */
    await clearPosition(acme.vehicleId)
    const newer = new Date()
    const older = new Date(newer.getTime() - 30 * 60_000)

    await acmeDriver.rpc('report_position', {
      latitude: 20,
      longitude: 75,
      reported_at: newer.toISOString(),
    })
    await acmeDriver.rpc('report_position', {
      latitude: 10,
      longitude: 65,
      reported_at: older.toISOString(),
    })

    const row = await readVehicle(acme.vehicleId)
    expect(Number(row?.last_latitude)).toBeCloseTo(20, 4)
  })

  it('still reports the vehicle for a stale reading, so the app does not retry', async () => {
    const older = new Date(Date.now() - 60 * 60_000).toISOString()
    const { data, error } = await acmeDriver.rpc('report_position', {
      latitude: 11,
      longitude: 66,
      reported_at: older,
    })
    expect(error).toBeNull()
    expect(data).toBe(acme.vehicleId)
  })

  it('replaying the same queue in any order lands on the newest reading', async () => {
    await clearPosition(acme.vehicleId)
    const base = Date.now()
    const queue = [
      { latitude: 1, longitude: 1, reported_at: new Date(base - 3 * 60_000).toISOString() },
      { latitude: 3, longitude: 3, reported_at: new Date(base - 1 * 60_000).toISOString() },
      { latitude: 2, longitude: 2, reported_at: new Date(base - 2 * 60_000).toISOString() },
    ]
    for (const reading of [...queue].reverse()) await acmeDriver.rpc('report_position', reading)
    for (const reading of queue) await acmeDriver.rpc('report_position', reading)

    const row = await readVehicle(acme.vehicleId)
    expect(Number(row?.last_latitude)).toBeCloseTo(3, 4)
  })

  it('clamps a reading from a phone whose clock is ahead', async () => {
    // Clamped rather than refused: the position is probably right and the
    // driver cannot fix their clock from the cab, but a timestamp a year out
    // would freeze the map until the real time caught up.
    await clearPosition(acme.vehicleId)
    const wayAhead = new Date(Date.now() + 365 * 24 * 3600_000).toISOString()

    await acmeDriver.rpc('report_position', {
      latitude: 5,
      longitude: 5,
      reported_at: wayAhead,
    })

    const row = await readVehicle(acme.vehicleId)
    const stored = new Date(row!.last_position_at as string).getTime()
    expect(stored).toBeLessThan(Date.now() + 5 * 60_000)

    // And a normal reading after it still lands, which is the point.
    await acmeDriver.rpc('report_position', { latitude: 6, longitude: 6 })
    const after = await readVehicle(acme.vehicleId)
    expect(Number(after?.last_latitude)).toBeCloseTo(6, 4)
  })
})

describe('a driver with no vehicle signed on', () => {
  it('stores nothing and says so, rather than failing', async () => {
    await signOff(acme.driverId)
    const { data, error } = await acmeDriver.rpc('report_position', {
      latitude: 25,
      longitude: 80,
    })
    expect(error).toBeNull()
    // Null is the app's signal to prompt "select your vehicle" rather than
    // treating it as a network failure and retrying forever.
    expect(data).toBeNull()

    await signOn(acme, acme.driverId, acme.vehicleId)
  })
})

describe('company isolation', () => {
  it('cannot be aimed at another company, because there is nothing to aim', async () => {
    /*
     * The strongest part of the design: the function takes no vehicle id. A
     * driver reports where THEY are, and the vehicle is looked up from their
     * own assignment. There is no argument to tamper with.
     */
    await signOn(acme, acme.driverId, acme.vehicleId)
    await signOn(globex, globex.driverId, globex.vehicleId)
    await clearPosition(globex.vehicleId)

    await acmeDriver.rpc('report_position', { latitude: 30, longitude: 30 })

    const theirs = await readVehicle(globex.vehicleId)
    expect(theirs?.last_latitude).toBeNull()
  })

  it('each driver moves only their own company’s vehicle', async () => {
    await clearPosition(acme.vehicleId)
    await clearPosition(globex.vehicleId)

    await acmeDriver.rpc('report_position', { latitude: 40, longitude: 40 })
    await globexDriver.rpc('report_position', { latitude: 50, longitude: 50 })

    const mine = await readVehicle(acme.vehicleId)
    const theirs = await readVehicle(globex.vehicleId)
    expect(Number(mine?.last_latitude)).toBeCloseTo(40, 4)
    expect(Number(theirs?.last_latitude)).toBeCloseTo(50, 4)
  })

  it('office staff calling it move nothing — they are not a driver', async () => {
    await clearPosition(acme.vehicleId)
    const { data, error } = await acmeAdmin.rpc('report_position', {
      latitude: 60,
      longitude: 60,
    })
    expect(error).toBeNull()
    expect(data).toBeNull()

    const row = await readVehicle(acme.vehicleId)
    expect(row?.last_latitude).toBeNull()
  })

  it('is not callable without signing in', async () => {
    const { error } = await anonClient().rpc('report_position', { latitude: 1, longitude: 1 })
    expect(error).not.toBeNull()
  })
})

describe('bad readings are refused', () => {
  beforeAll(async () => {
    await signOn(acme, acme.driverId, acme.vehicleId)
  })

  it('rejects a latitude off the earth', async () => {
    const { error } = await acmeDriver.rpc('report_position', { latitude: 91, longitude: 0 })
    expect(error).not.toBeNull()
  })

  it('rejects a longitude off the earth', async () => {
    const { error } = await acmeDriver.rpc('report_position', { latitude: 0, longitude: -181 })
    expect(error).not.toBeNull()
  })

  it('rejects a negative speed', async () => {
    const { error } = await acmeDriver.rpc('report_position', {
      latitude: 1,
      longitude: 1,
      speed_kph: -5,
    })
    expect(error).not.toBeNull()
  })

  it('rejects a heading that is not a compass bearing', async () => {
    const { error } = await acmeDriver.rpc('report_position', {
      latitude: 1,
      longitude: 1,
      heading_deg: 400,
    })
    expect(error).not.toBeNull()
  })
})
