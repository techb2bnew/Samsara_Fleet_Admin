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
/*
 * Where the app is published.
 *
 * A copy. An Edge Function runs on Deno inside Supabase and cannot import from
 * the console's source, so src/constants/links.ts holds the same two strings —
 * change one, change the other.
 */
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.base2brand.samsaradriver'
const APP_STORE_URL = 'https://apps.apple.com/us/app/b2bsamsaradriver/id6811781965'

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
      /* The app comes before the password: this email is read on a phone that
         does not have it yet, and a password with nothing to type it into is
         the reason the office gets a call. */
      `1. Install the app`,
      ``,
      `   Android: ${PLAY_STORE_URL}`,
      `   iPhone:  ${APP_STORE_URL}`,
      ``,
      `2. Open it and sign in with:`,
      ``,
      `   Email:    ${driverEmail}`,
      `   Password: ${password}`,
      ``,
      `This password does not expire. Keep using it to sign in until you change`,
      `it with Forgot password in the app.`,
      ``,
      `Anyone who can read this email can sign in as you, so do not forward it.`,
      ``,
      `If you were not expecting this, tell your fleet office.`,
    ].join('\n'),
    html: driverEmailHtml(name, orgName, driverEmail, password),
  }
}

/*
 * The same email as HTML, so the store links are buttons a driver can press.
 *
 * It goes alongside the plain text, never instead of it: the text part is what
 * a client with HTML switched off shows, and what a screen reader reads first.
 *
 * Written the way email has to be written rather than the way the console is —
 * tables, inline styles, no stylesheet. Outlook renders a <div> button as flat
 * text and ignores border-radius on an <a>, so each button is a table cell
 * with the background on the cell.
 */
function driverEmailHtml(
  name: string,
  orgName: string,
  driverEmail: string,
  password: string,
) {
  /* Anything interpolated could carry a < or an &: a fleet called "Smith & Co"
     would otherwise arrive as "Smith  Co", and a name is user input. */
  const safe = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const sans = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
  const button = (href: string, label: string) =>
    `<td style="background:#D96B2B;border-radius:8px;">` +
    `<a href="${href}" style="display:inline-block;padding:12px 20px;${sans};` +
    `font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a></td>`

  return `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#F4F1EC;${sans};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
       style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;
              border:1px solid #E6E0D6;">
  <tr><td style="padding:32px 32px 8px;">
    <p style="margin:0 0 18px;font-size:15px;color:#1A1612;">Hello ${safe(name)},</p>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.55;color:#4A443C;">
      ${safe(orgName)} has set up your driver app account.
    </p>

    <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.06em;
              text-transform:uppercase;color:#D96B2B;">1 &nbsp;Install the app</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px;">
      <tr>
        ${button(PLAY_STORE_URL, 'Get it on Google Play')}
        <td style="width:10px;">&nbsp;</td>
        ${button(APP_STORE_URL, 'Download for iPhone')}
      </tr>
    </table>

    <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.06em;
              text-transform:uppercase;color:#D96B2B;">2 &nbsp;Open it and sign in</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;background:#FBF6F1;border:1px solid #EFE2D6;border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:11.5px;letter-spacing:0.05em;
                  text-transform:uppercase;color:#8A8075;">Email</p>
        <p style="margin:0 0 14px;font-size:15px;font-family:ui-monospace,Menlo,Consolas,monospace;
                  color:#1A1612;">${safe(driverEmail)}</p>
        <p style="margin:0 0 4px;font-size:11.5px;letter-spacing:0.05em;
                  text-transform:uppercase;color:#8A8075;">Password</p>
        <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:0.06em;
                  font-family:ui-monospace,Menlo,Consolas,monospace;color:#1A1612;">${safe(password)}</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px 30px;">
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6B6257;">
      This password does not expire. Keep using it to sign in until you change it
      with <strong style="color:#4A443C;">Forgot password</strong> in the app.
    </p>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6B6257;">
      Anyone who can read this email can sign in as you, so do not forward it.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6B6257;">
      If you were not expecting this, tell your fleet office.
    </p>
  </td></tr>
</table>
</body></html>`
}

/**
 * Sends one message over SMTP, by hand.
 *
 * ---------------------------------------------------------------------------
 * Why not a library
 * ---------------------------------------------------------------------------
 * denomailer was here and it killed the isolate: the function returned 503 on
 * every send, and a dead isolate returns no CORS headers, so the browser
 * reported a CORS failure and sent us looking for a missing header that was
 * never missing.
 *
 * The runtime was never the problem. Probing it directly showed a plain socket
 * to smtp.gmail.com:587 answering in 656ms with its greeting, implicit TLS on
 * 465 answering in 499ms, and Deno.startTls upgrading a 587 connection in
 * 514ms. Everything SMTP needs works here.
 *
 * So the conversation is written out. It is eighty lines, it uses only what
 * was proven to work, and when it fails it fails with a sentence instead of a
 * crash.
 *
 * ---------------------------------------------------------------------------
 * The conversation
 * ---------------------------------------------------------------------------
 *   greeting → EHLO → AUTH LOGIN → MAIL FROM → RCPT TO → DATA → . → QUIT
 *
 * Each step's reply starts with a three digit code. A hyphen after it means
 * more lines follow, a space means that was the last — which is why the reader
 * below cannot simply take one line and move on.
 */
async function sendOverSmtp(
  to: string,
  from: string,
  subject: string,
  text: string,
  html: string,
): Promise<string | null> {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASSWORD')
  if (!host || !user || !pass) return 'SMTP is not configured on this project'

  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let conn: Deno.Conn | null = null

  /** Reads until a line whose code is followed by a space: the last one. */
  async function reply(): Promise<string> {
    let out = ''
    const buf = new Uint8Array(4096)
    while (true) {
      const n = await conn!.read(buf)
      if (n === null) break
      out += decoder.decode(buf.subarray(0, n))
      if (/^\d{3} [^\n]*\r?\n$/m.test(out.split(/\r?\n/).slice(-2)[0] + '\n')) break
      if (/(^|\n)\d{3} [^\n]*\r?\n$/.test(out)) break
    }
    return out.trim()
  }

  async function say(line: string): Promise<string> {
    await conn!.write(encoder.encode(line + '\r\n'))
    return await reply()
  }

  /** Every step states the code it expects, so a failure names its own step. */
  function expect(got: string, code: string, step: string): string | null {
    return got.startsWith(code) ? null : `${step} failed: ${got.split(/\r?\n/)[0]}`
  }

  try {
    if (port === 465) {
      conn = await Deno.connectTls({ hostname: host, port })
    } else {
      /* 587 opens in the clear and is upgraded in place, which is what
         STARTTLS means. The credentials go after the upgrade, never before. */
      const plain = await Deno.connect({ hostname: host, port })
      conn = plain
      const greeting = await reply()
      const bad = expect(greeting, '220', 'connecting')
      if (bad) return bad
      const ehlo = await say(`EHLO ${host}`)
      const badEhlo = expect(ehlo, '250', 'EHLO')
      if (badEhlo) return badEhlo
      const starttls = await say('STARTTLS')
      const badStart = expect(starttls, '220', 'STARTTLS')
      if (badStart) return badStart
      conn = await Deno.startTls(plain, { hostname: host })
    }

    if (port === 465) {
      const bad = expect(await reply(), '220', 'connecting')
      if (bad) return bad
    }

    const ehlo = await say(`EHLO ${host}`)
    const badEhlo = expect(ehlo, '250', 'EHLO')
    if (badEhlo) return badEhlo

    /* AUTH LOGIN: the username and password each go as their own base64 line.
       An app password, not the account password — Google stopped accepting
       those in 2022, and two-step verification has to be on to make one. */
    const badAuth = expect(await say('AUTH LOGIN'), '334', 'AUTH')
    if (badAuth) return badAuth
    const badUser = expect(await say(btoa(user)), '334', 'username')
    if (badUser) return badUser
    const badPass = expect(await say(btoa(pass)), '235', 'password')
    if (badPass) return badPass

    const badFrom = expect(await say(`MAIL FROM:<${from}>`), '250', 'MAIL FROM')
    if (badFrom) return badFrom
    const badTo = expect(await say(`RCPT TO:<${to}>`), '250', 'RCPT TO')
    if (badTo) return badTo
    const badData = expect(await say('DATA'), '354', 'DATA')
    if (badData) return badData

    /*
     * Both versions, in one message.
     *
     * multipart/alternative means "the same email twice" — a client picks the
     * last part it can render, so the HTML wins wherever HTML works and the
     * text is there when it does not. The order matters: plainest first.
     *
     * Two things every line has to survive:
     *   - a lone dot ends the message, so any line STARTING with one is
     *     doubled. Not just a line that is only a dot: ".com" on its own line
     *     would be eaten the same way.
     *   - SMTP lines end in CRLF, and these templates are written with \n.
     */
    const part = (content: string) =>
      content.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..')

    /* Random, so it cannot collide with anything in the body above. */
    const edge = `b2b-${crypto.randomUUID()}`

    const body = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${edge}"`,
      '',
      `--${edge}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      part(text),
      '',
      `--${edge}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      part(html),
      '',
      `--${edge}--`,
      '.',
    ].join('\r\n')

    const badSend = expect(await say(body), '250', 'sending')
    if (badSend) return badSend

    await say('QUIT')
    return null
  } catch (cause) {
    const why = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
    return `could not send from "${from}" to "${to}" via ${host}:${port} — ${why}`
  } finally {
    /* Always closed. A leaked socket outlives the invocation. */
    try {
      conn?.close()
    } catch {
      // Already gone.
    }
  }
}

Deno.serve(async (request) => {
  try {
    return await handle(request)
  } catch (cause) {
    const why = cause instanceof Error ? cause.message : String(cause)
    return json({ error: `The invitation failed unexpectedly: ${why}` }, 500)
  }
})

async function handle(request: Request): Promise<Response> {
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
  const { subject, text, html } = driverEmailBody(name, orgName, email, password)

  /*
   * The From is the authenticated account unless told otherwise. Gmail
   * rewrites a From it does not own, so defaulting to anything else would not
   * error — it would just silently not be what was set.
   */
  const from = Deno.env.get('INVITE_EMAIL_FROM') ?? Deno.env.get('SMTP_USER') ?? ''
  const emailProblem = await sendOverSmtp(email, from, subject, text, html)

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
}
