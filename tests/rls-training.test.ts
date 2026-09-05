/**
 * Course material in the training bucket, and progress a driver writes.
 *
 * Storage has no foreign keys, so its policies can only reason about the path:
 *
 *   <org_id>/<course_id>/<uuid>-<filename>
 *
 * The driver read policy leans on that entirely — it looks up the course id in
 * the second segment and lets the courses table answer whether the driver may
 * have it. That makes these tests the only thing standing between "a draft
 * course's file is private" and "anyone signed in can read any company's
 * training material", so each boundary gets its own case.
 *
 * A storage denial looks exactly like a missing file, which is why this is a
 * test and not a thing anybody could debug from the app.
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
const BUCKET = 'training'

let admin: SupabaseClient<Database>
let acme: Company
let globex: Company
let acmeDriver: SupabaseClient<Database>
let acmeAdmin: SupabaseClient<Database>
let globexDriver: SupabaseClient<Database>

/** A published course, visible to everyone in the organisation. */
let publishedCourseId: string
let publishedPath: string
/** A draft, which no driver should be able to reach — course row or file. */
let draftCourseId: string
let draftPath: string
/** Acme's assignment of the published course to Acme's own driver. */
let assignmentId: string

const FILE = new Blob(['%PDF-1.4 not really a pdf'], { type: 'application/pdf' })

async function createCourse(
  orgId: string,
  title: string,
  status: 'draft' | 'published',
): Promise<string> {
  const { data, error } = await admin
    .from('courses')
    .insert({
      org_id: orgId,
      title,
      description: 'Read this and mark it done.',
      length_minutes: 10,
      status,
      assigned_fleet_id: null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/** Uploaded with the secret key: these tests are about reading, not writing. */
async function seedFile(orgId: string, courseId: string): Promise<string> {
  const path = `${orgId}/${courseId}/${crypto.randomUUID()}-course.pdf`
  const { error } = await admin.storage.from(BUCKET).upload(path, FILE, {
    contentType: 'application/pdf',
  })
  if (error) throw new Error(error.message)
  const { error: linkErr } = await admin
    .from('courses')
    .update({ content_url: path })
    .eq('id', courseId)
  if (linkErr) throw new Error(linkErr.message)
  return path
}

/**
 * Whether this client can actually pull the bytes.
 *
 * download(), not createSignedUrl(): signing is done by the storage API and a
 * denied read still hands back a URL that 400s when it is used. Downloading is
 * the only question the driver's phone is really asking.
 */
async function canRead(client: SupabaseClient<Database>, path: string): Promise<boolean> {
  const { data, error } = await client.storage.from(BUCKET).download(path)
  return !error && data !== null
}

beforeAll(async () => {
  assertConfig()
  admin = adminClient()

  acme = await createCompany(admin, 'training-acme', runId)
  globex = await createCompany(admin, 'training-globex', runId)

  publishedCourseId = await createCourse(acme.orgId, 'Monsoon driving', 'published')
  draftCourseId = await createCourse(acme.orgId, 'Half written course', 'draft')
  publishedPath = await seedFile(acme.orgId, publishedCourseId)
  draftPath = await seedFile(acme.orgId, draftCourseId)

  const { data: assignment, error } = await admin
    .from('course_assignments')
    .insert({
      org_id: acme.orgId,
      course_id: publishedCourseId,
      driver_id: acme.driverId,
      status: 'assigned',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  assignmentId = assignment.id

  acmeDriver = await signedInClient(acme.driverEmail, TEST_PASSWORD)
  acmeAdmin = await signedInClient(acme.adminEmail, TEST_PASSWORD)
  globexDriver = await signedInClient(globex.driverEmail, TEST_PASSWORD)
}, 90_000)

afterAll(async () => {
  await admin.storage.from(BUCKET).remove([publishedPath, draftPath])
  await destroyCompany(admin, acme)
  await destroyCompany(admin, globex)
})

describe('training bucket', () => {
  it('lets a driver read the material of a published course in their company', async () => {
    expect(await canRead(acmeDriver, publishedPath)).toBe(true)
  })

  it('refuses a draft course, whose file is a work in progress', async () => {
    expect(await canRead(acmeDriver, draftPath)).toBe(false)
  })

  it('refuses another company entirely', async () => {
    expect(await canRead(globexDriver, publishedPath)).toBe(false)
  })

  it('lets the office read its own drafts, which is how they get checked', async () => {
    expect(await canRead(acmeAdmin, draftPath)).toBe(true)
  })

  it('refuses the office of another company', async () => {
    const globexAdmin = await signedInClient(globex.adminEmail, TEST_PASSWORD)
    expect(await canRead(globexAdmin, publishedPath)).toBe(false)
  })

  it('refuses a driver writing into the bucket, material is the office’s job', async () => {
    const { error } = await acmeDriver.storage
      .from(BUCKET)
      .upload(`${acme.orgId}/${publishedCourseId}/${crypto.randomUUID()}-forged.pdf`, FILE)
    expect(error).not.toBeNull()
  })
})

describe('course progress', () => {
  it('lets a driver bank their own time and finish', async () => {
    const started = new Date().toISOString()

    const first = await acmeDriver
      .from('course_assignments')
      .update({ status: 'in_progress', seconds_spent: 240, started_at: started })
      .eq('id', assignmentId)
      .select('id')
    expect(first.error).toBeNull()
    expect(first.data).toHaveLength(1)

    const done = await acmeDriver
      .from('course_assignments')
      .update({
        status: 'completed',
        seconds_spent: 600,
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .select('seconds_spent, status')
    expect(done.error).toBeNull()
    expect(done.data?.[0]).toMatchObject({ seconds_spent: 600, status: 'completed' })
  })

  it('refuses a colleague’s assignment', async () => {
    const { data, error } = await admin
      .from('course_assignments')
      .insert({
        org_id: acme.orgId,
        course_id: publishedCourseId,
        driver_id: acme.colleagueDriverId,
        status: 'assigned',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    /*
      Nothing thrown and nothing changed. An update that matches no row under
      RLS is not an error, which is exactly why this is asserted on the rows
      returned rather than on error being set.
    */
    const attempt = await acmeDriver
      .from('course_assignments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', data.id)
      .select('id')
    expect(attempt.data ?? []).toHaveLength(0)

    await admin.from('course_assignments').delete().eq('id', data.id)
  })

  it('refuses a negative time, which could only come from a bug', async () => {
    const { error } = await acmeDriver
      .from('course_assignments')
      .update({ seconds_spent: -1 })
      .eq('id', assignmentId)
    expect(error).not.toBeNull()
  })
})
