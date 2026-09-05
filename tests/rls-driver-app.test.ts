/**
 * What the driver app can read.
 *
 * A driver has no user_roles row, so current_org_ids() is empty for them and
 * every org-wide policy in this schema skips them. These are the five
 * driver-scoped SELECT policies the app needs, and the point of the suite is
 * that each one is exactly as wide as it has to be:
 *
 *   - it returns what the screen needs
 *   - it stops at the company boundary
 *   - it stops at the colleague boundary
 *
 * The awkward cases get their own tests, because they are the ones that would
 * otherwise be discovered by a driver standing next to a truck: a driver
 * seconded to another depot, a driver with no depot set at all, and a course
 * assigned to one person by name.
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
  TEST_PREFIX,
  type Company,
} from './helpers'

const runId = Math.random().toString(36).slice(2, 8)

let admin: SupabaseClient<Database>
let acme: Company
let globex: Company
let acmeDriver: SupabaseClient<Database>
let acmeAdmin: SupabaseClient<Database>

/** A second depot at Acme, and a truck kept there. */
let otherDepotId: string
let otherDepotVehicleId: string
/** A published form and course scoped to that other depot. */
let otherDepotFormId: string
/** Org-wide (no depot) form and course. */
let orgWideFormId: string
let orgWideCourseId: string
/** A course with no fleet, assigned to the driver by name. */
let byNameCourseId: string

async function newVehicle(company: Company, fleetId: string | null, plate: string) {
  const { data, error } = await admin
    .from('vehicles')
    .insert({ org_id: company.orgId, fleet_id: fleetId, plate, kind: 'truck', status: 'active' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

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

async function setDepot(driverId: string, fleetId: string | null) {
  await admin.from('drivers').update({ fleet_id: fleetId }).eq('id', driverId)
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'appacme', runId)
  globex = await createCompany(admin, 'appglobex', runId)

  acmeDriver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)

  // The driver belongs to the company's first depot, and their vehicle is kept
  // there — createCompany already wires that up.
  await setDepot(acme.driverId, acme.fleetId)
  await admin.from('vehicles').update({ fleet_id: acme.fleetId }).eq('id', acme.vehicleId)

  const { data: depot } = await admin
    .from('fleets')
    .insert({ org_id: acme.orgId, name: `${TEST_PREFIX} other ${runId}`, timezone: 'UTC' })
    .select('id')
    .single()
  otherDepotId = depot!.id
  otherDepotVehicleId = await newVehicle(acme, otherDepotId, `OTHER-${runId}`)

  const forms = await admin
    .from('forms')
    .insert([
      {
        org_id: acme.orgId, key: `orgwide-${runId}`, version: 1, name: 'Pre-trip',
        kind: 'custom', status: 'published', published_at: new Date().toISOString(), fields: [], assigned_fleet_id: null,
      },
      {
        org_id: acme.orgId, key: `other-${runId}`, version: 1, name: 'Other depot form',
        kind: 'custom', status: 'published', published_at: new Date().toISOString(), fields: [], assigned_fleet_id: otherDepotId,
      },
      {
        org_id: acme.orgId, key: `draft-${runId}`, version: 1, name: 'Still being written',
        kind: 'custom', status: 'draft', fields: [], assigned_fleet_id: null,
      },
    ])
    .select('id, key')
  if (forms.error) throw new Error(`forms fixture: ${forms.error.message}`)
  orgWideFormId = forms.data!.find((f) => f.key === `orgwide-${runId}`)!.id
  otherDepotFormId = forms.data!.find((f) => f.key === `other-${runId}`)!.id

  const courses = await admin
    .from('courses')
    .insert([
      { org_id: acme.orgId, title: `orgwide-${runId}`, status: 'published', assigned_fleet_id: null },
      { org_id: acme.orgId, title: `byname-${runId}`, status: 'published', assigned_fleet_id: otherDepotId },
      { org_id: acme.orgId, title: `draft-${runId}`, status: 'draft', assigned_fleet_id: null },
    ])
    .select('id, title')
  if (courses.error) throw new Error(`courses fixture: ${courses.error.message}`)
  orgWideCourseId = courses.data!.find((c) => c.title === `orgwide-${runId}`)!.id
  byNameCourseId = courses.data!.find((c) => c.title === `byname-${runId}`)!.id

  // Assigned to this driver by name. It is scoped to a depot they are NOT in,
  // so only the assignment can make it visible.
  await admin.from('course_assignments').insert({
    org_id: acme.orgId,
    course_id: byNameCourseId,
    driver_id: acme.driverId,
    status: 'assigned',
  })
}, 120_000)

afterAll(async () => {
  if (acme) await destroyCompany(admin, acme)
  if (globex) await destroyCompany(admin, globex)
}, 120_000)

// ---------------------------------------------------------------------------

describe('their own organisation', () => {
  it('is readable, so the app can show the name and work out the legal day', async () => {
    const { data } = await acmeDriver.from('organizations').select('id, name, timezone, hos_regulator')
    expect(data?.map((o) => o.id)).toEqual([acme.orgId])
  })

  it('another company is not', async () => {
    const { data } = await acmeDriver.from('organizations').select('id').eq('id', globex.orgId)
    expect(data).toEqual([])
  })
})

describe('vehicles — the shift-start picker', () => {
  beforeAll(async () => {
    await setDepot(acme.driverId, acme.fleetId)
    await signOn(acme, acme.driverId, acme.vehicleId)
  })

  it('shows the trucks at their own depot', async () => {
    const { data } = await acmeDriver.from('vehicles').select('id')
    expect(data?.map((v) => v.id)).toContain(acme.vehicleId)
  })

  it('hides trucks kept at another depot', async () => {
    const { data } = await acmeDriver.from('vehicles').select('id')
    expect(data?.map((v) => v.id)).not.toContain(otherDepotVehicleId)
  })

  it('hides another company’s trucks', async () => {
    const { data } = await acmeDriver.from('vehicles').select('id').eq('id', globex.vehicleId)
    expect(data).toEqual([])
  })

  it('still shows a truck they are assigned to at another depot', async () => {
    /*
     * The secondment case. Depot-only would hand this driver an empty picker,
     * and a driver who cannot pick a truck cannot start a shift, log hours or
     * report a position.
     */
    await signOn(acme, acme.driverId, otherDepotVehicleId)
    const { data } = await acmeDriver.from('vehicles').select('id')
    expect(data?.map((v) => v.id)).toContain(otherDepotVehicleId)
  })

  it('shows their assigned truck even with no depot set on the driver', async () => {
    // A driver created before the depot was set up. Not an error state, and
    // they must still be able to work.
    await setDepot(acme.driverId, null)
    await signOn(acme, acme.driverId, acme.vehicleId)
    const { data } = await acmeDriver.from('vehicles').select('id')
    expect(data?.map((v) => v.id)).toContain(acme.vehicleId)

    await setDepot(acme.driverId, acme.fleetId)
  })

  it('a driver with no depot and no assignment sees nothing, which is the honest answer', async () => {
    await setDepot(acme.driverId, null)
    await admin
      .from('driver_vehicle_assignments')
      .delete()
      .eq('driver_id', acme.driverId)

    const { data } = await acmeDriver.from('vehicles').select('id')
    expect(data).toEqual([])

    await setDepot(acme.driverId, acme.fleetId)
    await signOn(acme, acme.driverId, acme.vehicleId)
  })
})

describe('forms — what they have to fill in', () => {
  it('shows a published form scoped to the whole organisation', async () => {
    const { data } = await acmeDriver.from('forms').select('id')
    expect(data?.map((f) => f.id)).toContain(orgWideFormId)
  })

  it('hides a form scoped to another depot', async () => {
    const { data } = await acmeDriver.from('forms').select('id')
    expect(data?.map((f) => f.id)).not.toContain(otherDepotFormId)
  })

  it('hides a draft — the office is still writing it', async () => {
    const { data } = await acmeDriver.from('forms').select('id, status')
    expect(data?.every((f) => f.status === 'published')).toBe(true)
  })

  it('hides another company’s forms', async () => {
    const { data } = await acmeDriver.from('forms').select('id, org_id')
    expect(data?.every((f) => f.org_id === acme.orgId)).toBe(true)
  })
})

describe('courses — what they have to do', () => {
  it('shows a published course scoped to the whole organisation', async () => {
    const { data } = await acmeDriver.from('courses').select('id')
    expect(data?.map((c) => c.id)).toContain(orgWideCourseId)
  })

  it('shows a course assigned to them by name, even though its depot is not theirs', async () => {
    /*
     * Individually assigned courses carry no fleet. Scoping on depot alone
     * would make exactly the courses somebody chose for this driver invisible.
     */
    const { data } = await acmeDriver.from('courses').select('id')
    expect(data?.map((c) => c.id)).toContain(byNameCourseId)
  })

  it('hides drafts', async () => {
    const { data } = await acmeDriver.from('courses').select('status')
    expect(data?.every((c) => c.status === 'published')).toBe(true)
  })
})

describe('work orders — repairs on trucks they have driven', () => {
  let onTheirTruck: string
  let onAnotherTruck: string

  beforeAll(async () => {
    await setDepot(acme.driverId, acme.fleetId)
    await signOn(acme, acme.driverId, acme.vehicleId)

    const rows = await admin
      .from('work_orders')
      .insert([
        { org_id: acme.orgId, vehicle_id: acme.vehicleId, title: `mine-${runId}`, status: 'open' },
        { org_id: acme.orgId, vehicle_id: otherDepotVehicleId, title: `theirs-${runId}`, status: 'open' },
      ])
      .select('id, title')
    onTheirTruck = rows.data!.find((w) => w.title === `mine-${runId}`)!.id
    onAnotherTruck = rows.data!.find((w) => w.title === `theirs-${runId}`)!.id
  })

  it('shows the repair on the truck they are driving', async () => {
    const { data } = await acmeDriver.from('work_orders').select('id')
    expect(data?.map((w) => w.id)).toContain(onTheirTruck)
  })

  it('keeps showing it after they move to another truck', async () => {
    // "Did my brake defect get fixed?" is a fair question on Wednesday about a
    // truck they drove on Tuesday.
    await signOn(acme, acme.driverId, otherDepotVehicleId)
    const { data } = await acmeDriver.from('work_orders').select('id')
    expect(data?.map((w) => w.id)).toContain(onTheirTruck)
  })

  it('hides repairs on a truck they have never driven', async () => {
    await admin.from('driver_vehicle_assignments').delete().eq('driver_id', acme.driverId)
    await signOn(acme, acme.driverId, acme.vehicleId)

    const { data } = await acmeDriver.from('work_orders').select('id')
    expect(data?.map((w) => w.id)).not.toContain(onAnotherTruck)
  })

  it('cannot open one — that stays with the office and the mechanic', async () => {
    const { error } = await acmeDriver
      .from('work_orders')
      .insert({ org_id: acme.orgId, vehicle_id: acme.vehicleId, title: `planted-${runId}`, status: 'open' })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('what a driver still must not see', () => {
  it('cannot read a colleague’s driver row', async () => {
    const { data } = await acmeDriver.from('drivers').select('id')
    expect(data?.map((d) => d.id)).toEqual([acme.driverId])
  })

  it('cannot read the depot list', async () => {
    const { data } = await acmeDriver.from('fleets').select('id')
    expect(data).toEqual([])
  })

  it('cannot read office staff or their role grants', async () => {
    const staff = await acmeDriver.from('user_roles').select('user_id')
    expect(staff.data ?? []).toEqual([])
  })

  it('cannot read the audit trail', async () => {
    const { data } = await acmeDriver.from('audit_log').select('id')
    expect(data ?? []).toEqual([])
  })

  it('cannot read alert rules', async () => {
    const { data } = await acmeDriver.from('alert_rules').select('id')
    expect(data ?? []).toEqual([])
  })
})

describe('the office is unaffected', () => {
  it('still sees every vehicle in the company, both depots', async () => {
    const { data } = await acmeAdmin.from('vehicles').select('id')
    const ids = data?.map((v) => v.id) ?? []
    expect(ids).toContain(acme.vehicleId)
    expect(ids).toContain(otherDepotVehicleId)
  })

  it('still sees drafts', async () => {
    const { data } = await acmeAdmin.from('forms').select('status')
    expect(data?.some((f) => f.status === 'draft')).toBe(true)
  })

  it('still sees the whole roster', async () => {
    const { data } = await acmeAdmin.from('drivers').select('id')
    expect((data?.length ?? 0)).toBeGreaterThan(1)
  })
})
