/**
 * That a duty change reaches the driver's OTHER device.
 *
 * The app relies on this for one thing the driver cannot afford to get wrong:
 * two phones signed in as the same driver agreeing about what duty status they
 * are in. There is nothing to see when it does not work — no error, no
 * reconnect, just a second screen that stays on yesterday's status — so it is
 * asserted rather than assumed.
 *
 * Three things have to hold, and each is a separate way this silently breaks:
 *
 *   - the table is in the publication          (add it and forget: nothing arrives)
 *   - the socket honours the select policy     (drop it and everyone hears everything)
 *   - the driver-side filter is not too narrow (over-filter and the driver hears nothing)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
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

/**
 * How long to wait for a socket message.
 *
 * Generous on purpose. A false failure here would send somebody looking for a
 * bug in the publication, and the cost of the wait is only paid when the
 * message genuinely never comes.
 */
const ARRIVAL_MS = 12_000

let admin: SupabaseClient<Database>
let acme: Company
let driver: SupabaseClient<Database>
let channels: RealtimeChannel[] = []

/**
 * Subscribes as this client and resolves with the first matching payload, or
 * null if nothing arrives.
 *
 * The subscribe is awaited before the caller is allowed to write. Postgres
 * changes are not replayed, so a row inserted while the socket is still
 * joining is simply missed — which would make this suite flaky in exactly the
 * direction that hides a real problem.
 */
async function listen(
  client: SupabaseClient<Database>,
  table: string,
  filter: string,
): Promise<{ wait: () => Promise<unknown | null> }> {
  let resolveFirst: (value: unknown | null) => void = () => {}
  const first = new Promise<unknown | null>((resolve) => {
    resolveFirst = resolve
  })

  const channel = client
    .channel(`test:${table}:${runId}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
      resolveFirst(payload)
    })
  channels.push(channel)

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${table}: never subscribed`)), ARRIVAL_MS)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`${table}: ${status}`))
      }
    })
  })

  return {
    wait: () =>
      Promise.race([
        first,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ARRIVAL_MS)),
      ]),
  }
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'rt-duty', runId)
  driver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  for (const channel of channels) await channel.unsubscribe()
  channels = []
  await driver.removeAllChannels()
  await destroyCompany(admin, acme)
})

describe('duty events over the socket', () => {
  it('reaches the driver when their own status changes on another device', async () => {
    const socket = await listen(
      driver,
      'duty_status_events',
      `driver_id=eq.${acme.driverId}`,
    )

    /*
      Written with the secret key. That stands in for the driver's other phone
      as far as this test is concerned: what matters is that the change did not
      originate on the socket that is listening.
    */
    const { error } = await admin.from('duty_status_events').insert({
      org_id: acme.orgId,
      driver_id: acme.driverId,
      vehicle_id: acme.vehicleId,
      status: 'driving',
      started_at: new Date().toISOString(),
      source: 'manual',
    })
    expect(error).toBeNull()

    expect(await socket.wait()).not.toBeNull()
  }, 40_000)

  it('does not reach a driver when a colleague’s status changes', async () => {
    /*
      Subscribed on the COLLEAGUE's filter, from the driver's own socket. If
      the select policy were not enforced per row on the wire, this is where a
      whole depot's log would leak into one phone.
    */
    const socket = await listen(
      driver,
      'duty_status_events',
      `driver_id=eq.${acme.colleagueDriverId}`,
    )

    const { error } = await admin.from('duty_status_events').insert({
      org_id: acme.orgId,
      driver_id: acme.colleagueDriverId,
      status: 'driving',
      started_at: new Date().toISOString(),
      source: 'manual',
    })
    expect(error).toBeNull()

    expect(await socket.wait()).toBeNull()
  }, 40_000)

  it('reaches the driver when a day is certified elsewhere', async () => {
    const socket = await listen(driver, 'hos_daily_logs', `driver_id=eq.${acme.driverId}`)

    const { error } = await admin.from('hos_daily_logs').insert({
      org_id: acme.orgId,
      driver_id: acme.driverId,
      log_date: new Date().toISOString().slice(0, 10),
      certified_at: new Date().toISOString(),
      // The table refuses a certified row that claims nobody signed it:
      // certified_at and certified_count have to agree.
      certified_count: 1,
    })
    expect(error).toBeNull()

    expect(await socket.wait()).not.toBeNull()
  }, 40_000)
})
