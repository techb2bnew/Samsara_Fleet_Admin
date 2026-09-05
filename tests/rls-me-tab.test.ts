/**
 * Everything the driver app's Me tab reads, proved to arrive.
 *
 * This suite exists because of a specific failure. A course was created in the
 * console and never appeared on the phone — not with an error, with an empty
 * list, because the row was a draft and RLS returned nothing. Silence is what
 * a policy mistake looks like from inside the app, and every screen in the Me
 * tab reads through a different one.
 *
 * So each screen gets the same three questions:
 *   - does the driver get their own row
 *   - do they NOT get a colleague's
 *   - do they NOT get another company's
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

const seeded: Record<string, string> = {}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'me-acme', runId)
  globex = await createCompany(admin, 'me-globex', runId)

  const today = new Date().toISOString().slice(0, 10)

  /* One row per screen, for the driver, a colleague and another company. */
  for (const [label, driverId, orgId] of [
    ['mine', acme.driverId, acme.orgId],
    ['colleague', acme.colleagueDriverId, acme.orgId],
    ['other', globex.driverId, globex.orgId],
  ] as const) {
    const log = await admin
      .from('hos_daily_logs')
      .insert({
        org_id: orgId,
        driver_id: driverId,
        log_date: today,
        certified_at: new Date().toISOString(),
        certified_count: 1,
      })
      .select('id')
      .single()
    if (log.error) throw new Error(`log ${label}: ${log.error.message}`)
    seeded[`log-${label}`] = log.data.id

    const defect = await admin
      .from('defects')
      .insert({
        org_id: orgId,
        vehicle_id: label === 'other' ? globex.vehicleId : acme.vehicleId,
        reported_by_driver: driverId,
        area: 'Brakes',
        finding: `reported by ${label}`,
        severity: 'major',
        status: 'open',
      })
      .select('id')
      .single()
    if (defect.error) throw new Error(`defect ${label}: ${defect.error.message}`)
    seeded[`defect-${label}`] = defect.data.id

    const doc = await admin
      .from('documents')
      .insert({
        org_id: orgId,
        category: 'compliance',
        driver_id: driverId,
        doc_type: 'licence',
        title: `licence ${label}`,
        storage_path: `${orgId}/driver/${driverId}/${runId}-licence.pdf`,
      })
      .select('id')
      .single()
    if (doc.error) throw new Error(`document ${label}: ${doc.error.message}`)
    seeded[`doc-${label}`] = doc.data.id

    const settings = await admin
      .from('driver_settings')
      .upsert(
        { org_id: orgId, driver_id: driverId, distance_unit: 'km' },
        { onConflict: 'driver_id' },
      )
      .select('driver_id')
      .single()
    if (settings.error) throw new Error(`settings ${label}: ${settings.error.message}`)
  }

  driver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
}, 120_000)

afterAll(async () => {
  await destroyCompany(admin, acme)
  await destroyCompany(admin, globex)
})

/** Ids of everything the signed-in driver gets back from one table. */
async function idsFrom(table: 'hos_daily_logs' | 'defects' | 'documents'): Promise<string[]> {
  const { data, error } = await driver.from(table).select('id')
  expect(error).toBeNull()
  return (data ?? []).map((r) => (r as { id: string }).id)
}

describe('My logs', () => {
  it('returns the driver’s own certifications and nobody else’s', async () => {
    const ids = await idsFrom('hos_daily_logs')
    expect(ids).toContain(seeded['log-mine'])
    expect(ids).not.toContain(seeded['log-colleague'])
    expect(ids).not.toContain(seeded['log-other'])
  })
})

describe('My fault reports', () => {
  it('returns the driver’s own defects and nobody else’s', async () => {
    const ids = await idsFrom('defects')
    expect(ids).toContain(seeded['defect-mine'])
    expect(ids).not.toContain(seeded['defect-colleague'])
    expect(ids).not.toContain(seeded['defect-other'])
  })
})

describe('My documents', () => {
  it('returns the driver’s own paperwork and nobody else’s', async () => {
    const ids = await idsFrom('documents')
    expect(ids).toContain(seeded['doc-mine'])
    expect(ids).not.toContain(seeded['doc-colleague'])
    expect(ids).not.toContain(seeded['doc-other'])
  })

  it('lets a driver file trip paperwork, under their own id', async () => {
    /*
      The whole point of the Add paperwork screen: a photographed delivery
      note is the driver's to file. The path has to sit under their own id —
      the storage policy keys on the third segment.
    */
    const { data, error } = await driver
      .from('documents')
      .insert({
        org_id: acme.orgId,
        category: 'trip',
        driver_id: acme.driverId,
        vehicle_id: acme.vehicleId,
        // uploaded_by_driver, not driver_id, is what the policy keys on:
        // one says who the document is about, the other who filed it.
        uploaded_by_driver: acme.driverId,
        doc_type: 'proof_of_delivery',
        title: 'Signed at gate 2',
        storage_path: `${acme.orgId}/trip/${acme.driverId}/${runId}-note.jpg`,
      })
      .select('id, category')
      .single()

    expect(error).toBeNull()
    expect(data?.category).toBe('trip')
  })

  it('refuses trip paperwork filed under a colleague', async () => {
    const { error } = await driver.from('documents').insert({
      org_id: acme.orgId,
      category: 'trip',
      driver_id: acme.colleagueDriverId,
      uploaded_by_driver: acme.colleagueDriverId,
      doc_type: 'receipt',
      title: 'not mine to file',
      storage_path: `${acme.orgId}/trip/${acme.colleagueDriverId}/${runId}-x.jpg`,
    })
    expect(error).not.toBeNull()
  })

  it('refuses a driver filing their own compliance paperwork', async () => {
    /*
      A driver who could add their own licence row could file an expired one as
      current. Reading it is theirs; writing it is the office's.
    */
    const { error } = await driver.from('documents').insert({
      org_id: acme.orgId,
      category: 'compliance',
      driver_id: acme.driverId,
      doc_type: 'licence',
      title: 'forged',
      storage_path: `${acme.orgId}/driver/${acme.driverId}/forged.pdf`,
    })
    expect(error).not.toBeNull()
  })
})

describe('My inspections', () => {
  it('returns the driver’s own submissions and nobody else’s', async () => {
    /* A submission has to point at a form — the column is not null. */
    const form = await admin
      .from('forms')
      .insert({
        org_id: acme.orgId,
        key: `pretrip-${runId}`,
        version: 1,
        name: 'Pre-trip',
        kind: 'dvir_pre',
        status: 'published',
        published_at: new Date().toISOString(),
        fields: [{ id: 'brakes', label: 'Brakes', type: 'pass_fail', required: true }],
      })
      .select('id')
      .single()
    if (form.error) throw new Error(form.error.message)

    const mine = await admin
      .from('form_submissions')
      .insert({
        org_id: acme.orgId,
        form_id: form.data.id,
        driver_id: acme.driverId,
        vehicle_id: acme.vehicleId,
        answers: { Brakes: 'pass' },
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .select('id')
      .single()
    if (mine.error) throw new Error(mine.error.message)

    const theirs = await admin
      .from('form_submissions')
      .insert({
        org_id: acme.orgId,
        form_id: form.data.id,
        driver_id: acme.colleagueDriverId,
        vehicle_id: acme.vehicleId,
        answers: { Brakes: 'pass' },
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .select('id')
      .single()
    if (theirs.error) throw new Error(theirs.error.message)

    const { data, error } = await driver.from('form_submissions').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(mine.data.id)
    expect(ids).not.toContain(theirs.data.id)
  })
})

describe('Settings', () => {
  it('lets the driver read and change their own', async () => {
    const read = await driver
      .from('driver_settings')
      .select('driver_id, distance_unit')
      .eq('driver_id', acme.driverId)
      .maybeSingle()
    expect(read.error).toBeNull()
    expect(read.data?.driver_id).toBe(acme.driverId)

    const written = await driver
      .from('driver_settings')
      .upsert(
        { org_id: acme.orgId, driver_id: acme.driverId, distance_unit: 'mi' },
        { onConflict: 'driver_id' },
      )
      .select('distance_unit')
      .single()
    expect(written.error).toBeNull()
    expect(written.data?.distance_unit).toBe('mi')
  })

  it('refuses a colleague’s settings, read and write', async () => {
    const read = await driver
      .from('driver_settings')
      .select('driver_id')
      .eq('driver_id', acme.colleagueDriverId)
    expect(read.error).toBeNull()
    /* Not an error — no rows. Which is why this is asserted on the rows. */
    expect(read.data ?? []).toHaveLength(0)

    const write = await driver
      .from('driver_settings')
      .update({ distance_unit: 'mi' })
      .eq('driver_id', acme.colleagueDriverId)
      .select('driver_id')
    expect(write.data ?? []).toHaveLength(0)
  })

  it('creates a row the first time, for a driver who has none', async () => {
    /*
      The screen upserts, because a driver who has never opened it has no row.
      Proved rather than assumed: an insert refused by the policy would look
      like a switch that silently will not stay flipped.
    */
    await admin.from('driver_settings').delete().eq('driver_id', acme.driverId)

    const { error } = await driver.from('driver_settings').upsert(
      { org_id: acme.orgId, driver_id: acme.driverId, distance_unit: 'km' },
      { onConflict: 'driver_id' },
    )
    expect(error).toBeNull()
  })
})
