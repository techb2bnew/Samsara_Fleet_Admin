/**
 * Row-level security: drivers, vehicles and maintenance.
 *
 * Two separate questions are checked here.
 *
 *   1. Company isolation, the same as the tenancy suite - can Acme reach
 *      anything of Globex's?
 *   2. Driver isolation, which is stricter and only applies to these tables.
 *      A driver signs into the phone app and must see their own records and
 *      nothing about a colleague, even though both work for the same company.
 *
 * The second one is easy to get wrong, because the obvious org-level policy
 * looks correct and quietly shows every driver the whole roster.
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
let acmeMechanic: SupabaseClient<Database>
let acmeDriver: SupabaseClient<Database>
let globexAdmin: SupabaseClient<Database>

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'fleetacme', runId)
  globex = await createCompany(admin, 'fleetglobex', runId)

  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  acmeDispatcher = await signedInClient(acme.dispatcherEmail, TEST_PASSWORD)
  acmeMechanic = await signedInClient(acme.mechanicEmail, TEST_PASSWORD)
  acmeDriver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
  globexAdmin = await signedInClient(globex.adminEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  if (acme) await destroyCompany(admin, acme)
  if (globex) await destroyCompany(admin, globex)
}, 90_000)

// ---------------------------------------------------------------------------

describe('vehicles — company isolation', () => {
  it('office staff see only their own vehicles', async () => {
    const { data } = await acmeAdmin.from('vehicles').select('id')
    expect(data?.map((r) => r.id)).toEqual([acme.vehicleId])
  })

  it('a vehicle from another company is not readable by id', async () => {
    const { data } = await acmeAdmin.from('vehicles').select('id').eq('id', globex.vehicleId)
    expect(data).toEqual([])
  })

  it('a user cannot add a vehicle to another company', async () => {
    const { error } = await acmeAdmin
      .from('vehicles')
      .insert({ org_id: globex.orgId, plate: `PLANTED-${runId}` })
      .select()
    expect(error).not.toBeNull()
  })

  it('a user cannot take another company\'s vehicle out of service', async () => {
    await globexAdmin.from('vehicles').update({ status: 'out_of_service' }).eq('id', acme.vehicleId)
    const { data } = await admin.from('vehicles').select('status').eq('id', acme.vehicleId).single()
    expect(data?.status).toBe('active')
  })

  it('a dispatcher can read vehicles but not change them', async () => {
    const { data } = await acmeDispatcher.from('vehicles').select('id')
    expect(data?.map((r) => r.id)).toEqual([acme.vehicleId])

    await acmeDispatcher.from('vehicles').update({ name: 'renamed by dispatcher' }).eq('id', acme.vehicleId)
    const { data: after } = await admin.from('vehicles').select('name').eq('id', acme.vehicleId).single()
    expect(after?.name).not.toBe('renamed by dispatcher')
  })
})

describe('work orders — role boundaries', () => {
  it('a mechanic can raise a work order in their own company', async () => {
    const { data, error } = await acmeMechanic
      .from('work_orders')
      .insert({ org_id: acme.orgId, vehicle_id: acme.vehicleId, title: 'Brake check' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
  })

  it('a mechanic cannot raise a work order in another company', async () => {
    const { error } = await acmeMechanic
      .from('work_orders')
      .insert({ org_id: globex.orgId, vehicle_id: globex.vehicleId, title: 'Planted job' })
      .select()
    expect(error).not.toBeNull()
  })

  it('a dispatcher cannot raise a work order', async () => {
    const { error } = await acmeDispatcher
      .from('work_orders')
      .insert({ org_id: acme.orgId, vehicle_id: acme.vehicleId, title: 'Dispatcher job' })
      .select()
    expect(error).not.toBeNull()
  })

  it('work orders from another company are invisible', async () => {
    await admin
      .from('work_orders')
      .insert({ org_id: globex.orgId, vehicle_id: globex.vehicleId, title: 'Globex private job' })

    const { data } = await acmeAdmin.from('work_orders').select('title')
    expect(data?.some((r) => r.title === 'Globex private job')).toBe(false)
  })
})

describe('drivers — company isolation', () => {
  it('office staff see every driver in their own company', async () => {
    const { data } = await acmeAdmin.from('drivers').select('id')
    expect(data?.length).toBe(2)
  })

  it('a driver from another company is not readable by id', async () => {
    const { data } = await acmeAdmin.from('drivers').select('id').eq('id', globex.driverId)
    expect(data).toEqual([])
  })

  it('a user cannot add a driver to another company', async () => {
    const { error } = await acmeAdmin
      .from('drivers')
      .insert({ org_id: globex.orgId, first_name: 'Planted', last_name: 'Driver' })
      .select()
    expect(error).not.toBeNull()
  })

  it('a dispatcher cannot edit driver records', async () => {
    await acmeDispatcher.from('drivers').update({ last_name: 'Renamed' }).eq('id', acme.driverId)
    const { data } = await admin.from('drivers').select('last_name').eq('id', acme.driverId).single()
    expect(data?.last_name).not.toBe('Renamed')
  })
})

describe('drivers — a driver only sees themselves', () => {
  it('the signed-in driver can read their own record', async () => {
    const { data } = await acmeDriver.from('drivers').select('id').eq('id', acme.driverId)
    expect(data?.map((r) => r.id)).toEqual([acme.driverId])
  })

  it('the driver cannot see a colleague in the same company', async () => {
    const { data } = await acmeDriver.from('drivers').select('id').eq('id', acme.colleagueDriverId)
    expect(data).toEqual([])
  })

  it('listing drivers returns exactly one row for a driver', async () => {
    const { data } = await acmeDriver.from('drivers').select('id')
    expect(data?.map((r) => r.id)).toEqual([acme.driverId])
  })

  it('the driver cannot see anyone from another company', async () => {
    const { data } = await acmeDriver.from('drivers').select('id').eq('id', globex.driverId)
    expect(data).toEqual([])
  })

  it('the driver cannot edit their own record — that is the office\'s job', async () => {
    await acmeDriver.from('drivers').update({ last_name: 'SelfRenamed' }).eq('id', acme.driverId)
    const { data } = await admin.from('drivers').select('last_name').eq('id', acme.driverId).single()
    expect(data?.last_name).not.toBe('SelfRenamed')
  })

  it('the driver can register their own phone', async () => {
    const { error } = await acmeDriver
      .from('driver_devices')
      .insert({ org_id: acme.orgId, driver_id: acme.driverId, platform: 'ios' })
      .select()
    expect(error).toBeNull()
  })

  it('the driver cannot register a phone against a colleague', async () => {
    const { error } = await acmeDriver
      .from('driver_devices')
      .insert({ org_id: acme.orgId, driver_id: acme.colleagueDriverId, platform: 'ios' })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('driver documents', () => {
  it('a driver can read their own licence but not a colleague\'s', async () => {
    await admin.from('driver_documents').insert([
      { org_id: acme.orgId, driver_id: acme.driverId, doc_type: 'licence', reference: 'MINE' },
      { org_id: acme.orgId, driver_id: acme.colleagueDriverId, doc_type: 'licence', reference: 'THEIRS' },
    ])

    const { data } = await acmeDriver.from('driver_documents').select('reference')
    expect(data?.map((r) => r.reference)).toEqual(['MINE'])
  })

  it('another company cannot read those documents at all', async () => {
    const { data } = await globexAdmin.from('driver_documents').select('reference')
    expect(data?.some((r) => r.reference === 'MINE' || r.reference === 'THEIRS')).toBe(false)
  })

  it('a dispatcher cannot add a driver document', async () => {
    const { error } = await acmeDispatcher
      .from('driver_documents')
      .insert({ org_id: acme.orgId, driver_id: acme.driverId, doc_type: 'medical' })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('vehicle assignments', () => {
  it('a driver can put themselves on a vehicle', async () => {
    const { error } = await acmeDriver
      .from('driver_vehicle_assignments')
      .insert({ org_id: acme.orgId, driver_id: acme.driverId, vehicle_id: acme.vehicleId })
      .select()
    expect(error).toBeNull()
  })

  it('a driver cannot assign a colleague to a vehicle', async () => {
    const { error } = await acmeDriver
      .from('driver_vehicle_assignments')
      .insert({
        org_id: acme.orgId,
        driver_id: acme.colleagueDriverId,
        vehicle_id: acme.vehicleId,
      })
      .select()
    expect(error).not.toBeNull()
  })

  it('a driver cannot claim another company\'s vehicle', async () => {
    const { error } = await acmeDriver
      .from('driver_vehicle_assignments')
      .insert({ org_id: globex.orgId, driver_id: acme.driverId, vehicle_id: globex.vehicleId })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('signed-out visitors', () => {
  const tables = [
    'vehicles',
    'trailers',
    'assets',
    'vehicle_documents',
    'maintenance_schedules',
    'work_orders',
    'work_order_items',
    'drivers',
    'driver_documents',
    'driver_settings',
    'driver_devices',
    'co_driver_assignments',
    'driver_vehicle_assignments',
  ] as const

  for (const table of tables) {
    it(`cannot read ${table}`, async () => {
      const anon = anonClient()
      const { data, error } = await anon.from(table).select('*').limit(1)
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })
  }
})
