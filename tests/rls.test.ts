/**
 * Row-level security: tenant isolation.
 *
 * Every test here answers one question: can a signed-in user reach data that
 * does not belong to their company?
 *
 * A failure in this file is not a bug to triage later. It means one customer
 * can read another customer's data, and nothing else ships until it is green.
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

/** Signed in as Acme's fleet admin. */
let acmeAdmin: SupabaseClient<Database>
/** Signed in as Acme's dispatcher — same company, fewer rights. */
let acmeDispatcher: SupabaseClient<Database>
/** Signed in as Globex's fleet admin — the other company entirely. */
let globexAdmin: SupabaseClient<Database>

beforeAll(async () => {
  assertConfig()
  admin = adminClient()
  acme = await createCompany(admin, 'acme', runId)
  globex = await createCompany(admin, 'globex', runId)

  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  acmeDispatcher = await signedInClient(acme.dispatcherEmail, TEST_PASSWORD)
  globexAdmin = await signedInClient(globex.adminEmail, TEST_PASSWORD)
}, 60_000)

afterAll(async () => {
  if (acme) await destroyCompany(admin, acme)
  if (globex) await destroyCompany(admin, globex)
}, 60_000)

// ---------------------------------------------------------------------------

describe('organizations', () => {
  it('a user sees their own company', async () => {
    const { data } = await acmeAdmin.from('organizations').select('id').eq('id', acme.orgId)
    expect(data?.map((r) => r.id)).toEqual([acme.orgId])
  })

  it('a user cannot see another company', async () => {
    const { data } = await acmeAdmin.from('organizations').select('id').eq('id', globex.orgId)
    expect(data).toEqual([])
  })

  it('listing every organization returns only the user\'s own', async () => {
    const { data } = await acmeAdmin.from('organizations').select('id')
    expect(data?.map((r) => r.id)).toEqual([acme.orgId])
  })

  it('a user cannot rename another company', async () => {
    await globexAdmin.from('organizations').update({ name: 'hijacked' }).eq('id', acme.orgId)

    // Read back with the admin client, which bypasses RLS, to be certain the
    // write did not land. A silent no-op and a rejected write are both fine;
    // the row changing is not.
    const { data } = await admin.from('organizations').select('name').eq('id', acme.orgId).single()
    expect(data?.name).not.toBe('hijacked')
  })

  it('nobody can create an organization through the API', async () => {
    const { error } = await acmeAdmin
      .from('organizations')
      .insert({ name: 'self-serve org' })
      .select()
    expect(error).not.toBeNull()
  })

  it('nobody can delete an organization through the API', async () => {
    await acmeAdmin.from('organizations').delete().eq('id', acme.orgId)
    const { data } = await admin.from('organizations').select('id').eq('id', acme.orgId)
    expect(data).toHaveLength(1)
  })
})

describe('fleets', () => {
  it('a user sees only their own fleets', async () => {
    const { data } = await acmeAdmin.from('fleets').select('id')
    expect(data?.map((r) => r.id)).toEqual([acme.fleetId])
  })

  it('a user cannot read another company\'s fleet by id', async () => {
    const { data } = await acmeAdmin.from('fleets').select('id').eq('id', globex.fleetId)
    expect(data).toEqual([])
  })

  it('a user cannot create a fleet inside another company', async () => {
    const { error } = await acmeAdmin
      .from('fleets')
      .insert({ org_id: globex.orgId, name: 'planted' })
      .select()
    expect(error).not.toBeNull()

    const { data } = await admin.from('fleets').select('id').eq('org_id', globex.orgId)
    expect(data).toHaveLength(1)
  })

  it('a dispatcher cannot create a fleet even in their own company', async () => {
    const { error } = await acmeDispatcher
      .from('fleets')
      .insert({ org_id: acme.orgId, name: 'dispatcher fleet' })
      .select()
    expect(error).not.toBeNull()
  })
})

describe('users', () => {
  it('a user can read their own profile', async () => {
    const { data } = await acmeAdmin.from('users').select('id').eq('id', acme.adminUserId)
    expect(data?.map((r) => r.id)).toEqual([acme.adminUserId])
  })

  it('a user can read a colleague in the same company', async () => {
    const { data } = await acmeAdmin.from('users').select('id').eq('id', acme.dispatcherUserId)
    expect(data?.map((r) => r.id)).toEqual([acme.dispatcherUserId])
  })

  it('a user cannot read someone from another company', async () => {
    const { data } = await acmeAdmin.from('users').select('id').eq('id', globex.adminUserId)
    expect(data).toEqual([])
  })

  it('a user cannot edit someone else\'s profile', async () => {
    await acmeAdmin.from('users').update({ full_name: 'renamed' }).eq('id', globex.adminUserId)
    const { data } = await admin.from('users').select('full_name').eq('id', globex.adminUserId).single()
    expect(data?.full_name).not.toBe('renamed')
  })
})

describe('role grants', () => {
  it('a user sees only grants inside their own company', async () => {
    const { data } = await acmeAdmin.from('user_roles').select('org_id')
    expect(data?.every((r) => r.org_id === acme.orgId)).toBe(true)
    expect(data?.length).toBeGreaterThan(0)
  })

  it('a fleet admin cannot grant themselves super admin', async () => {
    const { data: superRole } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'super_admin')
      .is('org_id', null)
      .single()

    // Attempt 1: a platform-wide grant, which is the shape a real super admin has.
    const platformWide = await acmeAdmin.from('user_roles').insert({
      user_id: acme.adminUserId,
      org_id: null,
      role_id: superRole!.id,
    })
    expect(platformWide.error).not.toBeNull()

    // Attempt 2: the same role scoped to their own org, which the policy also
    // has to refuse — otherwise is_super_admin() could be reached later by
    // widening the grant.
    const orgScoped = await acmeAdmin.from('user_roles').insert({
      user_id: acme.adminUserId,
      org_id: acme.orgId,
      role_id: superRole!.id,
    })
    expect(orgScoped.error).not.toBeNull()

    const { data: check } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', acme.adminUserId)
      .eq('role_id', superRole!.id)
    expect(check).toEqual([])
  })

  it('a fleet admin cannot grant a role inside another company', async () => {
    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'dispatcher')
      .is('org_id', null)
      .single()

    const { error } = await acmeAdmin.from('user_roles').insert({
      user_id: acme.adminUserId,
      org_id: globex.orgId,
      role_id: role!.id,
    })
    expect(error).not.toBeNull()
  })

  it('a dispatcher cannot grant roles at all', async () => {
    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'fleet_admin')
      .is('org_id', null)
      .single()

    const { error } = await acmeDispatcher.from('user_roles').insert({
      user_id: acme.dispatcherUserId,
      org_id: acme.orgId,
      role_id: role!.id,
    })
    expect(error).not.toBeNull()
  })
})

describe('roles and permissions', () => {
  it('system roles are readable, because the console renders their names', async () => {
    const { data } = await acmeAdmin.from('roles').select('key').is('org_id', null)
    expect(data?.length).toBe(7)
  })

  it('a user cannot modify a system role', async () => {
    await acmeAdmin.from('roles').update({ name: 'tampered' }).eq('key', 'super_admin')
    const { data } = await admin.from('roles').select('name').eq('key', 'super_admin').single()
    expect(data?.name).not.toBe('tampered')
  })

  // Per-module permissions moved onto the role itself in the lean pass, so this
  // is now the same question asked of a JSONB column: can a fleet admin widen
  // what a system role is allowed to do?
  it('a user cannot widen a system role\'s permissions', async () => {
    const { data: before } = await admin
      .from('roles')
      .select('id, module_permissions')
      .eq('key', 'viewer')
      .is('org_id', null)
      .single()

    const widened = {
      ...(before!.module_permissions as Record<string, unknown>),
      A04: { view: true, edit: true, delete: true },
    }
    await acmeAdmin.from('roles').update({ module_permissions: widened }).eq('id', before!.id)

    const { data: after } = await admin
      .from('roles')
      .select('module_permissions')
      .eq('id', before!.id)
      .single()
    expect(after?.module_permissions).toEqual(before!.module_permissions)
  })

  it('a system role carries its module permissions', async () => {
    const { data } = await acmeAdmin
      .from('roles')
      .select('module_permissions')
      .eq('key', 'viewer')
      .is('org_id', null)
      .single()

    const perms = data?.module_permissions as Record<string, { view: boolean; delete: boolean }>
    expect(Object.keys(perms).length).toBe(15)
    expect(perms.A04.view).toBe(true)
    expect(perms.A04.delete).toBe(false)
  })
})

describe('invitations', () => {
  it('a user cannot invite someone into another company', async () => {
    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'dispatcher')
      .is('org_id', null)
      .single()

    const { error } = await acmeAdmin.from('invitations').insert({
      org_id: globex.orgId,
      role_id: role!.id,
      email: 'intruder@example.com',
      token_hash: 'x'.repeat(64),
    })
    expect(error).not.toBeNull()
  })

  it('a user cannot read another company\'s invitations', async () => {
    const { data: role } = await admin
      .from('roles')
      .select('id')
      .eq('key', 'dispatcher')
      .is('org_id', null)
      .single()

    await admin.from('invitations').insert({
      org_id: globex.orgId,
      role_id: role!.id,
      email: `pending-${runId}@example.com`,
      token_hash: 'y'.repeat(64),
    })

    const { data } = await acmeAdmin.from('invitations').select('id')
    expect(data).toEqual([])
  })
})

describe('signed-out visitors', () => {
  const tables = [
    'organizations',
    'fleets',
    'users',
    'user_roles',
    'roles',
    'invitations',
  ] as const

  for (const table of tables) {
    it(`cannot read ${table}`, async () => {
      const anon = anonClient()
      const { data, error } = await anon.from(table).select('*').limit(1)
      // Either the request is refused outright or it returns nothing. Both are
      // acceptable; data leaking out is not.
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })
  }
})
