import { supabase, setRememberMe } from './client'
import { CONSOLE_ROLES } from '../config'
import type { AuthResult, Session } from '../features/auth/session'

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

  const fullName = profile?.full_name?.trim() || email.split('@')[0]

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
        name: row.name,
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
          ? `${driver.first_name} ${driver.last_name}`.trim()
          : vehicleLabel(row.vehicles as EmbeddedVehicle),
      }
    }),
    dueServices,
    openWorkOrders: (workOrders.data ?? []).map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      openedAt: row.opened_at,
      vehicleName: vehicleLabel(row.vehicles as EmbeddedVehicle),
    })),
  }
}

/* ==========================================================================
   Drivers, vehicles, staff — not wired yet
   ==========================================================================
   Added here as each module is switched over. Screens keep calling
   useFleetData(); only what that provider calls changes.
   ========================================================================== */
