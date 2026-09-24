/**
 * Creates a driver's app account and emails them the login password over SMTP.
 *
 *   POST /functions/v1/invite-driver
 *   { "driverId": "<uuid>" }
 *
 * ---------------------------------------------------------------------------
 * Why this is a function and not console code
 * ---------------------------------------------------------------------------
 * Two things here cannot happen in a browser:
 *
 *   - Creating an auth account with a chosen password needs the secret key,
 *     which bypasses row-level security. That key never leaves a server.
 *   - Sending email needs a provider's API key, for the same reason.
 *
 * ---------------------------------------------------------------------------
 * About emailing a password
 * ---------------------------------------------------------------------------
 * The password does not expire. The driver keeps signing in with it until they
 * change it themselves through Forgot password in the app. That is the point:
 * a driver hired on Friday who opens the mail next week still gets in, and
 * the office is not on the phone resetting them.
 *
 * The cost is real and worth stating plainly: the password sits in that inbox
 * until they reset it, and anyone who reaches the inbox has the account. It
 * is generated here so nobody in the office ever sees it, and it is not
 * returned to the console unless the email could not be sent.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

/** Long enough to resist guessing, short enough to type in a cab. */
const PASSWORD_LENGTH = 8

/**
 * No 0/O/1/l/I. A driver reading this off a phone screen and typing it into
 * another phone will confuse them, and a login that fails for that reason
 * gets read as "the app is broken".
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * crypto.getRandomValues, not Math.random.
 *
 * Math.random is predictable from previous outputs. For a password that is
 * emailed and kept until the driver resets it, that is the difference between
 * a secret and a formality.
 */
function generatePassword(): string {
  const bytes = new Uint8Array(PASSWORD_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/**
 * The email the driver gets.
 *
 * This is the intended one, and the default. It goes to their own address, so
 * the office does not sit in the middle of a handover it has no reason to be
 * in.
 */
function driverEmailBody(
  name: string,
  orgName: string,
  driverEmail: string,
  password: string,
) {
  return {
    subject: `Your ${orgName} driver app login`,
    text: [
      `Hello ${name},`,
      ``,
      `${orgName} has set up your driver app account.`,
      ``,
      `Email:    ${driverEmail}`,
      `Password: ${password}`,
      ``,
      `This password does not expire. Keep using it to sign in until you change`,
      `it with Forgot password in the app.`,
      ``,
      `Anyone who can read this email can sign in as you, so do not forward it.`,
      ``,
      `If you were not expecting this, tell your fleet office.`,
    ].join('\n'),
  }
}

/**
 * Sends over SMTP.
 *
 * ---------------------------------------------------------------------------
 * Why a second way to send
 * ---------------------------------------------------------------------------
 * Resend refuses to deliver anywhere except its own signup address until a
 * sending DOMAIN is verified, and verifying one needs DNS records on a domain
 * the business actually controls. That is the right long-term answer and it
 * was not available: the address in INVITE_EMAIL_FROM was on a domain with no
 * DNS at all, so it could never have been verified.
 *
 * SMTP through a mailbox that already exists sidesteps the whole problem.
 * Google owns gmail.com and has verified it, so a Gmail account can send to
 * anybody from the moment it has an app password. No DNS, no waiting.
 *
 * The trade is worth knowing: mail sent this way comes FROM the gmail address,
 * and a fleet office seeing "someone@gmail.com" on a system email reads it as
 * less trustworthy than one from the company's own domain. Use it to get
 * moving; verify the domain to finish.
 *
 * ---------------------------------------------------------------------------
 * Gmail specifics
 * ---------------------------------------------------------------------------
 * An app password, not the account password — Google stopped accepting those
 * in 2022, and two-step verification has to be on before one can be made.
 *
 * The From must be the authenticated account or one of its aliases. Gmail
 * quietly rewrites anything else, so a mismatched INVITE_EMAIL_FROM would not
 * error, it would just silently not be what you set.
 */
async function sendOverSmtp(
  to: string,
  from: string,
  subject: string,
  text: string,
): Promise<string | null> {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASSWORD')
  if (!host || !user || !pass) return 'SMTP is not configured on this project'

  /* 465 with implicit TLS. 587 needs a STARTTLS upgrade mid-conversation,
     which is one more thing to go wrong for no gain here. */
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')

  const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: { username: user, password: pass },
    },
  })

  try {
    await client.send({ from, to, subject, content: text })
    return null
  } catch (cause) {
    const why = cause instanceof Error ? cause.message : String(cause)
    return `the mail server refused the message sending from "${from}" to "${to}": ${why}`
  } finally {
    /* Always closed. A leaked connection outlives the invocation, and the
       provider starts refusing new ones. */
    await client.close().catch(() => {})
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'This function is not configured.' }, 500)

  /*
   * Two clients, deliberately.
   *
   * `asCaller` carries the signed-in admin's token, so row-level security
   * decides whether they may see this driver at all. That is the authorisation
   * check: without it, any signed-in user could pass any driver's id and have
   * an account created in another company's fleet.
   *
   * `asService` then does the work that needs the secret key.
   */
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

  // Read as the caller. If they cannot see this driver, neither can this
  // function on their behalf.
  const { data: driver, error: readError } = await asCaller
    .from('drivers')
    .select('id, org_id, first_name, last_name, email, user_id, organizations(name)')
    .eq('id', driverId)
    .maybeSingle()

  if (readError) return json({ error: readError.message }, 403)
  if (!driver) return json({ error: 'No such driver, or you cannot see it.' }, 403)
  if (!driver.email) {
    return json({ error: 'That driver has no email address on file.' }, 400)
  }
  if (driver.user_id) {
    return json({ error: 'That driver already has an app account.' }, 409)
  }

  const name = `${driver.first_name} ${driver.last_name}`.trim()
  const orgName = (driver.organizations as { name: string } | null)?.name ?? 'your fleet'
  const email = String(driver.email).trim().toLowerCase()
  const password = generatePassword()

  const { data: created, error: createError } = await asService.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
    },
  })

  if (createError || !created.user) {
    /*
     * The commonest failure by far, and the one whose message needs help.
     *
     * Deleting a driver row does not delete their auth account — those live in
     * a different schema and nothing cascades between them. So a fleet that
     * clears out test drivers and re-adds the same email gets "already been
     * registered" from Supabase, which is true and tells nobody what to do
     * about it.
     */
    const message = createError?.message ?? 'The account could not be created.'
    if (/already.*registered|already exists/i.test(message)) {
      return json(
        {
          error:
            `An app account already exists for ${email}. Deleting a driver does not delete ` +
            `their sign-in, so this is usually one left behind by a driver who was removed. ` +
            `Remove it under Authentication → Users in Supabase, then invite again — or add ` +
            `this driver with a different email address.`,
        },
        409,
      )
    }
    return json({ error: message }, 400)
  }

  // The profile row and the link back to the driver. Without user_id set, the
  // driver signs in and the app has no idea which driver they are.
  await asService
    .from('users')
    .upsert({ id: created.user.id, email, full_name: name }, { onConflict: 'id' })

  const { error: linkError } = await asService
    .from('drivers')
    .update({ user_id: created.user.id })
    .eq('id', driver.id)

  if (linkError) {
    // Leaving an account that points at nothing would let them sign in to an
    // app that cannot place them, so it goes back.
    await asService.auth.admin.deleteUser(created.user.id)
    return json({ error: `The account could not be linked: ${linkError.message}` }, 500)
  }

  /*
   * One transport and one recipient: SMTP, to the driver.
   *
   * There was a second path here — Resend, plus an INVITE_EMAIL_TO override
   * that relayed the login to the office. Both existed for one reason: Resend
   * will not deliver anywhere except its own signup address until a sending
   * domain is verified, and the domain in question had no DNS at all.
   *
   * SMTP does not have that limitation, so neither the second transport nor
   * the relay has a reason to exist. Keeping a fallback nobody chose would
   * mean a failed send quietly going out from a different address.
   */
  const { subject, text } = driverEmailBody(name, orgName, email, password)

  /*
   * The From is the authenticated account unless told otherwise. Gmail
   * rewrites a From it does not own, so defaulting to anything else would not
   * error — it would just silently not be what was set.
   */
  const from = Deno.env.get('INVITE_EMAIL_FROM') ?? Deno.env.get('SMTP_USER') ?? ''
  const emailProblem = await sendOverSmtp(email, from, subject, text)

  if (emailProblem) {
    /*
     * The account exists and is linked; only the email failed. The password is
     * returned so the office can pass it on by hand rather than the driver
     * being locked out of an account they were never told about.
     *
     * This is the one path where the office sees the password, and it is
     * reported as a problem, not a success.
     */
    return json({
      ok: true,
      emailed: false,
      reason: emailProblem,
      email,
      password,
    })
  }

  return json({ ok: true, emailed: true, email, sentTo: email })
})
