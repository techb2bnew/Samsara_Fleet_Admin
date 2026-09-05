/**
 * What a driver may and may not put in the work orders table.
 *
 * A driver raising a work order is the one place in this schema where a driver
 * writes a row the office acts on and money follows from. The insert policy is
 * therefore the whole safety boundary, and every clause in it is a way this
 * goes wrong if it is dropped:
 *
 *   own truck only      otherwise a driver files work against the depot
 *   own name forced     otherwise a request can be filed as a colleague
 *   status open only    otherwise a repair that never happened is "completed"
 *   no money, no owner  otherwise a request arrives looking authorised
 *
 * A refused insert and an allowed one look identical from the app until the
 * error comes back, so these are asserted rather than assumed.
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

/** The truck the driver is signed on to, which is what the policy keys on. */
async function signOn(vehicleId: string, driverId: string, orgId: string) {
  const { error } = await admin.from('driver_vehicle_assignments').insert({
    org_id: orgId,
    driver_id: driverId,
    vehicle_id: vehicleId,
    started_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

function base(orgId: string, vehicleId: string, driverId: string) {
  return {
    org_id: orgId,
    vehicle_id: vehicleId,
    requested_by_driver: driverId,
    title: 'Air conditioning has stopped working',
    status: 'open' as const,
    opened_at: new Date().toISOString(),
  }
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'wo-acme', runId)
  globex = await createCompany(admin, 'wo-globex', runId)
  await signOn(acme.vehicleId, acme.driverId, acme.orgId)
  driver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  await destroyCompany(admin, acme)
  await destroyCompany(admin, globex)
})

describe('a driver raising a work order', () => {
  it('allows one on the truck they are signed on to', async () => {
    const { data, error } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, acme.vehicleId, acme.driverId))
      .select('id, requested_by_driver, status')
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ requested_by_driver: acme.driverId, status: 'open' })
  })

  it('refuses a truck they have never been assigned', async () => {
    const { data: other, error: mkErr } = await admin
      .from('vehicles')
      .insert({ org_id: acme.orgId, name: `spare ${runId}`, plate: `SPARE${runId}` })
      .select('id')
      .single()
    if (mkErr) throw new Error(mkErr.message)

    const { error } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, other.id, acme.driverId))
    expect(error).not.toBeNull()
  })

  it('refuses another company', async () => {
    const { error } = await driver
      .from('work_orders')
      .insert(base(globex.orgId, globex.vehicleId, acme.driverId))
    expect(error).not.toBeNull()
  })

  it('refuses filing it under a colleague’s name', async () => {
    const { error } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, acme.vehicleId, acme.colleagueDriverId))
    expect(error).not.toBeNull()
  })

  it('refuses a row that arrives already completed', async () => {
    const { error } = await driver.from('work_orders').insert({
      ...base(acme.orgId, acme.vehicleId, acme.driverId),
      status: 'completed' as const,
      completed_at: new Date().toISOString(),
    })
    expect(error).not.toBeNull()
  })

  it('refuses a driver putting money on it', async () => {
    const withParts = await driver.from('work_orders').insert({
      ...base(acme.orgId, acme.vehicleId, acme.driverId),
      parts_cost_cents: 5_000_00,
    })
    expect(withParts.error).not.toBeNull()

    const withLabour = await driver.from('work_orders').insert({
      ...base(acme.orgId, acme.vehicleId, acme.driverId),
      labour_hours: 4,
    })
    expect(withLabour.error).not.toBeNull()
  })

  it('refuses a driver assigning a mechanic', async () => {
    const { error } = await driver.from('work_orders').insert({
      ...base(acme.orgId, acme.vehicleId, acme.driverId),
      assigned_to: acme.mechanicUserId,
    })
    expect(error).not.toBeNull()
  })

  it('refuses a driver editing one, including their own', async () => {
    const { data: own, error: mkErr } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, acme.vehicleId, acme.driverId))
      .select('id')
      .single()
    if (mkErr) throw new Error(mkErr.message)

    /*
      No update policy exists, so this matches no row rather than erroring.
      Asserted on the rows returned: a driver who could edit a work order
      could mark their own truck repaired.
    */
    const attempt = await driver
      .from('work_orders')
      .update({ title: 'Nothing wrong after all' })
      .eq('id', own.id)
      .select('id')
    expect(attempt.data ?? []).toHaveLength(0)
  })

  it('lets the driver read it back, and the office see who asked', async () => {
    const mine = await driver
      .from('work_orders')
      .select('id, requested_by_driver')
      .eq('requested_by_driver', acme.driverId)
    expect(mine.error).toBeNull()
    expect((mine.data ?? []).length).toBeGreaterThan(0)

    const office = await signedInClient(acme.adminEmail, TEST_PASSWORD)
    const seen = await office
      .from('work_orders')
      .select('id, requested_by_driver')
      .eq('requested_by_driver', acme.driverId)
    expect(seen.error).toBeNull()
    expect((seen.data ?? []).length).toBeGreaterThan(0)
  })
})

describe('a driver taking back their own request', () => {
  /** A fresh open request raised by the driver. */
  async function raise(): Promise<string> {
    const { data, error } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, acme.vehicleId, acme.driverId))
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data.id
  }

  it('cancels one that is still open', async () => {
    const id = await raise()
    const { data, error } = await driver
      .from('work_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('status')
    expect(error).toBeNull()
    expect(data?.[0]?.status).toBe('cancelled')
  })

  it('refuses once the workshop has picked it up', async () => {
    const id = await raise()
    /* The office assigns it — from here on it is a job somebody is holding. */
    await admin.from('work_orders').update({ status: 'in_progress' }).eq('id', id)

    const attempt = await driver
      .from('work_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('id')
    /* No rows, not an error: the USING clause simply matches nothing. */
    expect(attempt.data ?? []).toHaveLength(0)
  })

  it('refuses a request the office raised', async () => {
    const { data, error } = await admin
      .from('work_orders')
      .insert({
        org_id: acme.orgId,
        vehicle_id: acme.vehicleId,
        title: 'Scheduled service',
        status: 'open',
        opened_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    const attempt = await driver
      .from('work_orders')
      .update({ status: 'cancelled' })
      .eq('id', data.id)
      .select('id')
    expect(attempt.data ?? []).toHaveLength(0)
  })

  it('refuses completing instead of cancelling', async () => {
    /*
      The one that matters most. Without the WITH CHECK clause the USING clause
      alone would let the person who raised a job mark it done — and a repair
      that never happened would be on the record as finished.
    */
    const id = await raise()
    const attempt = await driver
      .from('work_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    expect((attempt.data ?? []).length === 0 || attempt.error !== null).toBe(true)

    const after = await admin.from('work_orders').select('status').eq('id', id).single()
    expect(after.data?.status).toBe('open')
  })

  it('refuses attaching money on the way out', async () => {
    const id = await raise()
    const attempt = await driver
      .from('work_orders')
      .update({ status: 'cancelled', parts_cost_cents: 100000 })
      .eq('id', id)
      .select('id')
    expect((attempt.data ?? []).length === 0 || attempt.error !== null).toBe(true)
  })
})

describe('a driver filing a fault', () => {
  it('allows a defect with no inspection behind it, linked to their own request', async () => {
    const { data: order, error: woErr } = await driver
      .from('work_orders')
      .insert(base(acme.orgId, acme.vehicleId, acme.driverId))
      .select('id')
      .single()
    if (woErr) throw new Error(woErr.message)

    const { data, error } = await driver
      .from('defects')
      .insert({
        org_id: acme.orgId,
        vehicle_id: acme.vehicleId,
        reported_by_driver: acme.driverId,
        area: 'Brakes',
        finding: 'Pedal feels soft from cold',
        severity: 'major',
        status: 'open',
        work_order_id: order.id,
      })
      .select('id, work_order_id')
      .single()

    expect(error).toBeNull()
    expect(data?.work_order_id).toBe(order.id)
  })

  it('refuses a defect filed under a colleague', async () => {
    const { error } = await driver.from('defects').insert({
      org_id: acme.orgId,
      vehicle_id: acme.vehicleId,
      reported_by_driver: acme.colleagueDriverId,
      area: 'Brakes',
      finding: 'Not mine to report',
      severity: 'minor',
      status: 'open',
    })
    expect(error).not.toBeNull()
  })
})
