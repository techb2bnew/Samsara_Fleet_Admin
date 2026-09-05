/**
 * Two drivers, two trucks, and what happens when they both want the same one.
 *
 * The unique indexes on driver_vehicle_assignments have always refused this.
 * What these tests are really about is the shape of the refusal: it used to
 * arrive as a Postgres unique violation AFTER the app had closed the driver's
 * own assignment, so a driver who tapped the wrong truck ended the attempt on
 * no truck at all. sign_on_to_vehicle is one transaction precisely so that
 * cannot happen, and "the driver is left exactly where they were" is the
 * assertion that matters most here.
 *
 * taken_vehicle_ids is tested alongside it because the picker depends on it to
 * grey the truck out before anybody gets that far — and because a driver
 * cannot read those rows directly, so a mistake in it is invisible from the
 * app.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/supabase/database'
import {
  adminClient,
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
let driver: SupabaseClient<Database>

/** A second truck, so there is something free to move to. */
let spareVehicleId: string

async function currentVehicle(driverId: string): Promise<string | null> {
  const { data } = await admin
    .from('driver_vehicle_assignments')
    .select('vehicle_id')
    .eq('driver_id', driverId)
    .is('ended_at', null)
    .maybeSingle()
  return data?.vehicle_id ?? null
}

async function clearAssignments() {
  await admin
    .from('driver_vehicle_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('org_id', acme.orgId)
    .is('ended_at', null)
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'signon-acme', runId)
  globex = await createCompany(admin, 'signon-globex', runId)

  const { data, error } = await admin
    .from('vehicles')
    .insert({
      org_id: acme.orgId,
      name: `spare ${runId}`,
      plate: `SPR${runId}`,
      kind: 'truck',
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  spareVehicleId = data.id

  driver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  await destroyCompany(admin, acme)
  await destroyCompany(admin, globex)
})

describe('signing on to a truck', () => {
  it('puts the driver on a free truck', async () => {
    await clearAssignments()
    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: acme.vehicleId })
    expect(error).toBeNull()
    expect(await currentVehicle(acme.driverId)).toBe(acme.vehicleId)
  })

  it('is idempotent — tapping the truck they are already on changes nothing', async () => {
    const before = await admin
      .from('driver_vehicle_assignments')
      .select('id, started_at')
      .eq('driver_id', acme.driverId)
      .is('ended_at', null)
      .single()

    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: acme.vehicleId })
    expect(error).toBeNull()

    const after = await admin
      .from('driver_vehicle_assignments')
      .select('id, started_at')
      .eq('driver_id', acme.driverId)
      .is('ended_at', null)
      .single()

    /* Same row, same start time: started_at still means "when they got in". */
    expect(after.data?.id).toBe(before.data?.id)
    expect(after.data?.started_at).toBe(before.data?.started_at)
  })

  it('moves them to another free truck, closing the old assignment', async () => {
    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: spareVehicleId })
    expect(error).toBeNull()
    expect(await currentVehicle(acme.driverId)).toBe(spareVehicleId)

    const open = await admin
      .from('driver_vehicle_assignments')
      .select('id')
      .eq('driver_id', acme.driverId)
      .is('ended_at', null)
    expect(open.data ?? []).toHaveLength(1)
  })

  it('refuses a truck a colleague is on, and LEAVES THE DRIVER WHERE THEY WERE', async () => {
    /* The colleague takes the first truck. */
    const { error: colleagueErr } = await admin.from('driver_vehicle_assignments').insert({
      org_id: acme.orgId,
      driver_id: acme.colleagueDriverId,
      vehicle_id: acme.vehicleId,
      started_at: new Date().toISOString(),
    })
    expect(colleagueErr).toBeNull()

    const before = await currentVehicle(acme.driverId)
    expect(before).toBe(spareVehicleId)

    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: acme.vehicleId })
    expect(error).not.toBeNull()
    /* A sentence, not a constraint name — the app shows this to a person. */
    expect(error?.message ?? '').toMatch(/another driver/i)

    /*
      The whole point of the function. Before it, the close had already
      committed by the time the insert failed.
    */
    expect(await currentVehicle(acme.driverId)).toBe(spareVehicleId)
  })

  it('refuses another company’s truck', async () => {
    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: globex.vehicleId })
    expect(error).not.toBeNull()
    expect(await currentVehicle(acme.driverId)).toBe(spareVehicleId)
  })

  it('refuses a truck that is out of service', async () => {
    const { data, error: mkErr } = await admin
      .from('vehicles')
      .insert({
        org_id: acme.orgId,
        name: `broken ${runId}`,
        plate: `BRK${runId}`,
        kind: 'truck',
        status: 'out_of_service',
      })
      .select('id')
      .single()
    if (mkErr) throw new Error(mkErr.message)

    const { error } = await driver.rpc('sign_on_to_vehicle', { p_vehicle_id: data.id })
    expect(error).not.toBeNull()
    expect(await currentVehicle(acme.driverId)).toBe(spareVehicleId)
  })
})

describe('which trucks the picker greys out', () => {
  it('lists the colleague’s truck and not the driver’s own', async () => {
    const { data, error } = await driver.rpc('taken_vehicle_ids')
    expect(error).toBeNull()

    const taken = (data as unknown as string[]) ?? []
    /* The colleague is on acme.vehicleId from the test above. */
    expect(taken).toContain(acme.vehicleId)
    /* Their own truck is not "taken" from where they are standing. */
    expect(taken).not.toContain(spareVehicleId)
  })

  it('does not leak another company’s assignments', async () => {
    await admin.from('driver_vehicle_assignments').insert({
      org_id: globex.orgId,
      driver_id: globex.driverId,
      vehicle_id: globex.vehicleId,
      started_at: new Date().toISOString(),
    })

    const { data } = await driver.rpc('taken_vehicle_ids')
    expect(((data as unknown as string[]) ?? [])).not.toContain(globex.vehicleId)
  })

  it('returns ids only — never who is on them', async () => {
    const { data } = await driver.rpc('taken_vehicle_ids')
    const rows = (data as unknown as unknown[]) ?? []
    /*
      Asserted because widening this to include a name would be an easy,
      well-meant change: it would hand every driver a live list of where each
      of their colleagues is.
    */
    for (const row of rows) expect(typeof row).toBe('string')
  })
})
