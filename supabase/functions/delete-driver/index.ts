/**
 * Removes a driver from the roster, and their sign-in with them.
 *
 * ---------------------------------------------------------------------------
 * Soft, always. Never a real delete.
 * ---------------------------------------------------------------------------
 * duty_status_events references drivers ON DELETE CASCADE, so deleting the row
 * would take the driver's entire working-hours record with it — the one thing
 * in this schema that a fleet is legally required to keep and to produce at a
 * roadside inspection. A "Delete driver" button that quietly did that is the
 * worst button this console could have.
 *
 * So the row is marked deleted and stays. Everything that points at it still
 * resolves, and a log from six months ago still says whose it was.
 *
 * ---------------------------------------------------------------------------
 * Why the sign-in goes
 * ---------------------------------------------------------------------------
 * Two reasons, and the second is the one that bites.
 *
 * The obvious one: somebody removed from the roster should not still be able
 * to open the app and record hours.
 *
 * The other: an auth account holds the email address, and Supabase will not
 * create a second account on the same one. Leaving it behind means that email
 * can NEVER be used for a driver again — not by them coming back, not by
 * anybody. The console had exactly this, and the error it produced blamed a
 * driver "left behind by a driver who was removed" without being able to do
 * anything about it.
 *
 * Deleting the auth user cascades to public.users, which sets drivers.user_id
 * to null on its own.
 *
 * ---------------------------------------------------------------------------
 * Why a function rather than a query from the console
 * ---------------------------------------------------------------------------
 * Removing an auth account needs the secret key, which never goes near a
 * browser. The read that decides WHETHER this caller may do it runs as the
 * caller, so row-level security answers the permission question and this
 * function only does the part it has to.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'This project is not configured.' }, 500)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Not signed in.' }, 401)

  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const asService = createClient(url, secret, { auth: { persistSession: false } })

  let driverId: string
  try {
    const body = await request.json()
    driverId = String(body?.driverId ?? '')
  } catch {
    return json({ error: 'Send { driverId }.' }, 400)
  }
  if (!driverId) return json({ error: 'Send { driverId }.' }, 400)

  /*
   * Read as the caller. If row-level security will not show them this driver,
   * they may not remove it either — the permission question is answered by the
   * same rules the rest of the console runs on, not by a second copy of them
   * written here.
   */
  const { data: driver, error: readError } = await asCaller
    .from('drivers')
    .select('id, user_id, first_name, last_name, deleted_at')
    .eq('id', driverId)
    .maybeSingle()

  if (readError) return json({ error: readError.message }, 403)
  if (!driver) return json({ error: 'No such driver, or you cannot see it.' }, 403)
  if (driver.deleted_at) return json({ error: 'That driver has already been removed.' }, 409)

  /*
   * The sign-in first.
   *
   * If this fails the driver stays on the roster, which is recoverable — the
   * office tries again. The other order is not: a roster row marked deleted
   * with a live sign-in behind it is somebody who can still open the app and
   * record hours against a driver nobody can see.
   */
  if (driver.user_id) {
    const { error: authError } = await asService.auth.admin.deleteUser(driver.user_id)
    /*
     * Already gone is not a failure. It means a previous attempt got this far
     * and stopped, and refusing now would leave the roster row stranded for
     * good.
     */
    if (authError && !/not found|does not exist/i.test(authError.message)) {
      return json({ error: `The sign-in could not be removed: ${authError.message}` }, 500)
    }
  }

  const { error: markError } = await asService
    .from('drivers')
    .update({ deleted_at: new Date().toISOString(), user_id: null })
    .eq('id', driverId)

  if (markError) return json({ error: markError.message }, 500)

  return json({ ok: true, name: `${driver.first_name} ${driver.last_name}`.trim() })
})
