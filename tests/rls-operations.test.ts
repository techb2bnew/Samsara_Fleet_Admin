/**
 * Row-level security: hours of service, forms, dispatch, messaging, safety,
 * training and the audit trail.
 *
 * These tables carry rules the other suites do not have to think about:
 *
 *   - A carrier may propose a change to a driver's legal log, and may not
 *     accept it. That is the single most abusable path in the whole schema, so
 *     it is checked from both sides.
 *   - duty_status_events and audit_log are append-only. That is enforced by a
 *     trigger, and a trigger nobody tests is a trigger that gets dropped in a
 *     later migration without anyone noticing.
 *   - A driver must not read a colleague's safety events, messages or training.
 *     The office-level policy on each of those looks right and would show a
 *     driver the whole depot.
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
let acmeDispatcher: SupabaseClient<Database>
let acmeDriver: SupabaseClient<Database>
let globexAdmin: SupabaseClient<Database>

/** Fixture ids created in beforeAll and read across the suites below. */
let dutyEventId: string
let routeId: string

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'opsacme', runId)
  globex = await createCompany(admin, 'opsglobex', runId)

  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  acmeDispatcher = await signedInClient(acme.dispatcherEmail, TEST_PASSWORD)
  acmeDriver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
  globexAdmin = await signedInClient(globex.adminEmail, TEST_PASSWORD)

  const duty = await admin
    .from('duty_status_events')
    .insert({
      org_id: acme.orgId,
      driver_id: acme.driverId,
      status: 'driving',
      started_at: new Date().toISOString(),
      source: 'automatic',
    })
    .select('id')
    .single()
  dutyEventId = duty.data!.id

  const route = await admin
    .from('routes')
    .insert({
      org_id: acme.orgId,
      reference: `RT-${runId}`,
      driver_id: acme.driverId,
      vehicle_id: acme.vehicleId,
    })
    .select('id')
    .single()
  routeId = route.data!.id
}, 90_000)

afterAll(async () => {
  if (acme) await destroyCompany(admin, acme)
  if (globex) await destroyCompany(admin, globex)
}, 90_000)

// ---------------------------------------------------------------------------

describe('duty status events — append-only', () => {
  // Checked as the driver, not with the secret key. The driver is who the rule
  // is for: their own policy lets them update their own rows, so the trigger is
  // the only thing standing between them and a rewritten log.
  //
  // The secret key is deliberately exempt - see the operator-exemption
  // migration. Without that, deleting an organisation is impossible, and so is
  // erasing a customer who asks to be erased.
  it('a driver cannot rewrite their own original record', async () => {
    await acmeDriver.from('duty_status_events').update({ status: 'off_duty' }).eq('id', dutyEventId)

    const { data: after } = await admin
      .from('duty_status_events').select('status').eq('id', dutyEventId).single()
    expect(after?.status).toBe('driving')
  })

  it('a driver cannot delete a duty record', async () => {
    await acmeDriver.from('duty_status_events').delete().eq('id', dutyEventId)

    const { count } = await admin
      .from('duty_status_events')
      .select('id', { count: 'exact', head: true })
      .eq('id', dutyEventId)
    expect(count).toBe(1)
  })

  it('a correction is a new row pointing at the original', async () => {
    const { data, error } = await admin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'on_duty_not_driving',
        started_at: new Date().toISOString(),
        source: 'carrier_edit',
        edit_of_id: dutyEventId,
        edit_status: 'pending',
        edit_reason: 'loading, not driving',
      })
      .select('id, edit_of_id')
      .single()
    expect(error).toBeNull()
    expect(data?.edit_of_id).toBe(dutyEventId)
  })

  it('what a correction proposes cannot be altered afterwards', async () => {
    const { data: edit } = await admin
      .from('duty_status_events')
      .select('id')
      .eq('edit_of_id', dutyEventId)
      .limit(1)
      .single()

    await acmeDriver
      .from('duty_status_events')
      .update({ status: 'driving' })
      .eq('id', edit!.id)

    const { data: after } = await admin
      .from('duty_status_events').select('status').eq('id', edit!.id).single()
    expect(after?.status).toBe('on_duty_not_driving')
  })
})

describe('duty status events — who may change a log', () => {
  it('a driver sees their own events', async () => {
    const { data } = await acmeDriver.from('duty_status_events').select('id')
    expect(data?.some((r) => r.id === dutyEventId)).toBe(true)
  })

  it('another company sees nothing', async () => {
    const { data } = await globexAdmin.from('duty_status_events').select('id')
    expect(data?.some((r) => r.id === dutyEventId)).toBe(false)
  })

  it('the office may propose a correction', async () => {
    const { error } = await acmeAdmin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'off_duty',
        started_at: new Date().toISOString(),
        source: 'carrier_edit',
        edit_of_id: dutyEventId,
        edit_status: 'pending',
        edit_reason: 'office correction',
      })
      .select()
    expect(error).toBeNull()
  })

  // The rule that matters most in this file. A carrier that can write an
  // accepted edit can rewrite a driver's legal record unchallenged.
  it('the office CANNOT write an already-accepted correction', async () => {
    const { error } = await acmeAdmin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'off_duty',
        started_at: new Date().toISOString(),
        source: 'carrier_edit',
        edit_of_id: dutyEventId,
        edit_status: 'accepted',
      })
      .select()
    expect(error).not.toBeNull()
  })

  it('the office CANNOT write a plain event on a driver\'s behalf', async () => {
    const { error } = await acmeAdmin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'driving',
        started_at: new Date().toISOString(),
        source: 'manual',
      })
      .select()
    expect(error).not.toBeNull()
  })

  /*
   * The line the whole design turns on.
   *
   * A correction the DRIVER asked for is the office's to decide — that is the
   * console's "Correction requests" queue. A correction the OFFICE proposed is
   * the driver's alone. Both are pending rows on the same table, and `source`
   * is the only thing separating them, so both directions are checked.
   */
  it('the office CAN decide a correction the driver asked for', async () => {
    const { data: request } = await admin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'sleeper_berth',
        started_at: new Date().toISOString(),
        // The driver's own request, from the phone.
        source: 'manual',
        edit_of_id: dutyEventId,
        edit_status: 'pending',
        edit_reason: 'I was in the bunk, not off duty',
      })
      .select('id')
      .single()

    const { error } = await acmeAdmin
      .from('duty_status_events')
      .update({ edit_status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', request!.id)
    expect(error).toBeNull()

    const { data: after } = await admin
      .from('duty_status_events').select('edit_status').eq('id', request!.id).single()
    expect(after?.edit_status).toBe('accepted')
  })

  it('the office CANNOT decide a correction it proposed itself', async () => {
    const { data: proposal } = await admin
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        status: 'on_duty_not_driving',
        started_at: new Date().toISOString(),
        // Proposed by the carrier — only the driver may accept this.
        source: 'carrier_edit',
        edit_of_id: dutyEventId,
        edit_status: 'pending',
        edit_reason: 'office correction',
      })
      .select('id')
      .single()

    await acmeAdmin
      .from('duty_status_events')
      .update({ edit_status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', proposal!.id)

    const { data: after } = await admin
      .from('duty_status_events').select('edit_status').eq('id', proposal!.id).single()
    expect(after?.edit_status).toBe('pending')
  })

  it('a driver cannot write an event onto a colleague', async () => {
    const { error } = await acmeDriver
      .from('duty_status_events')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.colleagueDriverId,
        status: 'driving',
        started_at: new Date().toISOString(),
      })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('daily log certification', () => {
  it('a driver certifies their own day', async () => {
    const { error } = await acmeDriver
      .from('hos_daily_logs')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        log_date: '2026-09-01',
        certified_at: new Date().toISOString(),
        certified_count: 1,
      })
      .select()
    expect(error).toBeNull()
  })

  it('the office cannot certify a day for a driver', async () => {
    const { error } = await acmeAdmin
      .from('hos_daily_logs')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.colleagueDriverId,
        log_date: '2026-09-01',
        certified_at: new Date().toISOString(),
        certified_count: 1,
      })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('forms and submissions', () => {
  it('a dispatcher cannot publish a form', async () => {
    const { error } = await acmeDispatcher
      .from('forms')
      .insert({
        org_id: acme.orgId,
        key: `dispatch-${runId}`,
        name: 'Planted',
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
    expect(error).not.toBeNull()
  })

  it('another company cannot read a form', async () => {
    const { data: form } = await admin
      .from('forms')
      .insert({ org_id: acme.orgId, key: `pretrip-${runId}`, name: 'Pre-trip' })
      .select('id')
      .single()

    const { data } = await globexAdmin.from('forms').select('id').eq('id', form!.id)
    expect(data).toEqual([])
  })

  it('a driver cannot file a submission under a colleague', async () => {
    const { data: form } = await admin
      .from('forms')
      .insert({ org_id: acme.orgId, key: `dvir-${runId}`, name: 'DVIR' })
      .select('id')
      .single()

    const { error } = await acmeDriver
      .from('form_submissions')
      .insert({ org_id: acme.orgId, form_id: form!.id, driver_id: acme.colleagueDriverId })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('dispatch', () => {
  it('a driver sees the route assigned to them', async () => {
    const { data } = await acmeDriver.from('routes').select('id')
    expect(data?.map((r) => r.id)).toEqual([routeId])
  })

  it('a driver cannot hand their route to a colleague', async () => {
    const { error } = await acmeDriver
      .from('routes')
      .update({ driver_id: acme.colleagueDriverId })
      .eq('id', routeId)
      .select()
    // Either the update is refused, or it matches no rows. Both mean the
    // reassignment did not happen; what must not happen is a silent success.
    const { data: after } = await admin.from('routes').select('driver_id').eq('id', routeId).single()
    expect(error !== null || after?.driver_id === acme.driverId).toBe(true)
  })

  it('another company cannot read the route or its stops', async () => {
    await admin
      .from('route_stops')
      .insert({ org_id: acme.orgId, route_id: routeId, sequence: 1, name: 'Depot' })

    const { data: routes } = await globexAdmin.from('routes').select('id').eq('id', routeId)
    const { data: stops } = await globexAdmin.from('route_stops').select('id').eq('route_id', routeId)
    expect(routes).toEqual([])
    expect(stops).toEqual([])
  })
})

describe('messaging', () => {
  it('a driver reads their own conversation only', async () => {
    await admin.from('messages').insert([
      { org_id: acme.orgId, driver_id: acme.driverId, direction: 'to_driver', body: 'MINE' },
      { org_id: acme.orgId, driver_id: acme.colleagueDriverId, direction: 'to_driver', body: 'THEIRS' },
    ])

    const { data } = await acmeDriver.from('messages').select('body')
    expect(data?.map((r) => r.body)).toEqual(['MINE'])
  })

  // Without the direction check a driver could post a message that renders in
  // their own app as though the office had sent it.
  it('a driver cannot post a message that looks like it came from the office', async () => {
    const { error } = await acmeDriver
      .from('messages')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        direction: 'to_driver',
        body: 'Take the rest of the day off',
      })
      .select()
    expect(error).not.toBeNull()
  })

  it('a driver can reply in their own conversation', async () => {
    const { error } = await acmeDriver
      .from('messages')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.driverId,
        direction: 'from_driver',
        body: 'On my way',
      })
      .select()
    expect(error).toBeNull()
  })
})

describe('safety and training', () => {
  it('a driver cannot read a colleague\'s safety events', async () => {
    await admin.from('safety_events').insert([
      {
        org_id: acme.orgId, driver_id: acme.driverId,
        event_type: 'speeding', occurred_at: new Date().toISOString(), review_note: 'MINE',
      },
      {
        org_id: acme.orgId, driver_id: acme.colleagueDriverId,
        event_type: 'speeding', occurred_at: new Date().toISOString(), review_note: 'THEIRS',
      },
    ])

    const { data } = await acmeDriver.from('safety_events').select('review_note')
    expect(data?.map((r) => r.review_note)).toEqual(['MINE'])
  })

  it('a dispatcher cannot dismiss a safety event', async () => {
    const { data: event } = await admin
      .from('safety_events')
      .insert({
        org_id: acme.orgId, driver_id: acme.driverId,
        event_type: 'harsh_braking', occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    await acmeDispatcher
      .from('safety_events')
      .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
      .eq('id', event!.id)

    const { data: after } = await admin
      .from('safety_events').select('status').eq('id', event!.id).single()
    expect(after?.status).toBe('new')
  })

  it('a driver cannot assign themselves a course', async () => {
    const { data: course } = await admin
      .from('courses')
      .insert({ org_id: acme.orgId, title: `Course ${runId}` })
      .select('id')
      .single()

    const { error } = await acmeDriver
      .from('course_assignments')
      .insert({ org_id: acme.orgId, course_id: course!.id, driver_id: acme.driverId })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('audit trail', () => {
  it('a browser session cannot write an audit entry', async () => {
    const { error } = await acmeAdmin
      .from('audit_log')
      .insert({ org_id: acme.orgId, action: 'forged', summary: 'planted from the client' })
      .select()
    expect(error).not.toBeNull()
  })

  it('a signed-in admin cannot change or remove an entry', async () => {
    const { data: entry } = await admin
      .from('audit_log')
      .insert({ org_id: acme.orgId, action: 'test', summary: 'written by the server' })
      .select('id')
      .single()

    await acmeAdmin.from('audit_log').update({ action: 'rewritten' }).eq('id', entry!.id)
    await acmeAdmin.from('audit_log').delete().eq('id', entry!.id)

    const { data: after } = await admin
      .from('audit_log').select('action').eq('id', entry!.id).single()
    expect(after?.action).toBe('test')
  })

  it('a dispatcher cannot read the audit trail', async () => {
    const { data } = await acmeDispatcher.from('audit_log').select('id')
    expect(data).toEqual([])
  })

  it('another company cannot read the audit trail', async () => {
    const { data } = await globexAdmin.from('audit_log').select('id').eq('org_id', acme.orgId)
    expect(data).toEqual([])
  })
})

describe('signed-out visitors', () => {
  const tables = [
    'duty_status_events',
    'hos_daily_logs',
    'forms',
    'form_submissions',
    'defects',
    'routes',
    'route_stops',
    'messages',
    'safety_events',
    'courses',
    'course_assignments',
    'audit_log',
    'alert_rules',
  ] as const

  for (const table of tables) {
    it(`cannot read ${table}`, async () => {
      const anon = anonClient()
      const { data, error } = await anon.from(table).select('*').limit(1)
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })
  }
})
