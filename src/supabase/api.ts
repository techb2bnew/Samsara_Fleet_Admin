import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, setRememberMe } from './client'
import { CONSOLE_ROLES } from '../config'
import type { AuthResult, Session } from '../features/auth/session'
import { displayName, personName } from '../lib/names'

/**
 * Every Supabase call the console makes lives in this file.
 *
 * Screens never import `supabase` directly — they call a function from here.
 * That keeps one place to look when a query is wrong, one place to change when
 * a table changes, and one place that knows how a database row becomes the
 * shape a screen expects.
 *
 * Only authentication is wired so far. Data functions get added below as each
 * module is switched over, under their own heading.
 */

/* ==========================================================================
   Authentication
   ========================================================================== */

/** "Priya Sharma" -> "PS". Falls back to the first letters of the email. */
function initialsOf(fullName: string, email: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

/**
 * Loads the console profile for an authenticated user.
 *
 * A Supabase token says who signed in; it does not say what they may do here.
 * That comes from `users`, `user_roles` and `organizations`, read back under
 * row-level security once the token exists.
 *
 * Returns null when the account authenticates but has no business being here:
 * no active role at all, or a role the console is not open to yet. Both are
 * real states — an invited user whose grant was revoked can still sign in, and
 * so can a driver — and neither must land in an empty console.
 */
export async function loadProfile(userId: string, email: string): Promise<Session | null> {
  const [{ data: profile }, { data: grants }] = await Promise.all([
    supabase.from('users').select('id, email, full_name').eq('id', userId).maybeSingle(),
    supabase
      .from('user_roles')
      .select('org_id, roles(key, name), organizations(id, name)')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .not('org_id', 'is', null),
  ])

  // Every active grant is read, not just the first. Someone can hold two roles,
  // and taking whichever row came back first would lock out a fleet admin who
  // also happens to be a dispatcher.
  //
  // Signed in but not admitted is a real state: a driver's account
  // authenticates perfectly well, it simply does not belong in this console.
  const grant = (grants ?? []).find(
    (g) => g.organizations && g.roles && (CONSOLE_ROLES as readonly string[]).includes(g.roles.key),
  )
  if (!grant?.organizations) return null

  // Capitalised on the way out, like a driver's. A colleague who typed
  // their own name in lower case at invitation time should not be shown
  // that way to everyone else.
  const fullName = displayName(profile?.full_name) || email.split('@')[0]

  // Records the visit, so the users screen can show when a colleague was last
  // here. Deliberately not awaited: the sign-in must not wait on it, and a
  // failure is not worth blocking anyone over.
  void supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)

  return {
    user: {
      id: userId,
      email: profile?.email ?? email,
      fullName,
      initials: initialsOf(fullName, email),
      roleName: grant.roles?.name ?? '',
    },
    organization: {
      id: grant.organizations.id,
      name: grant.organizations.name,
    },
  }
}

/**
 * Signs in and loads the profile.
 *
 * `remember` is applied before the call, because the client writes the token
 * during sign-in and the preference decides which store it lands in.
 */
export async function signIn(
  email: string,
  password: string,
  remember: boolean,
  messages: { wrongCredentials: string; noAccess: string },
): Promise<AuthResult> {
  setRememberMe(remember)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  // Supabase deliberately does not reveal whether an address is registered.
  // Neither should the console — the same message covers both cases.
  if (error || !data.user) return { ok: false, error: messages.wrongCredentials }

  const session = await loadProfile(data.user.id, data.user.email ?? email)
  if (!session) {
    await supabase.auth.signOut()
    return { ok: false, error: messages.noAccess }
  }

  return { ok: true, session }
}

/** Restores a stored session on start-up. Null when there is none. */
export async function restoreSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user?.id || !user.email) return null
  return loadProfile(user.id, user.email)
}

/**
 * Follows sign-in and sign-out for the rest of the session, including sign-outs
 * from another tab. A plain token refresh is ignored: the profile has not
 * changed, and re-reading it on a timer would be a query for nothing.
 */
export function onAuthChange(handler: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange(async (event, authSession) => {
    if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

    const user = authSession?.user
    if (!user?.id || !user.email) {
      handler(null)
      return
    }
    handler(await loadProfile(user.id, user.email))
  })

  return () => data.subscription.unsubscribe()
}

export async function signOut(): Promise<void> {
  setRememberMe(false)
  await supabase.auth.signOut()
}

export async function requestPasswordReset(email: string): Promise<void> {
  await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function setPassword(password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error?.message }
}

/**
 * Completes an invitation: the account already exists, so this signs in and
 * records the display name the person chose.
 */
export async function acceptInvite(
  email: string,
  fullName: string,
  password: string,
  messages: { inviteFailed: string; noAccess: string },
): Promise<AuthResult> {
  setRememberMe(true)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error || !data.user) return { ok: false, error: messages.inviteFailed }

  await supabase.auth.updateUser({ data: { full_name: fullName } })
  await supabase.from('users').update({ full_name: fullName }).eq('id', data.user.id)

  const session = await loadProfile(data.user.id, data.user.email ?? email)
  if (!session) return { ok: false, error: messages.noAccess }

  return { ok: true, session }
}

/** Renames the organisation. Only a fleet admin may do this — RLS enforces it. */
export async function updateOrganizationName(orgId: string, name: string): Promise<void> {
  const { error } = await supabase.from('organizations').update({ name }).eq('id', orgId)
  if (error) throw new Error(error.message)
}

/* ==========================================================================
   Dashboard
   ========================================================================== */

/**
 * Everything the dashboard shows, in one round trip.
 *
 * The six queries below are independent, so they go out together rather than
 * one after another — the dashboard is the first screen after sign-in and its
 * load time is the console's load time.
 *
 * Every count uses `head: true`, which asks Postgres for the count and no rows.
 * Counting 12 drivers by fetching 12 drivers works today and stops working at
 * 12,000.
 *
 * Only what the schema can actually answer is here. Duty status, hours
 * violations, unassigned driving, inspection defects, route progress and the
 * activity feed have no tables yet, so they are not invented — see
 * features/dashboard/useDashboard for what the page does about that.
 */

/** Documents expiring within this many days count as "needs attention". */
const EXPIRY_WARNING_DAYS = 30

/** Alerts worth showing at once. Beyond this the list stops being a list. */
const ALERT_LIMIT = 8

export type DashboardCounts = {
  driversActive: number
  driversTotal: number
  driversWithoutLogin: number
  vehiclesActive: number
  vehiclesTotal: number
  vehiclesOutOfService: number
  workOrdersOpen: number
  expiringDocuments: number
  serviceDue: number
  /**
   * The newest position report in the fleet, or null if nothing has ever
   * reported. The dashboard's "Live" badge is judged on this rather than being
   * always-on: a green dot over a feed that stopped six hours ago is worse
   * than no dot at all.
   */
  lastPositionAt: string | null
}

export type ExpiringDocument = {
  id: string
  docType: string
  expiresOn: string | null
  /** Whose paperwork it is: a driver, or a vehicle. */
  driverId: string | null
  vehicleId: string | null
  ownerName: string
}

export type DueService = {
  id: string
  name: string
  vehicleId: string | null
  vehicleName: string
  nextDueAt: string | null
  nextDueKm: number | null
  odometerKm: number | null
}

export type OpenWorkOrder = {
  id: string
  reference: string | null
  title: string
  openedAt: string
  vehicleName: string
}

export type DashboardSnapshot = {
  counts: DashboardCounts
  expiringDocuments: ExpiringDocument[]
  dueServices: DueService[]
  openWorkOrders: OpenWorkOrder[]
}

/** ISO date `days` from today, for comparing against a `date` column. */
function isoDateIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * A vehicle row as the dashboard joins it. PostgREST types an embedded
 * many-to-one as an object, but returns null when the foreign key is null.
 */
type EmbeddedVehicle = { name: string | null; plate: string } | null

function vehicleLabel(vehicle: EmbeddedVehicle): string {
  return vehicle?.name?.trim() || vehicle?.plate || ''
}

export async function loadDashboard(orgId: string): Promise<DashboardSnapshot> {
  const [
    drivers,
    driversActive,
    driversWithoutLogin,
    vehicles,
    vehiclesActive,
    vehiclesOutOfService,
    newestPosition,
    workOrders,
    documents,
    services,
  ] = await Promise.all([
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'active'),

    // A driver with no user_id has never signed in on the phone, so nothing
    // they do reaches the console. Worth surfacing during rollout.
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'active')
      .is('user_id', null),

    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'retired'),

    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'active'),

    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'out_of_service'),

    // Newest report in the fleet. One row, ordered — not a scan of every
    // vehicle to find a maximum.
    supabase
      .from('vehicles')
      .select('last_position_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('last_position_at', 'is', null)
      .order('last_position_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('work_orders')
      .select('id, reference, title, opened_at, vehicles(name, plate)', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('opened_at', { ascending: true })
      .limit(ALERT_LIMIT),

    // Every kind of compliance paperwork, not just the driver's. A truck's
    // insurance lapsing stops it at a checkpoint exactly like a licence does,
    // and the two used to live in separate tables where only one was checked.
    supabase
      .from('documents')
      // The relationship is named explicitly: documents reaches drivers twice
      // (whose document it is, and who uploaded it), so an unqualified
      // `drivers(...)` is ambiguous and PostgREST refuses it.
      // One long line on purpose: supabase-js reads this string as a literal
      // type to work out the row shape, so splitting or concatenating it loses
      // every type on the result.
      .select('id, doc_type, expires_on, driver_id, vehicle_id, drivers!documents_driver_id_fkey(first_name, last_name), vehicles!documents_vehicle_id_fkey(name, plate)', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('category', 'compliance')
      .is('deleted_at', null)
      .not('expires_on', 'is', null)
      .lte('expires_on', isoDateIn(EXPIRY_WARNING_DAYS))
      .order('expires_on', { ascending: true })
      .limit(ALERT_LIMIT),

    // Time-based services are filtered in the query. Distance-based ones cannot
    // be — comparing next_due_km against the vehicle's odometer is a join
    // PostgREST will not express — so those are filtered below, in code.
    supabase
      .from('maintenance_schedules')
      .select('id, name, vehicle_id, next_due_at, next_due_km, vehicles(name, plate, odometer_km)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('next_due_at', { ascending: true, nullsFirst: false })
      .limit(50),
  ])

  const firstError =
    drivers.error ??
    driversActive.error ??
    driversWithoutLogin.error ??
    vehicles.error ??
    vehiclesActive.error ??
    vehiclesOutOfService.error ??
    newestPosition.error ??
    workOrders.error ??
    documents.error ??
    services.error
  if (firstError) throw new Error(firstError.message)

  const now = Date.now()
  const dueServices: DueService[] = (services.data ?? [])
    .map((row) => {
      const vehicle = row.vehicles as EmbeddedVehicle & { odometer_km?: number | null }
      return {
        id: row.id,
        name: displayName(row.name),
        vehicleId: row.vehicle_id,
        vehicleName: vehicleLabel(vehicle),
        nextDueAt: row.next_due_at,
        nextDueKm: row.next_due_km,
        odometerKm: vehicle?.odometer_km ?? null,
      }
    })
    .filter((s) => {
      const dueByDate = s.nextDueAt !== null && new Date(s.nextDueAt).getTime() <= now
      const dueByDistance =
        s.nextDueKm !== null && s.odometerKm !== null && s.odometerKm >= s.nextDueKm
      return dueByDate || dueByDistance
    })
    .slice(0, ALERT_LIMIT)

  return {
    counts: {
      driversActive: driversActive.count ?? 0,
      driversTotal: drivers.count ?? 0,
      driversWithoutLogin: driversWithoutLogin.count ?? 0,
      vehiclesActive: vehiclesActive.count ?? 0,
      vehiclesTotal: vehicles.count ?? 0,
      vehiclesOutOfService: vehiclesOutOfService.count ?? 0,
      workOrdersOpen: workOrders.count ?? 0,
      expiringDocuments: documents.count ?? 0,
      serviceDue: dueServices.length,
      lastPositionAt: newestPosition.data?.last_position_at ?? null,
    },
    expiringDocuments: (documents.data ?? []).map((row) => {
      const driver = row.drivers as { first_name: string; last_name: string } | null
      return {
        id: row.id,
        docType: row.doc_type,
        expiresOn: row.expires_on,
        driverId: row.driver_id,
        vehicleId: row.vehicle_id,
        ownerName: driver
          ? personName(driver.first_name, driver.last_name)
          : vehicleLabel(row.vehicles as EmbeddedVehicle),
      }
    }),
    dueServices,
    openWorkOrders: (workOrders.data ?? []).map((row) => ({
      id: row.id,
      reference: row.reference,
      title: displayName(row.title),
      openedAt: row.opened_at,
      vehicleName: vehicleLabel(row.vehicles as EmbeddedVehicle),
    })),
  }
}

/* ==========================================================================
   Live map
   ========================================================================== */

/**
 * Where every vehicle is, plus who is driving it.
 *
 * The position lives on the vehicle row rather than in a positions table — see
 * the vehicle_last_position migration for why. That makes this one cheap read
 * instead of a distinct-on over millions of history rows.
 *
 * Retired vehicles are left out: they are not on the road, so they are not on
 * the map. Trailers are left out too — they have no engine, report no position,
 * and would sit at the equator with a speed of zero.
 */

export type MapVehicleRow = {
  id: string
  /** What the yard calls it, falling back to the plate. */
  name: string
  latitude: number | null
  longitude: number | null
  speedKph: number | null
  ignitionOn: boolean | null
  positionAt: string | null
  /** Null when nobody is signed on to this vehicle right now. */
  driverName: string | null
}

export async function loadMapVehicles(orgId: string): Promise<MapVehicleRow[]> {
  /*
   * Two reads rather than one embedded query.
   *
   * The assignment wanted is the *current* one — ended_at is null — and
   * PostgREST cannot filter an embedded table without also dropping the parent
   * rows that have no match. That would hide every unassigned vehicle from the
   * map, which is exactly the set a dispatcher is looking for.
   */
  const [vehicles, assignments] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, name, plate, last_latitude, last_longitude, last_speed_kph, last_ignition_on, last_position_at')
      .eq('org_id', orgId)
      .eq('kind', 'truck')
      .is('deleted_at', null)
      .neq('status', 'retired')
      .order('name', { ascending: true, nullsFirst: false }),

    supabase
      .from('driver_vehicle_assignments')
      .select('vehicle_id, drivers(first_name, last_name)')
      .eq('org_id', orgId)
      .is('ended_at', null),
  ])

  if (vehicles.error) throw new Error(vehicles.error.message)
  if (assignments.error) throw new Error(assignments.error.message)

  const driverByVehicle = new Map<string, string>()
  for (const row of assignments.data ?? []) {
    const driver = row.drivers as { first_name: string; last_name: string } | null
    if (!driver || !row.vehicle_id) continue
    driverByVehicle.set(row.vehicle_id, personName(driver.first_name, driver.last_name))
  }

  return (vehicles.data ?? []).map((v) => ({
    id: v.id,
    name: displayName(v.name) || v.plate,
    // numeric columns arrive as strings over the wire; Number keeps null null.
    latitude: v.last_latitude === null ? null : Number(v.last_latitude),
    longitude: v.last_longitude === null ? null : Number(v.last_longitude),
    speedKph: v.last_speed_kph === null ? null : Number(v.last_speed_kph),
    ignitionOn: v.last_ignition_on,
    positionAt: v.last_position_at,
    driverName: driverByVehicle.get(v.id) ?? null,
  }))
}

/* ==========================================================================
   Drivers
   ========================================================================== */

/**
 * The driver roster.
 *
 * Four reads, together: the drivers, the licence on file for each, the vehicle
 * each is signed on to, and the depot names. They are independent, so waiting
 * for them one after another would just be four round trips of latency.
 *
 * What is NOT here, because no table answers it yet:
 *
 *   duty status     needs duty_status_events
 *   hours left      needs duty_status_events
 *   safety score    needs safety_events, plus a scoring rule
 *
 * Those come back null rather than as a default. "Off duty, 11:00 left,
 * score 100" for a driver nothing is recording would be a fabrication, and the
 * roster is what a compliance officer reads.
 */

/** A licence expiring within this many days is flagged on the roster. */
const LICENCE_WARNING_DAYS = 60

export type DriverRow = {
  id: string
  firstName: string
  lastName: string
  employeeNumber: string | null
  /** The depot this driver is based at. */
  depotId: string | null
  depotName: string | null
  email: string | null
  phone: string | null
  employment: 'active' | 'inactive' | 'terminated'
  /** True once the driver has accepted their invitation and signed in. */
  onApp: boolean
  vehicleId: string | null
  vehicleName: string | null
  licenceExpiresOn: string | null
  /** Inside the warning window but still valid. */
  licenceWarning: boolean
  /** Already past its expiry date — this driver is not legal to drive. */
  licenceExpired: boolean
}

export type NewDriverInput = {
  firstName: string
  lastName: string
  employeeNumber: string
  /** A depot id, or empty for "no depot". Never a name — see loadDepots. */
  depotId: string
  email: string
  phone: string
  /** ISO date. Written as a licence document, not a column on the driver. */
  licenceExpires: string
  employment?: 'active' | 'inactive' | 'terminated'
  /** ISO date already on file. A new document is written only when this changes. */
  currentLicenceExpires?: string
  /** Empty means leave unassigned. */
  vehicleId?: string
}

/** Past its date. Equal to today still counts as valid. */
function expired(iso: string, today: Date): boolean {
  return new Date(iso) < today
}

export async function loadDrivers(orgId: string): Promise<DriverRow[]> {
  const [drivers, licences, assignments] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, first_name, last_name, employee_number, fleet_id, status, user_id, email, phone, fleets(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('first_name', { ascending: true }),

    // The licence with the furthest expiry wins: renewing adds a document
    // rather than editing the old one, so the newest is the one in force.
    supabase
      .from('documents')
      .select('driver_id, expires_on')
      .eq('org_id', orgId)
      .eq('category', 'compliance')
      .eq('doc_type', 'licence')
      .is('deleted_at', null)
      .not('driver_id', 'is', null)
      .order('expires_on', { ascending: false, nullsFirst: false }),

    supabase
      .from('driver_vehicle_assignments')
      .select('driver_id, vehicle_id, vehicles!driver_vehicle_assignments_vehicle_id_fkey(name, plate)')
      .eq('org_id', orgId)
      .is('ended_at', null),
  ])

  if (drivers.error) throw new Error(drivers.error.message)
  if (licences.error) throw new Error(licences.error.message)
  if (assignments.error) throw new Error(assignments.error.message)

  const licenceByDriver = new Map<string, string | null>()
  for (const row of licences.data ?? []) {
    if (!row.driver_id) continue
    // Ordered by expiry descending, so the first one seen is the latest.
    if (!licenceByDriver.has(row.driver_id)) licenceByDriver.set(row.driver_id, row.expires_on)
  }

  const vehicleByDriver = new Map<string, { id: string; name: string }>()
  for (const row of assignments.data ?? []) {
    const vehicle = row.vehicles as { name: string | null; plate: string } | null
    if (!vehicle || !row.driver_id || !row.vehicle_id) continue
    vehicleByDriver.set(row.driver_id, {
      id: row.vehicle_id,
      name: vehicle.name?.trim() || vehicle.plate,
    })
  }

  // Compared as whole days: a licence expiring today is still valid today.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const warnBefore = new Date(today)
  warnBefore.setDate(warnBefore.getDate() + LICENCE_WARNING_DAYS)

  return (drivers.data ?? []).map((d) => {
    const expiresOn = licenceByDriver.get(d.id) ?? null
    return {
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      employeeNumber: d.employee_number,
      depotId: d.fleet_id,
      depotName: displayName((d.fleets as { name: string } | null)?.name) || null,
      email: d.email,
      phone: d.phone,
      employment: d.status,
      onApp: d.user_id !== null,
      vehicleId: vehicleByDriver.get(d.id)?.id ?? null,
      vehicleName: vehicleByDriver.get(d.id)?.name ?? null,
      licenceExpiresOn: expiresOn,
      licenceWarning: expiresOn !== null && !expired(expiresOn, today) && new Date(expiresOn) <= warnBefore,
      licenceExpired: expiresOn !== null && expired(expiresOn, today),
    }
  })
}

/**
 * Creates the driver's app account and emails them a one-time password.
 *
 * Runs in an Edge Function because neither half can happen in a browser: the
 * account needs the secret key, and the email needs a provider key. Both stay
 * on the server.
 *
 * `emailed: false` is not a failure — the account was created and linked, and
 * only the email did not go. The password comes back in that case so the office
 * can pass it on rather than leaving the driver locked out of an account they
 * were never told about.
 */
export type DriverInviteResult = {
  emailed: boolean
  email: string
  /** Only present when the email could not be sent. */
  password?: string
  /** Why it could not be sent. */
  reason?: string
}

export async function inviteDriverToApp(driverId: string): Promise<DriverInviteResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    emailed?: boolean
    email?: string
    password?: string
    reason?: string
    error?: string
  }>('invite-driver', { body: { driverId } })

  // A non-2xx answer arrives as an error with the body attached, so the
  // function's own message is what the office reads.
  if (error) {
    let detail = error.message
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      if (body?.error) detail = body.error
    }
    throw new Error(detail)
  }
  if (!data?.ok) throw new Error(data?.error ?? 'The invitation could not be sent.')

  return {
    emailed: Boolean(data.emailed),
    email: data.email ?? '',
    password: data.password,
    reason: data.reason,
  }
}

/**
 * Adds a driver to the roster.
 *
 * No auth account is created. A driver row exists whether or not the person has
 * ever seen the app — the office sets up the whole fleet first, and the
 * invitation comes later. That is why drivers.user_id is nullable.
 *
 * The licence expiry becomes a document rather than a column, so a renewal adds
 * a row and the old certificate is still on file for an audit.
 */
export async function createDriver(orgId: string, input: NewDriverInput): Promise<string> {
  /*
   * A driver's working-hours day is cut in their depot's timezone, so the
   * depot's timezone is copied onto the driver rather than looked up on every
   * read. The column then also serves as the per-driver override the schema
   * always allowed for — a driver seconded to another region keeps their own.
   */
  let timezone: string | null = null
  if (input.depotId) {
    const depot = await supabase
      .from('fleets')
      .select('timezone')
      .eq('id', input.depotId)
      .single()
    if (depot.error) throw new Error(depot.error.message)
    timezone = depot.data.timezone
  }

  const { data, error } = await supabase
    .from('drivers')
    .insert({
      org_id: orgId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      employee_number: input.employeeNumber.trim() || null,
      fleet_id: input.depotId || null,
      email: input.email.trim().toLowerCase() || null,
      phone: input.phone.trim() || null,
      status: 'active',
      ...(timezone ? { timezone } : {}),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (input.licenceExpires.trim()) {
    const licence = await supabase.from('documents').insert({
      org_id: orgId,
      category: 'compliance',
      driver_id: data.id,
      doc_type: 'licence',
      expires_on: input.licenceExpires,
    })
    // The driver is already saved. Failing the whole call now would leave the
    // caller thinking nothing happened, so the licence is reported separately.
    if (licence.error) {
      throw new Error(`Driver saved, but the licence date was not: ${licence.error.message}`)
    }
  }

  return data.id
}

export async function updateDriver(orgId: string, driverId: string, input: NewDriverInput): Promise<void> {
  let timezone: string | null = null
  if (input.depotId) {
    const depot = await supabase
      .from('fleets')
      .select('timezone')
      .eq('id', input.depotId)
      .single()
    if (depot.error) throw new Error(depot.error.message)
    timezone = depot.data.timezone
  }

  const { error } = await supabase
    .from('drivers')
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      employee_number: input.employeeNumber.trim() || null,
      fleet_id: input.depotId || null,
      email: input.email.trim().toLowerCase() || null,
      phone: input.phone.trim() || null,
      status: input.employment ?? 'active',
      ...(timezone ? { timezone } : {}),
    })
    .eq('org_id', orgId)
    .eq('id', driverId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const nextExpiry = input.licenceExpires.trim()
  const current = (input.currentLicenceExpires ?? '').slice(0, 10)
  if (!nextExpiry || nextExpiry === current) return

  // A renewal is a new document. The old certificate stays on file for an
  // audit; the roster reads the furthest expiry, so this becomes the one in force.
  const licence = await supabase.from('documents').insert({
    org_id: orgId,
    category: 'compliance',
    driver_id: driverId,
    doc_type: 'licence',
    expires_on: nextExpiry,
  })
  if (licence.error) {
    throw new Error(`Driver saved, but the licence date was not: ${licence.error.message}`)
  }
}

/* ==========================================================================
   Vehicles and maintenance
   ========================================================================== */

/**
 * The fleet list, with who is driving each vehicle and when it is next due.
 *
 * "Next service" and "overdue by" are not columns on the vehicle. They come
 * from the active maintenance schedule compared against the odometer, so
 * changing a service interval does not need every vehicle row rewritten.
 *
 * Trailers are included here, unlike on the live map: they are part of the
 * fleet, they get work orders, and the office manages them on this screen.
 */

export type VehicleRow = {
  id: string
  kind: 'truck' | 'trailer'
  name: string
  plate: string
  vin: string | null
  makeModel: string
  year: number | null
  status: 'active' | 'in_maintenance' | 'out_of_service' | 'retired'
  odometerKm: number
  driverId: string | null
  driverName: string | null
  /** The depot this vehicle is kept at. */
  depotId: string | null
  depotName: string | null
  nextServiceKm: number | null
  serviceOverdueKm: number
}

export type WorkOrderRow = {
  id: string
  reference: string
  title: string
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  vehicleName: string
  mechanicName: string | null
  openedAt: string
  costRupees: number
  /**
   * The driver who raised it from the app, or null when the office opened it.
   *
   * Read from requested_by_driver rather than opened_by, which references
   * users and is therefore always null on a driver-raised order. The workshop
   * triages these differently — "the driver says the brakes feel soft" is not
   * a scheduled service — so the origin has to survive onto the screen.
   */
  requestedByDriverName: string | null
  /**
   * What the person who raised it actually wrote.
   *
   * The console never showed this. A driver typed "blows warm on both
   * settings, started this morning" into the app and the workshop saw a title
   * and nothing else — which is most of what a repair request IS.
   */
  description: string | null
  completedAt: string | null
  /** The faults this job was raised against, if any. */
  defects: Array<{ id: string; area: string; finding: string; severity: string }>
}

/** Distance between services, in kilometres, when the office does not pick one. */
export const SERVICE_INTERVAL_KM = 20_000

export type NewVehicleInput = {
  name: string
  plate: string
  vin: string
  makeModel: string
  year: string
  /** A depot id, or empty for "no depot". */
  depotId: string
  odometerKm: string
  /** Odometer reading at which the next service is due. */
  nextServiceKm: string
  status?: 'active' | 'in_maintenance' | 'out_of_service' | 'retired'
  /** Empty means leave unassigned. */
  driverId?: string
}

export async function loadVehicles(orgId: string): Promise<VehicleRow[]> {
  const [vehicles, assignments, schedules] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, kind, name, plate, vin, make, model, year, status, odometer_km, fleet_id, fleets(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true, nullsFirst: false }),

    supabase
      .from('driver_vehicle_assignments')
      .select('vehicle_id, driver_id, drivers(first_name, last_name)')
      .eq('org_id', orgId)
      .is('ended_at', null),

    supabase
      .from('maintenance_schedules')
      .select('vehicle_id, next_due_km')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .not('next_due_km', 'is', null)
      .order('next_due_km', { ascending: true }),
  ])

  if (vehicles.error) throw new Error(vehicles.error.message)
  if (assignments.error) throw new Error(assignments.error.message)
  if (schedules.error) throw new Error(schedules.error.message)

  const driverByVehicle = new Map<string, { id: string; name: string }>()
  for (const row of assignments.data ?? []) {
    const driver = row.drivers as { first_name: string; last_name: string } | null
    if (!driver || !row.vehicle_id || !row.driver_id) continue
    driverByVehicle.set(row.vehicle_id, {
      id: row.driver_id,
      name: personName(driver.first_name, driver.last_name),
    })
  }

  // Ordered by next_due_km ascending, so the first schedule seen for a vehicle
  // is the one coming up soonest — that is the one worth showing.
  const dueByVehicle = new Map<string, number>()
  for (const row of schedules.data ?? []) {
    if (!row.vehicle_id || row.next_due_km === null) continue
    if (!dueByVehicle.has(row.vehicle_id)) dueByVehicle.set(row.vehicle_id, Number(row.next_due_km))
  }

  return (vehicles.data ?? []).map((v) => {
    const odometerKm = Number(v.odometer_km ?? 0)
    const nextServiceKm = dueByVehicle.get(v.id) ?? null
    return {
      id: v.id,
      kind: v.kind,
      // Typed once when the truck was added, read on every list after.
      name: displayName(v.name) || v.plate,
      plate: v.plate,
      vin: v.vin,
      makeModel: [v.make, v.model].filter(Boolean).join(' ').trim() || '—',
      year: v.year,
      status: v.status,
      odometerKm,
      driverId: driverByVehicle.get(v.id)?.id ?? null,
      driverName: driverByVehicle.get(v.id)?.name ?? null,
      depotId: v.fleet_id,
      depotName: displayName((v.fleets as { name: string } | null)?.name) || null,
      nextServiceKm,
      serviceOverdueKm:
        nextServiceKm !== null && odometerKm > nextServiceKm
          ? Math.round(odometerKm - nextServiceKm)
          : 0,
    }
  })
}

/**
 * Repair jobs. Costs are stored in paise and shown in rupees, so the money
 * arithmetic happens in integers and never picks up a floating-point remainder.
 */
export async function loadWorkOrders(orgId: string): Promise<WorkOrderRow[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select(
      'id, reference, title, description, status, opened_at, completed_at, labour_cost_cents, parts_cost_cents, vehicles(name, plate), users!work_orders_assigned_to_fkey(full_name), drivers(first_name, last_name), defects(id, area, finding, severity)',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('opened_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((w) => {
    const vehicle = w.vehicles as { name: string | null; plate: string } | null
    const mechanic = w.users as { full_name: string | null } | null
    const requester = w.drivers as { first_name: string; last_name: string } | null
    const paise = Number(w.labour_cost_cents ?? 0) + Number(w.parts_cost_cents ?? 0)
    return {
      id: w.id,
      // A reference is optional in the schema; without one the id stands in so
      // the row is still addressable on screen.
      reference: w.reference ?? `WO-${w.id.slice(0, 6).toUpperCase()}`,
      title: displayName(w.title),
      status: w.status,
      vehicleName: vehicle?.name?.trim() || vehicle?.plate || '—',
      mechanicName: displayName(mechanic?.full_name) || null,
      openedAt: w.opened_at,
      costRupees: Math.round(paise / 100),
      requestedByDriverName: requester
        ? personName(requester.first_name, requester.last_name)
        : null,
      description: w.description,
      completedAt: w.completed_at,
      defects: ((w.defects ?? []) as Array<{
        id: string
        area: string
        finding: string
        severity: string
      }>).map((d) => ({
        id: d.id,
        area: d.area,
        finding: d.finding,
        severity: d.severity,
      })),
    }
  })
}

export async function createVehicle(orgId: string, input: NewVehicleInput): Promise<string> {
  // The form takes one "make and model" box, which is how the yard says it.
  // The schema keeps them apart, so the first word is the make.
  const makeModel = input.makeModel.trim()
  const firstSpace = makeModel.indexOf(' ')
  const vin = normalizeVin(input.vin)
  const odometerKm = Number(input.odometerKm) || 0

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      org_id: orgId,
      kind: 'truck',
      name: input.name.trim() || null,
      plate: input.plate.trim().toUpperCase(),
      vin,
      make: firstSpace === -1 ? makeModel || null : makeModel.slice(0, firstSpace),
      model: firstSpace === -1 ? null : makeModel.slice(firstSpace + 1),
      year: Number(input.year) || null,
      status: input.status ?? 'active',
      // Was collected by the dialog and silently dropped here, so a vehicle
      // could never belong to a depot however carefully it was chosen.
      fleet_id: input.depotId || null,
      odometer_km: odometerKm,
      odometer_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(vehicleWriteError(error.message))
  await upsertDistanceSchedule(orgId, data.id, odometerKm, input.nextServiceKm)
  return data.id
}

export async function updateVehicle(orgId: string, vehicleId: string, input: NewVehicleInput): Promise<void> {
  const makeModel = input.makeModel.trim()
  const firstSpace = makeModel.indexOf(' ')
  const vin = normalizeVin(input.vin)
  const odometerKm = Number(input.odometerKm) || 0

  const { error } = await supabase
    .from('vehicles')
    .update({
      name: input.name.trim() || null,
      plate: input.plate.trim().toUpperCase(),
      vin,
      make: firstSpace === -1 ? makeModel || null : makeModel.slice(0, firstSpace),
      model: firstSpace === -1 ? null : makeModel.slice(firstSpace + 1),
      year: Number(input.year) || null,
      fleet_id: input.depotId || null,
      odometer_km: odometerKm,
      odometer_at: new Date().toISOString(),
      status: input.status ?? 'active',
    })
    .eq('org_id', orgId)
    .eq('id', vehicleId)
    .is('deleted_at', null)

  if (error) throw new Error(vehicleWriteError(error.message))
  await upsertDistanceSchedule(orgId, vehicleId, odometerKm, input.nextServiceKm)
}

/**
 * One active distance schedule per vehicle. Next service on the list is this
 * row's `next_due_km` compared to the odometer — without it the column is a
 * dash, which is how a truck that was "added with a service" still showed none.
 */
async function upsertDistanceSchedule(
  orgId: string,
  vehicleId: string,
  odometerKm: number,
  nextServiceKm: string,
): Promise<void> {
  const nextDueKm = Number(nextServiceKm) || odometerKm + SERVICE_INTERVAL_KM
  const intervalKm = SERVICE_INTERVAL_KM

  const existing = await supabase
    .from('maintenance_schedules')
    .select('id')
    .eq('org_id', orgId)
    .eq('vehicle_id', vehicleId)
    .eq('trigger_type', 'distance')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error(existing.error.message)

  if (existing.data) {
    const { error } = await supabase
      .from('maintenance_schedules')
      .update({
        next_due_km: nextDueKm,
        interval_km: intervalKm,
        last_service_km: odometerKm,
      })
      .eq('id', existing.data.id)
      .eq('org_id', orgId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('maintenance_schedules').insert({
    org_id: orgId,
    vehicle_id: vehicleId,
    name: 'Periodic service',
    trigger_type: 'distance',
    interval_km: intervalKm,
    next_due_km: nextDueKm,
    last_service_km: odometerKm,
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

function normalizeVin(value: string): string | null {
  const vin = value.toUpperCase().replace(/[\s-]/g, '')
  return vin || null
}

function vehicleWriteError(message: string): string {
  if (/vehicles_vin_unique/i.test(message) || (/duplicate/i.test(message) && /vin/i.test(message))) {
    return 'A vehicle with that VIN already exists.'
  }
  return message
}

/* ------------------------------------------- driver to vehicle assignment */

/**
 * Puts a driver in a vehicle, or takes the current one out.
 *
 * An assignment is a row with no `ended_at`; history is kept by closing the old
 * row rather than overwriting it, because an inspector asking "who was driving
 * Truck 214 on the 3rd" needs an answer.
 *
 * Two exclusions are enforced, in this order:
 *   - a vehicle has one driver, so any open assignment on it is closed
 *   - a driver has one vehicle, so any open assignment of theirs is closed too
 *
 * The second is the one that is easy to forget. Without it a driver moved to a
 * different truck stays listed against both, and the fleet list shows them
 * twice.
 *
 * Drivers do this for themselves from the app at the start of a shift — that is
 * the normal path, and `dva_self_write` allows it. This is the office doing it
 * for them: pre-assigning tomorrow, or fixing a wrong pick.
 */
export async function assignDriverToVehicle(
  orgId: string,
  vehicleId: string,
  driverId: string | null,
): Promise<void> {
  const now = new Date().toISOString()

  if (driverId) {
    const already = await supabase
      .from('driver_vehicle_assignments')
      .select('id')
      .eq('org_id', orgId)
      .eq('vehicle_id', vehicleId)
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .maybeSingle()
    if (already.error) throw new Error(already.error.message)
    if (already.data) return
  }

  const closeVehicle = await supabase
    .from('driver_vehicle_assignments')
    .update({ ended_at: now })
    .eq('org_id', orgId)
    .eq('vehicle_id', vehicleId)
    .is('ended_at', null)
  if (closeVehicle.error) throw new Error(closeVehicle.error.message)

  // Unassigning is just the close above.
  if (!driverId) return

  const closeDriver = await supabase
    .from('driver_vehicle_assignments')
    .update({ ended_at: now })
    .eq('org_id', orgId)
    .eq('driver_id', driverId)
    .is('ended_at', null)
  if (closeDriver.error) throw new Error(closeDriver.error.message)

  const { error } = await supabase.from('driver_vehicle_assignments').insert({
    org_id: orgId,
    vehicle_id: vehicleId,
    driver_id: driverId,
    started_at: now,
  })
  if (error) throw new Error(error.message)
}

/**
 * Puts live routes that already name a driver and a vehicle onto the fleet
 * lists. Lists read `driver_vehicle_assignments`, not `routes`, so a route
 * planned before that pairing was written looks unassigned until this runs.
 *
 * Does not move anyone who already has an open assignment. The most recently
 * planned live route for a driver wins when two routes name them.
 *
 * Returns how many pairs were written, so the roster can be re-read only when
 * something actually changed.
 */
export async function pairLiveRoutesOntoFleet(orgId: string): Promise<number> {
  const [routes, assignments] = await Promise.all([
    supabase
      .from('routes')
      .select('driver_id, vehicle_id, planned_start_at, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['planned', 'dispatched', 'in_progress'])
      .not('driver_id', 'is', null)
      .not('vehicle_id', 'is', null),
    supabase
      .from('driver_vehicle_assignments')
      .select('driver_id, vehicle_id')
      .eq('org_id', orgId)
      .is('ended_at', null),
  ])
  if (routes.error) throw new Error(routes.error.message)
  if (assignments.error) throw new Error(assignments.error.message)

  const takenDriver = new Set((assignments.data ?? []).map((row) => row.driver_id))
  const takenVehicle = new Set((assignments.data ?? []).map((row) => row.vehicle_id))

  const ranked = [...(routes.data ?? [])].sort((a, b) => {
    const aStart = a.planned_start_at ?? a.created_at
    const bStart = b.planned_start_at ?? b.created_at
    return bStart.localeCompare(aStart)
  })

  let written = 0
  for (const row of ranked) {
    if (!row.driver_id || !row.vehicle_id) continue
    if (takenDriver.has(row.driver_id) || takenVehicle.has(row.vehicle_id)) continue
    await assignDriverToVehicle(orgId, row.vehicle_id, row.driver_id)
    takenDriver.add(row.driver_id)
    takenVehicle.add(row.vehicle_id)
    written += 1
  }
  return written
}

/* --------------------------------------------------------- work orders */

export type NewWorkOrderInput = {
  vehicleId: string
  title: string
  description: string
  /** The defect this repair answers, when it came from an inspection. */
  defectId?: string
}

/**
 * Opens a repair job.
 *
 * Drivers cannot reach this: `work_orders_write` is limited to fleet_admin and
 * mechanic, and `opened_by` points at users, not drivers. A driver reports a
 * defect; the office decides it needs a repair. See the defects table.
 *
 * When it comes from a defect the two rows are linked both ways — the work
 * order carries the vehicle, and the defect carries the work order id — so the
 * inspection screen can show that something is being done about it.
 */
export async function createWorkOrder(
  orgId: string,
  input: NewWorkOrderInput,
): Promise<string> {
  const me = await supabase.auth.getUser()

  // "WO-0902-K3M": the date it was opened and a short tail, so two jobs opened
  // in the same minute cannot collide. Same shape as a route reference.
  const today = new Date()
  const reference = `WO-${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate(),
  ).padStart(2, '0')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      org_id: orgId,
      vehicle_id: input.vehicleId,
      reference,
      title: input.title.trim(),
      description: input.description.trim() || null,
      status: 'open',
      opened_by: me.data.user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (input.defectId) {
    const link = await supabase
      .from('defects')
      .update({ work_order_id: data.id })
      .eq('id', input.defectId)
    // The work order exists either way. Saying nothing here would leave the
    // defect looking untouched next to a repair that is already open.
    if (link.error) {
      throw new Error(
        `Work order ${reference} was opened, but the defect was not linked to it: ${link.error.message}`,
      )
    }
  }

  return data.id
}

export async function setWorkOrderStatus(
  id: string,
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled',
): Promise<void> {
  // A completed job must say when, and an open one must not — the table has a
  // check constraint for it, so both directions are set here.
  const { error } = await supabase
    .from('work_orders')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Marks a defect dealt with.
 *
 * `resolved` means it was fixed; `dismissed` means it was looked at and needed
 * nothing. Both are decisions, and the table requires a timestamp for either —
 * a defect cannot be quietly closed with no record of when.
 */
export async function resolveDefect(
  id: string,
  outcome: 'resolved' | 'dismissed',
  correctiveAction: string,
): Promise<void> {
  const me = await supabase.auth.getUser()

  const { error } = await supabase
    .from('defects')
    .update({
      status: outcome,
      corrective_action: correctiveAction.trim() || null,
      resolved_by: me.data.user?.id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/* ==========================================================================
   Office staff and access
   ========================================================================== */

/**
 * Everyone with access to this organisation's console.
 *
 * Two sources, one list: accounts that hold a role grant, and invitations that
 * have been sent but not accepted. An access screen that only showed accepted
 * accounts would hide the invitation somebody is waiting on.
 *
 * A revoked grant is kept rather than deleted, so "who used to have access"
 * survives — that is the question an audit asks.
 */

export type StaffRow = {
  /** The user id for an account, the invitation id for a pending invite. */
  id: string
  name: string | null
  email: string
  roleName: string
  /** Null means every depot. */
  fleetName: string | null
  status: 'active' | 'invited' | 'suspended'
  lastSeenAt: string | null
}

export type NewInviteInput = {
  name: string
  email: string
  /** Role name as shown in the console, not the key. */
  role: string
  /** A depot id, or empty for "every depot". */
  depotId: string
}

/**
 * The roles the console can grant, with how many people hold each.
 *
 * Read from the database rather than hardcoded, because the count is a fact
 * about this organisation and the descriptions are seeded alongside the roles.
 * System roles have org_id null and are shared by every tenant.
 */
export type RoleRow = {
  key: string
  name: string
  description: string
  people: number
}

/* ---------------------------------------------------------------- depots */

/**
 * A depot, with what is based there.
 *
 * The counts are read here rather than derived on the client because a depot
 * cannot be archived while drivers or vehicles are still assigned to it, and
 * the screen has to be able to say why.
 */
export type DepotRow = {
  id: string
  name: string
  code: string | null
  timezone: string
  /** Street address of the yard. Empty when nobody recorded one yet. */
  address: string
  latitude: number | null
  longitude: number | null
  drivers: number
  vehicles: number
}

export type NewDepotInput = {
  name: string
  code: string
  timezone: string
  address: string
  latitude: number | null
  longitude: number | null
}

export async function loadDepots(orgId: string): Promise<DepotRow[]> {
  const withLocation = await supabase
    .from('fleets')
    .select('id, name, code, timezone, address, latitude, longitude')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const depots =
    withLocation.error && /address|latitude|longitude/i.test(withLocation.error.message)
      ? await supabase
          .from('fleets')
          .select('id, name, code, timezone')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .order('name', { ascending: true })
      : withLocation

  const [drivers, vehicles] = await Promise.all([
    supabase
      .from('drivers')
      .select('fleet_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('fleet_id', 'is', null),

    supabase
      .from('vehicles')
      .select('fleet_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('fleet_id', 'is', null),
  ])

  if (depots.error) throw new Error(depots.error.message)
  if (drivers.error) throw new Error(drivers.error.message)
  if (vehicles.error) throw new Error(vehicles.error.message)

  const tally = (rows: Array<{ fleet_id: string | null }>) => {
    const out = new Map<string, number>()
    for (const row of rows) {
      if (!row.fleet_id) continue
      out.set(row.fleet_id, (out.get(row.fleet_id) ?? 0) + 1)
    }
    return out
  }
  const driverCount = tally(drivers.data ?? [])
  const vehicleCount = tally(vehicles.data ?? [])

  return (depots.data ?? []).map((d) => {
    const row = d as {
      id: string
      name: string
      code: string | null
      timezone: string
      address?: string | null
      latitude?: number | null
      longitude?: number | null
    }
    return {
      id: row.id,
      // Typed when the depot was created, so it arrives however somebody felt
      // that day — the same treatment a person's name gets.
      name: displayName(row.name),
      code: row.code,
      timezone: row.timezone,
      address: row.address?.trim() ?? '',
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      drivers: driverCount.get(row.id) ?? 0,
      vehicles: vehicleCount.get(row.id) ?? 0,
    }
  })
}

export async function createDepot(orgId: string, input: NewDepotInput): Promise<string> {
  const { data, error } = await supabase
    .from('fleets')
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase() || null,
      timezone: input.timezone,
      address: input.address.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select('id')
    .single()

  if (error) {
    if (/address|latitude|longitude/i.test(error.message)) {
      throw new Error('This database is missing depot addresses. Run npm run db:push.')
    }
    throw new Error(error.message)
  }
  return data.id
}

/**
 * Renaming is safe now, and was not before: drivers used to be linked to their
 * depot by name, so a rename orphaned every driver in it. They hold fleet_id.
 */
export async function updateDepot(id: string, input: NewDepotInput): Promise<void> {
  const { error } = await supabase
    .from('fleets')
    .update({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase() || null,
      timezone: input.timezone,
      address: input.address.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .eq('id', id)

  if (error) {
    if (/address|latitude|longitude/i.test(error.message)) {
      throw new Error('This database is missing depot addresses. Run npm run db:push.')
    }
    throw new Error(error.message)
  }
}

/**
 * Archives a depot. Soft, like everything else here — a depot that closed
 * still has to explain last year's duty logs to an inspector.
 *
 * Refused while anything is still based there. The alternative is drivers and
 * vehicles pointing at a depot the office can no longer see, which is how the
 * name-matching bug looked from the outside.
 */
export async function archiveDepot(id: string): Promise<void> {
  const [drivers, vehicles] = await Promise.all([
    supabase.from('drivers').select('id').eq('fleet_id', id).is('deleted_at', null).limit(1),
    supabase.from('vehicles').select('id').eq('fleet_id', id).is('deleted_at', null).limit(1),
  ])
  if (drivers.error) throw new Error(drivers.error.message)
  if (vehicles.error) throw new Error(vehicles.error.message)

  if ((drivers.data ?? []).length > 0 || (vehicles.data ?? []).length > 0) {
    throw new Error('Move the drivers and vehicles based here to another depot first.')
  }

  const { error } = await supabase
    .from('fleets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function loadRoles(orgId: string): Promise<RoleRow[]> {
  const [roles, grants] = await Promise.all([
    supabase
      .from('roles')
      .select('id, key, name, description')
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      // super_admin is platform staff, not something a fleet admin grants.
      .neq('key', 'super_admin')
      .order('name', { ascending: true }),

    supabase
      .from('user_roles')
      .select('role_id')
      .eq('org_id', orgId)
      .is('revoked_at', null),
  ])

  if (roles.error) throw new Error(roles.error.message)
  if (grants.error) throw new Error(grants.error.message)

  const heldBy = new Map<string, number>()
  for (const row of grants.data ?? []) {
    if (!row.role_id) continue
    heldBy.set(row.role_id, (heldBy.get(row.role_id) ?? 0) + 1)
  }

  return (roles.data ?? []).map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description ?? '',
    people: heldBy.get(r.id) ?? 0,
  }))
}

export async function loadStaff(orgId: string): Promise<StaffRow[]> {
  const [grants, invitations] = await Promise.all([
    supabase
      .from('user_roles')
      .select('user_id, revoked_at, granted_at, users!user_roles_user_id_fkey(email, full_name, last_seen_at), roles(name), fleets(name)')
      .eq('org_id', orgId)
      .order('granted_at', { ascending: false }),

    supabase
      .from('invitations')
      .select('id, email, expires_at, roles(name), fleets(name)')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (grants.error) throw new Error(grants.error.message)
  if (invitations.error) throw new Error(invitations.error.message)

  const staff: StaffRow[] = []

  // Ordered newest grant first, so the first row seen for a user is their
  // current one. Someone re-granted after a revoke should read as active.
  const seen = new Set<string>()
  for (const row of grants.data ?? []) {
    const user = row.users as { email: string; full_name: string | null; last_seen_at: string | null } | null
    if (!user || !row.user_id || seen.has(row.user_id)) continue
    seen.add(row.user_id)

    staff.push({
      id: row.user_id,
      name: displayName(user.full_name) || null,
      email: user.email,
      roleName: (row.roles as { name: string } | null)?.name ?? '',
      fleetName: displayName((row.fleets as { name: string } | null)?.name) || null,
      status: row.revoked_at === null ? 'active' : 'suspended',
      lastSeenAt: user.last_seen_at,
    })
  }

  for (const row of invitations.data ?? []) {
    staff.push({
      id: row.id,
      // An invitation has no name yet; the person chooses it when they accept.
      name: null,
      email: row.email,
      roleName: (row.roles as { name: string } | null)?.name ?? '',
      fleetName: displayName((row.fleets as { name: string } | null)?.name) || null,
      status: 'invited',
      lastSeenAt: null,
    })
  }

  return staff
}

/**
 * Records an invitation.
 *
 * The token is generated here and only its SHA-256 hash is stored, so a leaked
 * database row cannot be used to accept somebody else's invitation. The raw
 * token is returned to the caller once and never again.
 *
 * Nothing is emailed yet — that needs an SMTP provider and an Edge Function.
 * Until then the row is the record that an invitation exists, and the console
 * shows the person as "Invited".
 */
export async function inviteStaff(orgId: string, input: NewInviteInput): Promise<string> {
  const role = await supabase
    .from('roles')
    .select('id')
    .eq('name', input.role)
    .is('org_id', null)
    .maybeSingle()

  if (role.error) throw new Error(role.error.message)
  if (!role.data) throw new Error(`No role named "${input.role}".`)

  const token = crypto.randomUUID() + crypto.randomUUID()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const { error } = await supabase.from('invitations').insert({
    org_id: orgId,
    // Empty means every depot, which is a null fleet_id rather than a depot
    // of its own.
    fleet_id: input.depotId || null,
    role_id: role.data.id,
    email: input.email.trim().toLowerCase(),
    token_hash: tokenHash,
  })

  if (error) throw new Error(error.message)
  return token
}

/* ==========================================================================
   Operations — everything the remaining modules read
   ========================================================================== */

/**
 * The rest of the console, in one place.
 *
 * These loaders all follow the same shape as the ones above: read the rows,
 * turn them into what the screen already expects, and answer null where no
 * table can answer yet.
 *
 * Several of them will come back empty for a while, and that is the honest
 * result rather than a bug. Duty status, inspections and safety events are
 * written by the phone, and the phone does not exist yet. The office fills
 * routes, messages, documents, courses and alert rules from this console, so
 * those show data as soon as somebody adds some.
 */

/* ----------------------------------------------------------- working hours */

export type DutyEventRow = {
  id: string
  driverId: string
  /**
   * Who it belongs to, carried on the row.
   *
   * The console used to get driver names for the hours screen only from
   * hos_daily_logs, which meant a driver who had never certified a day had no
   * name anywhere — and their correction requests rendered as a blank line.
   */
  driverName: string
  status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving' | 'personal_conveyance' | 'yard_move'
  startedAt: string
  vehicleName: string | null
  /** Set when this row proposes a change to an earlier one. */
  editOfId: string | null
  editStatus: 'pending' | 'accepted' | 'rejected' | null
  editReason: string | null
  proposedByName: string | null
}

export type DailyLogRow = {
  driverId: string
  driverName: string
  logDate: string
  certifiedAt: string | null
}

export async function loadHours(
  orgId: string,
  fromIso: string,
  toIso: string,
): Promise<{ events: DutyEventRow[]; logs: DailyLogRow[] }> {
  const [events, logs] = await Promise.all([
    supabase
      .from('duty_status_events')
      .select(
        'id, driver_id, status, started_at, edit_of_id, edit_status, edit_reason, drivers(first_name, last_name), vehicles(name, plate), users!duty_status_events_proposed_by_fkey(full_name)',
      )
      .eq('org_id', orgId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso)
      .order('started_at', { ascending: true }),

    supabase
      .from('hos_daily_logs')
      .select('driver_id, log_date, certified_at, drivers(first_name, last_name)')
      .eq('org_id', orgId)
      .gte('log_date', fromIso.slice(0, 10))
      .lte('log_date', toIso.slice(0, 10))
      .order('log_date', { ascending: true }),
  ])

  if (events.error) throw new Error(events.error.message)
  if (logs.error) throw new Error(logs.error.message)

  return {
    events: (events.data ?? []).map((e) => {
      const vehicle = e.vehicles as { name: string | null; plate: string } | null
      const proposer = e.users as { full_name: string | null } | null
      const driver = e.drivers as { first_name: string; last_name: string } | null
      return {
        id: e.id,
        driverId: e.driver_id,
        driverName: driver ? personName(driver.first_name, driver.last_name) : '',
        status: e.status,
        startedAt: e.started_at,
        vehicleName: vehicle?.name?.trim() || vehicle?.plate || null,
        editOfId: e.edit_of_id,
        editStatus: e.edit_status,
        editReason: e.edit_reason,
        proposedByName: displayName(proposer?.full_name) || null,
      }
    }),
    logs: (logs.data ?? []).map((l) => {
      const driver = l.drivers as { first_name: string; last_name: string } | null
      return {
        driverId: l.driver_id,
        driverName: driver ? personName(driver.first_name, driver.last_name) : '',
        logDate: l.log_date,
        certifiedAt: l.certified_at,
      }
    }),
  }
}

/**
 * Records the office's decision on a correction the driver asked for.
 *
 * Approving does not rewrite the driver's log. The correction is already a row
 * of its own; accepting it marks that row accepted and leaves the original
 * untouched, so the timeline still shows what was first recorded and what was
 * changed. The append-only trigger enforces that regardless of what is sent.
 *
 * A correction the OFFICE proposed cannot be decided here — row-level security
 * refuses it, because a carrier accepting its own edit is the abuse the rules
 * exist to prevent.
 */
export async function resolveDutyEdit(
  id: string,
  decision: 'approve' | 'reject',
): Promise<void> {
  const { error } = await supabase
    .from('duty_status_events')
    .update({
      edit_status: decision === 'approve' ? 'accepted' : 'rejected',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/* --------------------------------------------- inspections and defects */

export type SubmissionRow = {
  id: string
  formName: string
  formKind: 'dvir_pre' | 'dvir_post' | 'custom'
  driverName: string | null
  vehicleName: string | null
  submittedAt: string
  status: 'submitted' | 'reviewed' | 'flagged'
}

export type DefectRow = {
  id: string
  submissionId: string | null
  vehicleName: string
  area: string
  finding: string
  severity: 'minor' | 'major' | 'out_of_service'
  status: 'open' | 'in_repair' | 'resolved' | 'dismissed'
  /** The repair job raised for it, when one was. */
  workOrderId: string | null
  correctiveAction: string | null
  /**
   * Who reported it, and when.
   *
   * The console showed neither. For a fault a driver raised on its own —
   * "brakes feel soft", typed from a lay-by — who said it and when is most of
   * what the office needs: the fault itself is one line, and the person who
   * felt it is the one to ask about it.
   */
  reportedByName: string | null
  reportedAt: string
}

export async function loadInspections(
  orgId: string,
): Promise<{ submissions: SubmissionRow[]; defects: DefectRow[] }> {
  const [submissions, defects] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('id, submitted_at, status, forms(name, kind), drivers(first_name, last_name), vehicles!form_submissions_vehicle_id_fkey(name, plate)')
      .eq('org_id', orgId)
      .order('submitted_at', { ascending: false }),

    supabase
      .from('defects')
      .select(
        'id, submission_id, area, finding, severity, status, work_order_id, corrective_action, created_at, vehicles(name, plate), drivers(first_name, last_name)',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (submissions.error) throw new Error(submissions.error.message)
  if (defects.error) throw new Error(defects.error.message)

  return {
    submissions: (submissions.data ?? []).map((row) => {
      const form = row.forms as { name: string; kind: 'dvir_pre' | 'dvir_post' | 'custom' } | null
      const driver = row.drivers as { first_name: string; last_name: string } | null
      const vehicle = row.vehicles as { name: string | null; plate: string } | null
      return {
        id: row.id,
        formName: form?.name ?? '',
        formKind: form?.kind ?? 'custom',
        driverName: driver ? personName(driver.first_name, driver.last_name) : null,
        vehicleName: vehicle?.name?.trim() || vehicle?.plate || null,
        submittedAt: row.submitted_at,
        status: row.status,
      }
    }),
    defects: (defects.data ?? []).map((row) => {
      const vehicle = row.vehicles as { name: string | null; plate: string } | null
      const reporter = row.drivers as { first_name: string; last_name: string } | null
      return {
        id: row.id,
        submissionId: row.submission_id,
        vehicleName: vehicle?.name?.trim() || vehicle?.plate || '—',
        area: row.area,
        finding: row.finding,
        severity: row.severity,
        status: row.status,
        workOrderId: row.work_order_id,
        correctiveAction: row.corrective_action,
        reportedByName: reporter
          ? personName(reporter.first_name, reporter.last_name)
          : null,
        reportedAt: row.created_at,
      }
    }),
  }
}

/* ----------------------------------------------------------------- forms */

/**
 * Form definitions and how many times each has been filled in.
 *
 * A published form is never edited in place — editing makes the next version,
 * and submissions point at the exact version they were answered on. So the
 * list shows the newest version of each key, and the submission count is the
 * total across every version of it.
 */

export type FormRow = {
  id: string
  key: string
  name: string
  version: number
  status: 'draft' | 'published' | 'archived'
  fieldCount: number
  fleetName: string | null
  submissions: number
  updatedAt: string
  fields: Array<{ id: string; label: string; type: string; required: boolean }>
}

export async function loadForms(orgId: string): Promise<FormRow[]> {
  const [forms, submissions] = await Promise.all([
    supabase
      .from('forms')
      .select('id, key, name, version, status, fields, updated_at, fleets(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('version', { ascending: false }),

    supabase.from('form_submissions').select('form_id').eq('org_id', orgId),
  ])

  if (forms.error) throw new Error(forms.error.message)
  if (submissions.error) throw new Error(submissions.error.message)

  const byForm = new Map<string, number>()
  for (const row of submissions.data ?? []) {
    if (!row.form_id) continue
    byForm.set(row.form_id, (byForm.get(row.form_id) ?? 0) + 1)
  }

  // Ordered by version descending, so the first row seen for a key is its
  // newest version — the one the office is working on.
  const newest = new Map<string, (typeof forms.data)[number]>()
  const submissionsByKey = new Map<string, number>()
  for (const row of forms.data ?? []) {
    submissionsByKey.set(row.key, (submissionsByKey.get(row.key) ?? 0) + (byForm.get(row.id) ?? 0))
    if (!newest.has(row.key)) newest.set(row.key, row)
  }

  return [...newest.values()].map((row) => {
    const fields = Array.isArray(row.fields)
      ? (row.fields as Array<{ id?: string; label?: string; type?: string; required?: boolean }>)
      : []
    return {
      id: row.id,
      key: row.key,
      name: displayName(row.name),
      version: row.version,
      status: row.status,
      fieldCount: fields.length,
      fleetName: displayName((row.fleets as { name: string } | null)?.name) || null,
      submissions: submissionsByKey.get(row.key) ?? 0,
      updatedAt: row.updated_at,
      fields: fields.map((f, i) => ({
        id: String(f.id ?? `f${i}`),
        label: String(f.label ?? ''),
        type: String(f.type ?? 'Text'),
        required: Boolean(f.required),
      })),
    }
  })
}

export async function createForm(
  orgId: string,
  input: { name: string; depotId: string },
  fields: Array<{ label: string; type: string; required: boolean }>,
): Promise<string> {
  // The key is what ties versions of the same form together, so it comes from
  // the name once and never changes when the name is edited later.
  const key = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'form'

  const { data, error } = await supabase
    .from('forms')
    .insert({
      org_id: orgId,
      key,
      version: 1,
      name: input.name.trim(),
      kind: 'custom',
      status: 'draft',
      // Empty means every driver in the organisation.
      assigned_fleet_id: input.depotId || null,
      fields: fields.map((f, i) => ({
        id: `f${i + 1}`,
        label: f.label,
        type: f.type,
        required: f.required,
      })),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

/* ------------------------------------------------------------- dispatch */

export type RouteRow = {
  id: string
  reference: string
  driverId: string | null
  vehicleId: string | null
  driverName: string | null
  vehicleName: string | null
  status: 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'
  plannedStartAt: string | null
  plannedEndAt: string | null
  completedAt: string | null
  plannedDistanceKm: number | null
  pathPolyline: string | null
  origin: string
  destination: string
  stopsTotal: number
  stopsDone: number
}

export type RouteStopRow = {
  id: string
  routeId: string
  sequence: number
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  distanceFromStartKm: number | null
  windowStartAt: string | null
  windowEndAt: string | null
  arrivedAt: string | null
  /**
   * Metres between the driver and the stop when they marked it arrived.
   *
   * Null means unverified — the app could not get a fix, or the office never
   * gave the stop coordinates to measure against. Worth surfacing: a route
   * whose stops were all marked from one place is a route nobody drove.
   */
  arrivedDistanceM: number | null
  status: 'pending' | 'arrived' | 'completed' | 'skipped' | 'failed'
}

/**
 * Publishes a form, or takes it back to draft.
 *
 * Until this existed a form could be created and never reach anybody: the
 * builder writes `draft`, and the driver app only reads `published`. The chain
 * had no last link.
 *
 * `published_at` is set and cleared alongside the status because the table
 * requires it — forms_published_has_timestamp. A published form with no
 * timestamp is refused, and so is a draft that still carries one.
 */
export async function setFormPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from('forms')
    .update({
      status: published ? 'published' : 'draft',
      published_at: published ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Publishes a course, or takes it back to draft.
 *
 * Same missing link as forms. Courses carry no published_at column, so status
 * is the whole of it.
 */
export async function setCoursePublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ status: published ? 'published' : 'draft' })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function loadRoutes(
  orgId: string,
): Promise<{ routes: RouteRow[]; stops: RouteStopRow[] }> {
  const withPath = await supabase
    .from('routes')
    .select('id, reference, status, planned_start_at, planned_end_at, completed_at, planned_distance_km, path_polyline, driver_id, vehicle_id, drivers(first_name, last_name), vehicles!routes_vehicle_id_fkey(name, plate)')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('planned_start_at', { ascending: false, nullsFirst: false })

  const routes = withPath.error
    ? await supabase
        .from('routes')
        .select('id, reference, status, planned_start_at, planned_end_at, completed_at, planned_distance_km, driver_id, vehicle_id, drivers(first_name, last_name), vehicles!routes_vehicle_id_fkey(name, plate)')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('planned_start_at', { ascending: false, nullsFirst: false })
    : withPath

  const withKm = await supabase
    .from('route_stops')
    .select(
      'id, route_id, sequence, name, address, latitude, longitude, distance_from_start_km, window_start_at, window_end_at, arrived_at, arrived_distance_m, status',
    )
    .eq('org_id', orgId)
    .order('sequence', { ascending: true })

  const stops = withKm.error
    ? await supabase
        .from('route_stops')
        .select('id, route_id, sequence, name, address, latitude, longitude, window_start_at, window_end_at, arrived_at, status')
        .eq('org_id', orgId)
        .order('sequence', { ascending: true })
    : withKm

  if (routes.error) throw new Error(routes.error.message)
  if (stops.error) throw new Error(stops.error.message)

  const all = (stops.data ?? []) as Array<{
    id: string
    route_id: string
    sequence: number
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    distance_from_start_km?: number | null
    window_start_at: string | null
    window_end_at: string | null
    arrived_at: string | null
    // Optional: the fallback select above omits it, the same way it omits
    // distance_from_start_km when the column is not there yet.
    arrived_distance_m?: number | null
    status: RouteStopRow['status']
  }>

  return {
    routes: ((routes.data ?? []) as Array<{
      id: string
      reference: string
      status: RouteRow['status']
      planned_start_at: string | null
      planned_end_at: string | null
      completed_at: string | null
      planned_distance_km: number | null
      path_polyline?: string | null
      driver_id: string | null
      vehicle_id: string | null
      drivers: { first_name: string; last_name: string } | null
      vehicles: { name: string | null; plate: string } | null
    }>).map((r) => {
      const driver = r.drivers
      const vehicle = r.vehicles
      const mine = all.filter((s) => s.route_id === r.id)
      const first = mine[0]
      const last = mine[mine.length - 1]
      return {
        id: r.id,
        reference: r.reference,
        driverId: r.driver_id,
        vehicleId: r.vehicle_id,
        driverName: driver ? personName(driver.first_name, driver.last_name) : null,
        vehicleName: vehicle?.name?.trim() || vehicle?.plate || null,
        status: r.status,
        plannedStartAt: r.planned_start_at,
        plannedEndAt: r.planned_end_at,
        completedAt: r.completed_at,
        plannedDistanceKm: r.planned_distance_km,
        pathPolyline: r.path_polyline ?? null,
        origin: first?.address || first?.name || '',
        destination: last?.address || last?.name || '',
        stopsTotal: mine.length,
        stopsDone: mine.filter((s) => s.status === 'completed').length,
      }
    }),
    stops: all.map((s) => ({
      id: s.id,
      routeId: s.route_id,
      sequence: s.sequence,
      name: s.name,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      distanceFromStartKm: s.distance_from_start_km ?? null,
      windowStartAt: s.window_start_at,
      windowEndAt: s.window_end_at,
      arrivedAt: s.arrived_at,
      arrivedDistanceM: s.arrived_distance_m ?? null,
      status: s.status,
    })),
  }
}

export type NewRouteInput = {
  driverId: string
  vehicleId: string
  origin: string
  destination: string
  stops: string
  startTime: string
  notes: string
  plannedDistanceKm: number | null
  pathPolyline: string | null
  plannedStops: Array<{
    name: string
    address: string
    latitude: number | null
    longitude: number | null
    distanceFromStartKm: number | null
  }>
}

export async function createRoute(orgId: string, input: NewRouteInput): Promise<string> {
  const driverId = input.driverId.trim() || null
  const vehicleId = input.vehicleId.trim() || null

  // The reference is what the yard calls the route. Generated from the date and
  // a short random tail, so two routes planned in the same minute cannot clash.
  const today = new Date()
  const reference = `NL-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`

  const plannedStart = input.startTime
    ? new Date(`${today.toISOString().slice(0, 10)}T${input.startTime}:00`).toISOString()
    : null

  const { data, error } = await supabase
    .from('routes')
    .insert({
      org_id: orgId,
      reference,
      driver_id: driverId,
      vehicle_id: vehicleId,
      status: 'planned',
      planned_start_at: plannedStart,
      planned_distance_km: input.plannedDistanceKm,
      path_polyline: input.pathPolyline,
      notes: input.notes.trim() || null,
    })
    .select('id')
    .single()

  const created =
    error && input.pathPolyline
      ? await supabase
          .from('routes')
          .insert({
            org_id: orgId,
            reference,
            driver_id: driverId,
            vehicle_id: vehicleId,
            status: 'planned',
            planned_start_at: plannedStart,
            planned_distance_km: input.plannedDistanceKm,
            notes: input.notes.trim() || null,
          })
          .select('id')
          .single()
      : { data, error }

  if (created.error || !created.data) throw new Error(created.error?.message ?? error?.message)

  const routeId = created.data.id

  const planned = input.plannedStops
  const rows =
    planned.length > 0
      ? planned.map((stop, i) => ({
          org_id: orgId,
          route_id: routeId,
          sequence: i + 1,
          name: stop.name,
          address: stop.address || null,
          latitude: stop.latitude,
          longitude: stop.longitude,
          distance_from_start_km: stop.distanceFromStartKm,
        }))
      : Array.from(
          { length: Math.max(2, Math.min(30, Number(input.stops) || 2)) },
          (_, i) => ({
            org_id: orgId,
            route_id: routeId,
            sequence: i + 1,
            name: `Stop ${i + 1}`,
            address: null as string | null,
            latitude: null as number | null,
            longitude: null as number | null,
            distance_from_start_km: null as number | null,
          }),
        )

  let stops = await supabase.from('route_stops').insert(rows)
  if (stops.error) {
    stops = await supabase.from('route_stops').insert(
      rows.map((row) => ({
        org_id: row.org_id,
        route_id: row.route_id,
        sequence: row.sequence,
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
      })),
    )
  }
  if (stops.error) throw new Error(`Route saved, but its stops were not: ${stops.error.message}`)

  // A route with both people named is also who is in that truck. The fleet
  // lists read driver_vehicle_assignments, not routes, so this pair has to
  // be written or the assignment only shows on Dispatch.
  if (driverId && vehicleId) await assignDriverToVehicle(orgId, vehicleId, driverId)

  return routeId
}

export async function assignRoute(
  orgId: string,
  routeId: string,
  patch: { driverId?: string | null; vehicleId?: string | null },
): Promise<void> {
  const next: { driver_id?: string | null; vehicle_id?: string | null } = {}
  if ('driverId' in patch) next.driver_id = patch.driverId ?? null
  if ('vehicleId' in patch) next.vehicle_id = patch.vehicleId ?? null
  if (Object.keys(next).length === 0) return

  const prior = await supabase
    .from('routes')
    .select('driver_id, vehicle_id')
    .eq('org_id', orgId)
    .eq('id', routeId)
    .is('deleted_at', null)
    .single()
  if (prior.error) throw new Error(prior.error.message)

  const { error } = await supabase
    .from('routes')
    .update(next)
    .eq('org_id', orgId)
    .eq('id', routeId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const current = await supabase
    .from('routes')
    .select('driver_id, vehicle_id')
    .eq('org_id', orgId)
    .eq('id', routeId)
    .is('deleted_at', null)
    .single()
  if (current.error) throw new Error(current.error.message)

  if (current.data?.driver_id && current.data.vehicle_id) {
    await assignDriverToVehicle(orgId, current.data.vehicle_id, current.data.driver_id)
    return
  }

  // The pair on the route is broken. Only take them off the truck if the open
  // assignment is still exactly that pair — a driver who signed onto another
  // vehicle in the app should not be pulled off it because a dispatcher
  // cleared yesterday's route.
  const wasDriver = prior.data?.driver_id
  const wasVehicle = prior.data?.vehicle_id
  if (!wasDriver || !wasVehicle) return

  const open = await supabase
    .from('driver_vehicle_assignments')
    .select('id')
    .eq('org_id', orgId)
    .eq('driver_id', wasDriver)
    .eq('vehicle_id', wasVehicle)
    .is('ended_at', null)
    .maybeSingle()
  if (open.error) throw new Error(open.error.message)
  if (open.data) await assignDriverToVehicle(orgId, wasVehicle, null)
}

/* ------------------------------------------------------------- messages */

export type MessageRow = {
  id: string
  driverId: string
  driverName: string
  direction: 'to_driver' | 'from_driver'
  body: string
  sentAt: string
  readAt: string | null
}

export async function loadMessages(orgId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, driver_id, direction, body, sent_at, read_at, drivers(first_name, last_name)')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((m) => {
    const driver = m.drivers as { first_name: string; last_name: string } | null
    return {
      id: m.id,
      driverId: m.driver_id,
      driverName: driver ? personName(driver.first_name, driver.last_name) : '',
      direction: m.direction,
      body: m.body,
      sentAt: m.sent_at,
      readAt: m.read_at,
    }
  })
}

/**
 * Calls back whenever any message in this organisation changes.
 *
 * Scoped to the org rather than to one driver: the console shows a list of
 * threads with unread badges, so a reply from any driver changes what is on
 * screen — subscribing per open thread would leave the badges stale.
 *
 * Row-level security is evaluated per row on the socket, so this carries only
 * this organisation's messages even though the filter says so too. The filter
 * is about bandwidth; the policy is about isolation.
 *
 * Returns the unsubscribe function.
 */
export function onMessagesChanged(orgId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`messages:org:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * Calls back when a driver asks for a log correction.
 *
 * Duty events were deliberately kept off the console's reload path: a
 * forty-truck depot writes hundreds of status changes a day, and reloading the
 * operations pass for each would be paying a large bill for a change nobody in
 * the office is waiting on.
 *
 * A correction request is the exception — somebody is waiting on it, and it
 * arrives a handful of times a week. So this subscribes to the whole table and
 * then throws away everything that is not one. That filtering is possible only
 * because duty_status_events has replica identity FULL: the payload carries
 * the row, so edit_status can be read here rather than by going back to ask.
 */
export function onCorrectionRequested(orgId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`corrections:org:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'duty_status_events',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { edit_status?: string | null } | null
        // Only a pending request, and only once it is one. An accepted or
        // rejected row is the console's own write coming back.
        if (row?.edit_status === 'pending') onChange()
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * Calls back when a repair on any of this organisation's trucks changes.
 *
 * Added because a driver can now raise a work order from the app. Without it,
 * a request lands in the database and sits there until somebody happens to
 * reload the vehicles page — which is not a thing a workshop does while
 * waiting to be told there is work.
 *
 * Cheap to act on: work orders are loaded by the fleet pass, which is vehicles
 * and work orders and nothing else.
 */
export function onWorkOrdersChanged(orgId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`work-orders:org:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'work_orders',
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * Calls back when an inspection is filed or a fault reported.
 *
 * Both on one channel: they arrive together — a submission and the defects it
 * found are one act by the driver — and reloading twice for one inspection
 * would be two passes over the same data.
 *
 * The caller reloads the operations pass, which is heavier than the fleet one.
 * That is affordable here and would not be for duty events: a driver files two
 * inspections a shift and changes status twenty times.
 */
export function onInspectionsChanged(orgId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`inspections:org:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'form_submissions',
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'defects',
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function sendMessage(orgId: string, driverId: string, body: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    org_id: orgId,
    driver_id: driverId,
    direction: 'to_driver',
    body: body.trim(),
  })
  if (error) throw new Error(error.message)
}

/** One message per driver, sharing a broadcast id so the office sees one send. */
export async function broadcastMessage(
  orgId: string,
  driverIds: string[],
  body: string,
): Promise<number> {
  if (driverIds.length === 0) return 0
  const broadcastId = crypto.randomUUID()
  const { error } = await supabase.from('messages').insert(
    driverIds.map((driverId) => ({
      org_id: orgId,
      driver_id: driverId,
      direction: 'to_driver' as const,
      body: body.trim(),
      broadcast_id: broadcastId,
    })),
  )
  if (error) throw new Error(error.message)
  return driverIds.length
}

export async function markMessagesRead(driverId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .eq('direction', 'from_driver')
    .is('read_at', null)
}

/* ------------------------------------------------------------ documents */

export type TripDocumentRow = {
  id: string
  fileName: string
  docType: string
  /**
   * Compliance paperwork or something that came back from a job.
   *
   * This loader used to fetch only 'trip', so the Documents screen showed
   * nothing while the organisation had six licences and insurance
   * certificates on file — they were reachable from a driver or a vehicle and
   * nowhere else. Both kinds belong on the screen that is called Documents;
   * the category is what separates them into tabs rather than what decides
   * whether they exist.
   */
  category: 'compliance' | 'trip' | 'vehicle'
  driverName: string | null
  vehicleName: string | null
  uploadedAt: string
  /** Compliance paperwork expires; trip paperwork does not. */
  expiresOn: string | null
  sizeBytes: number | null
  /** What kind of file it is, so a preview knows whether it can draw it. */
  mimeType: string | null
  /**
   * The number on the document — a licence number, a policy number.
   *
   * Collected at upload since the dialog was written, and shown nowhere. It is
   * the thing somebody reads a licence FOR.
   */
  reference: string | null
  issuingAuthority: string | null
  issuedOn: string | null
  /** Where the file sits in storage. Null when only a record was filed. */
  storagePath: string | null
}

export async function loadTripDocuments(orgId: string): Promise<TripDocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, category, doc_type, title, reference, issuing_authority, issued_on, storage_path, size_bytes, mime_type, expires_on, created_at, drivers!documents_driver_id_fkey(first_name, last_name), vehicles!documents_vehicle_id_fkey(name, plate)',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const driver = row.drivers as { first_name: string; last_name: string } | null
    const vehicle = row.vehicles as { name: string | null; plate: string } | null
    return {
      id: row.id,
      // The title if somebody set one, else the file name out of the path.
      fileName: row.title?.trim() || row.storage_path?.split('/').pop() || row.doc_type,
      docType: row.doc_type,
      category: row.category,
      driverName: driver ? personName(driver.first_name, driver.last_name) : null,
      vehicleName: vehicle?.name?.trim() || vehicle?.plate || null,
      uploadedAt: row.created_at,
      expiresOn: row.expires_on,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      mimeType: row.mime_type,
      reference: row.reference,
      issuingAuthority: row.issuing_authority,
      issuedOn: row.issued_on,
      storagePath: row.storage_path,
    }
  })
}

/**
 * A short-lived link to the actual file.
 *
 * Documents live in a private storage bucket: a public URL would put a
 * driver's paperwork on the open internet for anyone who guessed the path. A
 * signed link expires, so a copied URL stops working.
 *
 * Returns null when the row carries no path — a record was filed without the
 * file itself, which is a real state and not an error.
 */
const DOCUMENT_BUCKET = 'documents'
const LINK_VALID_SECONDS = 60

/**
 * What the bucket accepts. Matched by the bucket itself too — this is here so
 * the dialog can refuse a file before spending a minute uploading it.
 */
export const DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
] as const

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

export type UploadDocumentInput = {
  /** Which side of the split this is — see the documents table. */
  category: 'compliance' | 'trip'
  /** licence, medical, insurance, rc, bill_of_lading, pod … */
  docType: string
  title: string
  /** ISO date. Compliance paperwork only; trip paperwork does not expire. */
  expiresOn?: string
  reference?: string
  driverId?: string
  vehicleId?: string
  file: File
}

/**
 * Uploads a document and files the row that points at it.
 *
 * The storage path is not free-form. The bucket's policies can only see the
 * path, so the organisation comes first (tenant isolation is then a prefix
 * check) and the owner comes third (a driver can be given their own files
 * without being given the depot's):
 *
 *   <org_id>/<driver|vehicle|trip>/<owner_id>/<uuid>-<filename>
 *
 * The file goes up first. If the row then fails to insert the file is removed
 * again — an orphaned object nothing points at is invisible storage nobody
 * will ever clean up. The reverse order would be worse: a row promising a file
 * that was never uploaded is exactly the bug the download button used to have.
 */
export async function uploadDocument(
  orgId: string,
  input: UploadDocumentInput,
): Promise<string> {
  if (input.file.size > DOCUMENT_MAX_BYTES) {
    throw new Error('That file is larger than 25 MB.')
  }

  const kind = input.category === 'trip' ? 'trip' : input.driverId ? 'driver' : 'vehicle'
  const ownerId = input.category === 'trip' ? input.driverId : (input.driverId ?? input.vehicleId)
  if (!ownerId) throw new Error('A document has to belong to a driver or a vehicle.')

  // Keeps the original name readable while making the path unique, so two
  // people uploading "licence.jpg" do not overwrite one another.
  const safeName = input.file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80)
  const path = `${orgId}/${kind}/${ownerId}/${crypto.randomUUID()}-${safeName}`

  const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, input.file, {
    contentType: input.file.type || undefined,
    upsert: false,
  })
  if (upload.error) throw new Error(upload.error.message)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      category: input.category,
      driver_id: input.driverId ?? null,
      vehicle_id: input.vehicleId ?? null,
      doc_type: input.docType,
      title: input.title.trim() || input.file.name,
      reference: input.reference?.trim() || null,
      expires_on: input.category === 'compliance' ? input.expiresOn || null : null,
      storage_path: path,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
    })
    .select('id')
    .single()

  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path])
    throw new Error(error.message)
  }

  return data.id
}

/**
 * Compliance paperwork for one driver or vehicle.
 *
 * Kept separate from loadTripDocuments because the two answer different
 * questions: this one is "is this driver legal", that one is "what came back
 * from the job".
 */
export type ComplianceDocumentRow = {
  id: string
  title: string
  docType: string
  reference: string | null
  expiresOn: string | null
  uploadedAt: string
  sizeBytes: number | null
  storagePath: string | null
}

export async function loadComplianceDocuments(
  orgId: string,
  owner: { driverId?: string; vehicleId?: string },
): Promise<ComplianceDocumentRow[]> {
  let query = supabase
    .from('documents')
    .select('id, title, doc_type, reference, expires_on, created_at, size_bytes, storage_path')
    .eq('org_id', orgId)
    .eq('category', 'compliance')
    .is('deleted_at', null)
    .order('expires_on', { ascending: true, nullsFirst: false })

  if (owner.driverId) query = query.eq('driver_id', owner.driverId)
  else if (owner.vehicleId) query = query.eq('vehicle_id', owner.vehicleId)
  else return []

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? row.doc_type,
    docType: row.doc_type,
    reference: row.reference,
    expiresOn: row.expires_on,
    uploadedAt: row.created_at,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
  }))
}

export async function documentDownloadUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, LINK_VALID_SECONDS)

  if (error) throw new Error(error.message)
  return data?.signedUrl ?? null
}

/* --------------------------------------------------- safety and training */

export type SafetyEventRow = {
  id: string
  driverName: string
  eventType: string
  severity: 'low' | 'medium' | 'high'
  locationName: string | null
  occurredAt: string
  status: 'new' | 'coachable' | 'coached' | 'dismissed'
}

export async function loadSafetyEvents(orgId: string): Promise<SafetyEventRow[]> {
  const { data, error } = await supabase
    .from('safety_events')
    .select('id, event_type, severity, status, occurred_at, location_name, drivers(first_name, last_name)')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const driver = row.drivers as { first_name: string; last_name: string } | null
    return {
      id: row.id,
      driverName: driver ? personName(driver.first_name, driver.last_name) : '',
      eventType: row.event_type,
      severity: row.severity,
      locationName: row.location_name,
      occurredAt: row.occurred_at,
      status: row.status,
    }
  })
}

export async function setSafetyEventStatus(
  id: string,
  status: 'coachable' | 'dismissed',
): Promise<void> {
  const { error } = await supabase
    .from('safety_events')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** One driver's progress through one course. */
export type CourseLearnerRow = {
  assignmentId: string
  driverId: string
  driverName: string
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue'
  dueOn: string | null
  completedAt: string | null
  /**
   * Seconds the driver has had the course open, across pauses.
   *
   * Shown so "in progress" can be told apart from "opened once and left it" —
   * the status alone reads the same for both.
   */
  secondsSpent: number
}

export type CourseRow = {
  id: string
  title: string
  /** What the driver reads in the app. Null when the course is a file only. */
  description: string | null
  /**
   * Storage path of the material, not a URL.
   *
   * The bucket is private, so a stored URL would be dead within the hour. The
   * path is what survives; a signed URL is minted when someone opens it.
   */
  contentPath: string | null
  lengthMinutes: number | null
  status: 'draft' | 'published' | 'archived'
  fleetName: string | null
  assigned: number
  completed: number
  overdue: number
  /**
   * Who it is actually assigned to.
   *
   * Read from course_assignments. The detail screen used to build this list
   * itself — picking drivers out of the roster and spreading the completed and
   * overdue counts across them — which meant it named people who had never
   * been assigned the course and claimed some of them had finished it.
   */
  learners: CourseLearnerRow[]
}

export async function loadCourses(orgId: string): Promise<CourseRow[]> {
  const [courses, assignments] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, description, content_url, length_minutes, status, fleets(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('title', { ascending: true }),

    supabase
      .from('course_assignments')
      .select(
        'id, course_id, driver_id, status, due_on, completed_at, seconds_spent, drivers(first_name, last_name)',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null),
  ])

  if (courses.error) throw new Error(courses.error.message)
  if (assignments.error) throw new Error(assignments.error.message)

  const today = new Date().toISOString().slice(0, 10)

  return (courses.data ?? []).map((c) => {
    const mine = (assignments.data ?? []).filter((a) => a.course_id === c.id)
    return {
      id: c.id,
      title: displayName(c.title),
      description: c.description,
      contentPath: c.content_url,
      lengthMinutes: c.length_minutes,
      status: c.status,
      fleetName: displayName((c.fleets as { name: string } | null)?.name) || null,
      assigned: mine.length,
      completed: mine.filter((a) => a.completed_at !== null).length,
      // Overdue is computed, not stored: a due date that has passed is overdue
      // whether or not anything ran overnight to mark it.
      overdue: mine.filter(
        (a) => a.completed_at === null && a.due_on !== null && a.due_on < today,
      ).length,
      learners: mine.map((a) => {
        const driver = a.drivers as { first_name: string; last_name: string } | null
        const overdue = a.completed_at === null && a.due_on !== null && a.due_on < today
        return {
          assignmentId: a.id,
          driverId: a.driver_id,
          driverName: driver ? personName(driver.first_name, driver.last_name) : '—',
          // Overdue outranks whatever the row says: a course due last week is
          // overdue whether the driver started it or not.
          status: overdue ? ('overdue' as const) : a.status,
          dueOn: a.due_on,
          completedAt: a.completed_at,
          secondsSpent: a.seconds_spent ?? 0,
        }
      }),
    }
  })
}

/**
 * Assigns a course to drivers.
 *
 * Nothing wrote to course_assignments before this, anywhere — so a course
 * could be created and published and never reach a single driver, and the
 * assigned count on the training screen was permanently zero.
 *
 * Drivers already assigned are skipped rather than duplicated: assigning a
 * course to the whole depot twice should not give anybody two copies of it.
 */
export async function assignCourse(
  orgId: string,
  courseId: string,
  driverIds: string[],
  dueOn: string | null,
): Promise<number> {
  if (driverIds.length === 0) return 0

  const me = await supabase.auth.getUser()

  const existing = await supabase
    .from('course_assignments')
    .select('driver_id')
    .eq('course_id', courseId)
    .is('deleted_at', null)
  if (existing.error) throw new Error(existing.error.message)

  const already = new Set((existing.data ?? []).map((row) => row.driver_id))
  const fresh = driverIds.filter((id) => !already.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase.from('course_assignments').insert(
    fresh.map((driverId) => ({
      org_id: orgId,
      course_id: courseId,
      driver_id: driverId,
      status: 'assigned' as const,
      assigned_by: me.data.user?.id ?? null,
      due_on: dueOn,
    })),
  )

  if (error) throw new Error(error.message)
  return fresh.length
}

/**
 * Takes a course off a driver.
 *
 * Soft, so a completed course stays in the record. A driver who finished the
 * training last year finished it, and removing the assignment must not make
 * that disappear.
 */
export async function unassignCourse(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('course_assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)
}

export async function createCourse(
  orgId: string,
  input: { name: string; description: string; lengthMinutes: string; depotId: string },
): Promise<string> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      org_id: orgId,
      title: input.name.trim(),
      description: input.description.trim() || null,
      length_minutes: Number(input.lengthMinutes) || null,
      status: 'draft',
      // Empty means every driver in the organisation. This is who may SEE the
      // course, which is not the same as who has been given it — that is a row
      // in course_assignments, written by assignCourse.
      assigned_fleet_id: input.depotId || null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

/**
 * Edit what the driver reads, and how long the course is meant to take.
 *
 * The title is left alone on purpose: drivers have it in their list and in
 * their completed history, and renaming it under them would make a course they
 * finished last month look like one they never did.
 */
export async function updateCourseDetails(
  courseId: string,
  input: { description: string; lengthMinutes: string },
): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({
      description: input.description.trim() || null,
      length_minutes: Number(input.lengthMinutes) || null,
    })
    .eq('id', courseId)
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------------------ */
/* Course material                                                          */
/* ------------------------------------------------------------------------ */

const TRAINING_BUCKET = 'training'

/** The bucket's own allow-list, so the file picker offers exactly what will upload. */
export const TRAINING_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const

/** Matches the bucket's own file_size_limit, so the check fails here first. */
export const TRAINING_MAX_BYTES = 100 * 1024 * 1024

/**
 * Attach a file to a course, replacing whatever was there.
 *
 * The old file is removed after the row points at the new one, not before: if
 * the update fails, the course still has material. A file with no row pointing
 * at it is litter; a row pointing at a file that is gone is a broken course.
 */
export async function uploadCourseContent(
  orgId: string,
  courseId: string,
  file: File,
): Promise<string> {
  if (file.size > TRAINING_MAX_BYTES) {
    throw new Error('That file is larger than 100 MB.')
  }

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80)
  const path = `${orgId}/${courseId}/${crypto.randomUUID()}-${safeName}`

  const previous = await supabase
    .from('courses')
    .select('content_url')
    .eq('id', courseId)
    .single()
  if (previous.error) throw new Error(previous.error.message)

  const upload = await supabase.storage.from(TRAINING_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (upload.error) throw new Error(upload.error.message)

  const { error } = await supabase
    .from('courses')
    .update({ content_url: path })
    .eq('id', courseId)

  if (error) {
    await supabase.storage.from(TRAINING_BUCKET).remove([path])
    throw new Error(error.message)
  }

  if (previous.data.content_url) {
    await supabase.storage.from(TRAINING_BUCKET).remove([previous.data.content_url])
  }

  return path
}

export async function removeCourseContent(courseId: string): Promise<void> {
  const previous = await supabase
    .from('courses')
    .select('content_url')
    .eq('id', courseId)
    .single()
  if (previous.error) throw new Error(previous.error.message)

  const { error } = await supabase
    .from('courses')
    .update({ content_url: null })
    .eq('id', courseId)
  if (error) throw new Error(error.message)

  if (previous.data.content_url) {
    await supabase.storage.from(TRAINING_BUCKET).remove([previous.data.content_url])
  }
}

/** A short-lived link, minted when someone opens the file rather than on render. */
export async function courseContentUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(TRAINING_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

/* --------------------------------------------------- settings and audit */

export type OrgRow = {
  name: string
  countryCode: string | null
  timezone: string
  /** Which working-hours rule book applies. Null until somebody sets it. */
  regulator: string | null
}

export type AlertRuleRow = {
  id: string
  eventKey: string
  name: string
  description: string | null
  channels: string[]
  isActive: boolean
}

export type AuditRow = {
  id: string
  actorLabel: string | null
  action: string
  summary: string | null
  createdAt: string
}

export async function loadSettings(
  orgId: string,
): Promise<{ org: OrgRow; alertRules: AlertRuleRow[]; audit: AuditRow[] }> {
  const [org, rules, audit] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, country_code, timezone, hos_regulator')
      .eq('id', orgId)
      .single(),

    supabase
      .from('alert_rules')
      .select('id, event_key, name, description, channels, is_active')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),

    supabase
      .from('audit_log')
      .select('id, actor_label, action, summary, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (org.error) throw new Error(org.error.message)
  if (rules.error) throw new Error(rules.error.message)
  // The audit trail is readable by fleet admins and compliance officers only,
  // so a permission error here is a role question, not a broken screen.
  if (audit.error && !/permission|policy/i.test(audit.error.message)) {
    throw new Error(audit.error.message)
  }

  return {
    org: {
      name: org.data.name,
      countryCode: org.data.country_code,
      timezone: org.data.timezone,
      regulator: org.data.hos_regulator,
    },
    alertRules: (rules.data ?? []).map((r) => ({
      id: r.id,
      eventKey: r.event_key,
      name: r.name,
      description: r.description,
      channels: r.channels ?? [],
      isActive: r.is_active,
    })),
    audit: (audit.data ?? []).map((a) => ({
      id: a.id,
      actorLabel: a.actor_label,
      action: a.action,
      summary: a.summary,
      createdAt: a.created_at,
    })),
  }
}

export async function setAlertRuleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('alert_rules').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveOrgSettings(
  orgId: string,
  input: { name: string; country: string; timezone: string; regulator: string },
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({
      name: input.name.trim(),
      // country_code is not nullable, so a blank box leaves the stored value
      // alone rather than trying to clear it.
      ...(input.country.trim() ? { country_code: input.country.trim() } : {}),
      timezone: input.timezone.trim(),
      // Blank clears it, which is a real choice: "not decided yet".
      hos_regulator: input.regulator.trim() || null,
    })
    .eq('id', orgId)
  if (error) throw new Error(error.message)
}
