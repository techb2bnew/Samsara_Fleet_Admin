/**
 * A fleet's own hours rule book: who can read it, who can write it, and what
 * numbers the database refuses.
 *
 * ---------------------------------------------------------------------------
 * Why this suite exists
 * ---------------------------------------------------------------------------
 * The table shipped with row-level security and policies and no GRANT, which
 * are two different things — RLS decides which ROWS a role sees, a grant
 * decides whether it may touch the table at all. PostgREST refused before any
 * policy was consulted, and because the settings screen read the rule books
 * alongside the organisation, one missing grant blanked out the organisation's
 * name, country and timezone. Nothing caught it because nothing here read the
 * table as a signed-in user.
 *
 * So the first test is the dull one: an office user can select from it.
 *
 * The constraint tests matter for a different reason. These numbers drive the
 * violations engine and the remaining-hours clocks a driver reads before
 * deciding whether to keep going, and nothing checks them against any statute.
 * The database refusing the impossible ones is the only guard there is.
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
let office: SupabaseClient<Database>
let driver: SupabaseClient<Database>
let otherOffice: SupabaseClient<Database>

/** A rule book belonging to acme. */
let bookId: string

/** Valid, and deliberately not either built-in regime. */
const SANE = {
  daily_driving_minutes: 9 * 60,
  duty_window_minutes: 13 * 60,
  driving_before_break_minutes: 5 * 60,
  break_length_minutes: 40,
  cycle_minutes: 60 * 60,
  cycle_days: 7,
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'acme', runId)
  globex = await createCompany(admin, 'globex', runId)

  office = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  otherOffice = await signedInClient(globex.adminEmail, TEST_PASSWORD)
  driver = await signedInClient(acme.driverEmail, TEST_PASSWORD)

  const { data, error } = await admin
    .from('hos_rule_books')
    .insert({ org_id: acme.orgId, name: `${runId} winter policy`, ...SANE })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  bookId = data.id
}, 120_000)

afterAll(async () => {
  await admin.from('organizations').update({ hos_rule_book_id: null }).eq('id', acme.orgId)
  await admin.from('hos_rule_books').delete().eq('org_id', acme.orgId)
  await destroyCompany(admin, acme)
  await destroyCompany(admin, globex)
}, 120_000)

describe('reading', () => {
  it('lets the office read its own fleet’s rule books', async () => {
    // The grant test. It failed for real, and it looked like lost data.
    const { data, error } = await office
      .from('hos_rule_books')
      .select('id, name, daily_driving_minutes')
      .eq('org_id', acme.orgId)

    expect(error).toBeNull()
    expect(data?.map((b) => b.id)).toContain(bookId)
  })

  it('lets a driver read the rule book their fleet is on', async () => {
    /*
     * Not optional. The app works out its own violations and its own clocks on
     * the phone, so without these numbers it cannot draw the hours screen at
     * all — it would show four dashes and no reason.
     */
    const { data, error } = await driver.from('hos_rule_books').select('id, cycle_days')

    expect(error).toBeNull()
    expect(data?.map((b) => b.id)).toContain(bookId)
  })

  it('shows another company nothing', async () => {
    const { data, error } = await otherOffice.from('hos_rule_books').select('id')

    expect(error).toBeNull()
    expect(data?.map((b) => b.id) ?? []).not.toContain(bookId)
  })
})

describe('writing', () => {
  it('lets the office add one', async () => {
    const { data, error } = await office
      .from('hos_rule_books')
      .insert({ org_id: acme.orgId, name: `${runId} summer policy`, ...SANE })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
  })

  it('refuses a driver writing one', async () => {
    // A driver reads the limits they are judged against. They do not set them.
    const { error } = await driver
      .from('hos_rule_books')
      .insert({ org_id: acme.orgId, name: `${runId} driver wrote this`, ...SANE })

    expect(error).not.toBeNull()
  })

  it('refuses another company writing into this one', async () => {
    const { error } = await otherOffice
      .from('hos_rule_books')
      .insert({ org_id: acme.orgId, name: `${runId} from globex`, ...SANE })

    expect(error).not.toBeNull()
  })

  it('refuses a second rule book with the same name', async () => {
    // Two identical labels in the dropdown would be unpickable.
    const { error } = await office
      .from('hos_rule_books')
      .insert({ org_id: acme.orgId, name: `${runId} winter policy`, ...SANE })

    expect(error?.message ?? '').toMatch(/hos_rule_books_name_unique|duplicate/i)
  })
})

describe('numbers the database will not accept', () => {
  /* Each of these is a bound no real rule book could be outside of. */
  const impossible: Array<[string, Partial<typeof SANE> & { name?: string }]> = [
    ['driving longer than the day it sits in', { daily_driving_minutes: 25 * 60 }],
    [
      'a duty window shorter than the driving inside it',
      { daily_driving_minutes: 10 * 60, duty_window_minutes: 8 * 60 },
    ],
    [
      'a break threshold longer than the whole driving limit',
      { driving_before_break_minutes: 20 * 60 },
    ],
    ['a cycle shorter than one day of driving', { cycle_minutes: 60 }],
    ['a cycle of zero days', { cycle_days: 0 }],
    ['a cycle longer than a fortnight', { cycle_days: 20 }],
    ['a blank name', { name: '   ' }],
  ]

  for (const [what, override] of impossible) {
    it(`refuses ${what}`, async () => {
      const { error } = await office
        .from('hos_rule_books')
        .insert({
          org_id: acme.orgId,
          name: `${runId} ${what}`,
          ...SANE,
          ...override,
        })

      expect(error).not.toBeNull()
    })
  }

  it('accepts no duty window at all, which is what the EU has', async () => {
    // Null has to stay expressible: a 0 or a 24-hour default would both show
    // the driver a clock that means nothing.
    const { error } = await office
      .from('hos_rule_books')
      .insert({
        org_id: acme.orgId,
        name: `${runId} no window`,
        ...SANE,
        duty_window_minutes: null,
      })

    expect(error).toBeNull()
  })
})

describe('deleting', () => {
  it('refuses to delete the rule book a fleet is running on', async () => {
    /*
     * ON DELETE RESTRICT. Set-null would let somebody delete the book their
     * own drivers are judged against and have every remaining-hours clock
     * silently change, with nothing said and nothing to point at afterwards.
     */
    await admin.from('organizations').update({ hos_rule_book_id: bookId }).eq('id', acme.orgId)

    const { error } = await office.from('hos_rule_books').delete().eq('id', bookId)
    expect(error).not.toBeNull()

    await admin.from('organizations').update({ hos_rule_book_id: null }).eq('id', acme.orgId)
  })

  it('allows deleting one nothing is using', async () => {
    const { data } = await admin
      .from('hos_rule_books')
      .insert({ org_id: acme.orgId, name: `${runId} unused`, ...SANE })
      .select('id')
      .single()

    const { error } = await office.from('hos_rule_books').delete().eq('id', data!.id)
    expect(error).toBeNull()
  })
})
