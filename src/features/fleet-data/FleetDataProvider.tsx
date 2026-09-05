import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Role, StaffUser } from '../users/types'
import type { Inspection, InspectionDefect, ReportedDefect } from '../inspections/types'
import type { Message, Thread } from '../messages/types'
import type { DocumentRow } from '../documents/types'
import type { ScoreRow } from '../safety/types'
import type { DailyLog, DutySegment, UnassignedSegment } from '../hours/types'
import { isoDateKey } from '../hours/types'
import type { Driver } from '../drivers/types'
import { STRINGS } from '../../constants'
import * as api from '../../supabase/api'
import { useAuth } from '../auth/AuthProvider'
import type { Vehicle, WorkOrder } from '../vehicles/types'
import { type Route, type RouteStop } from '../dispatch/types'
import { haversineKm, parsePath } from '../dispatch/geometry'
import { type AlertRule, type AuditEntry } from '../settings/types'
import { type Course } from '../training/types'
import { type SafetyEvent } from '../safety/types'
import {
  type EditRequest,
  type Violation,
} from '../hours/types'
import { cycleDaysFor, drivingLeftToday, regulatorFrom, violationsForDay } from '../hours/rules'
import { VIOLATION_DETAIL, VIOLATION_WORDS } from '../hours/violationWords'
import { segmentsByDriverDate, windowEndingOn } from '../hours/segments'
import { formatClock as formatMinutes } from '../hours/totals'
import { DEFAULT_NEW_FORM_FIELDS, type FormDef, type FormField } from '../forms/types'

/**
 * Every list the console shows, in one place.
 *
 * All of it comes from Supabase. Each list starts empty and loading, a loader
 * fills it, and each function that changes something writes to the database and
 * reads the result back rather than guessing what the row became. A list with
 * nothing behind it stays empty and the screen says so — there is no starting
 * data anywhere in the console.
 *
 * Screens read from here rather than querying, so one load serves the whole
 * console and two screens can never disagree about the same fleet.
 */

export type OrgSettings = {
  name: string
  country: string
  timezone: string
  regulator: string
}

/** Every wired list reports the same three states. */
export type LoadStatus = 'loading' | 'ready' | 'error'

/**
 * What happened when a driver was added.
 *
 * The driver being saved and the app account being created are two steps, and
 * the second can fail on its own. The dialog needs to tell them apart: "saved,
 * and we emailed them" is a different sentence from "saved, but nobody has
 * told them yet".
 */
export type DriverAddResult = {
  /** An app account was created for them. */
  invited: boolean
  /** The one-time password reached their inbox. */
  emailed: boolean
  /** Returned only when the email failed, so the office can pass it on. */
  password?: string
  /** Why the invitation or the email did not go through. */
  reason?: string
}

type FleetDataValue = {
  drivers: Driver[]
  /** How the roster load is doing. */
  driversStatus: LoadStatus
  driversError: string | null
  reloadDrivers: () => void

  workOrders: WorkOrder[]
  fleetStatus: LoadStatus
  fleetError: string | null
  reloadFleet: () => void

  /** The roles this organisation can grant, with how many hold each. */
  roles: Role[]
  /** The depots, with how many drivers and vehicles are based at each. */
  depots: api.DepotRow[]
  staffStatus: LoadStatus
  staffError: string | null
  reloadStaff: () => void

  /* Everything else the console shows. One status between them: they are all
     the same organisation read under the same policies, so a failure is
     systemic rather than per-list. */
  logs: DailyLog[]
  unassigned: UnassignedSegment[]
  /**
   * Whether anything has actually assessed these.
   *
   * An empty violations list means two very different things: "checked, all
   * clear" and "nothing has checked". A compliance officer reads the first as
   * a clean fleet, so the screens must be able to tell them apart.
   */
  violationsEvaluated: boolean
  unassignedDetected: boolean
  inspections: Inspection[]
  inspectionDefects: Record<string, InspectionDefect[]>
  /** Defects a driver raised without an inspection, so they have no home above. */
  reportedDefects: ReportedDefect[]
  threads: Thread[]
  messagesByThread: Record<string, Message[]>
  documents: DocumentRow[]
  scoreboard: ScoreRow[]
  opsStatus: LoadStatus
  opsError: string | null
  reloadOps: () => void

  sendToDriver: (driverId: string, body: string) => Promise<void>
  broadcast: (body: string) => Promise<number>
  /** Marks a driver's incoming messages read. Opening a thread is seeing it. */
  markThreadRead: (driverId: string) => void

  /**
   * One driver's day as blocks on a 24-hour graph.
   *
   * Built from the recorded events, not invented: a day with nothing recorded
   * comes back empty and the graph says so, rather than drawing a plausible
   * shift that never happened.
   */
  dutySegmentsFor: (driverId: string, date: Date) => DutySegment[]
  /**
   * The days counting toward the cycle total for one date, oldest first.
   * Empty when no rule book is set, because the window length comes from it.
   */
  cycleWindowFor: (driverId: string, date: Date) => DutySegment[][]
  vehicles: Vehicle[]
  staff: StaffUser[]
  routes: Route[]
  routeStops: Record<string, RouteStop[]>
  forms: FormDef[]
  formFields: Record<string, FormField[]>
  courses: Course[]
  safetyEvents: SafetyEvent[]
  violations: Violation[]
  editRequests: EditRequest[]
  org: OrgSettings
  alertRules: AlertRule[]
  audit: AuditEntry[]

  addDriver: (input: NewDriver) => Promise<DriverAddResult>
  saveDriver: (id: string, input: NewDriver) => Promise<void>
  addVehicle: (input: NewVehicle) => Promise<string>
  saveVehicle: (id: string, input: NewVehicle) => Promise<void>
  inviteUser: (input: NewInvite) => Promise<void>
  /** Creates the app account for a driver who is on the roster but not on the app. */
  inviteDriver: (driverId: string) => Promise<api.DriverInviteResult>
  addRoute: (input: NewRoute) => Promise<Route | null>
  /** Puts a driver or a vehicle on an existing route, or clears one with null. */
  assignRoute: (
    routeId: string,
    patch: { driverId?: string | null; vehicleId?: string | null },
  ) => Promise<void>
  addForm: (input: NewForm) => Promise<void>
  addCourse: (input: NewCourse, file?: File | null) => Promise<string>
  /** Attaches material to a course, or clears it with null. */
  setCourseContent: (courseId: string, file: File | null) => Promise<void>
  /** Edits what the driver reads. The title is not editable — drivers hold it in their history. */
  saveCourseDetails: (
    courseId: string,
    input: { description: string; lengthMinutes: string },
  ) => Promise<void>

  resolveViolation: (id: string, decision: 'approve' | 'reject') => void
  resolveEditRequest: (id: string, decision: 'approve' | 'reject') => Promise<void>
  setSafetyEventStatus: (id: string, status: SafetyEvent['status']) => Promise<void>
  saveOrg: (next: OrgSettings) => Promise<void>
  toggleAlertRule: (id: string) => Promise<void>

  /* Depots. Renaming is safe: everything holds the depot's id. */
  addDepot: (input: NewDepot) => Promise<string>
  saveDepot: (id: string, input: NewDepot) => Promise<void>
  /** Refused while drivers or vehicles are still based there. */
  removeDepot: (id: string) => Promise<void>

  /** Puts a driver in a vehicle, or takes the current one out with null. */
  assignDriver: (vehicleId: string, driverId: string | null) => Promise<void>

  /* Publishing. A draft form or course is invisible to the driver app, which
     reads only published rows — so without these the builder was a dead end. */
  setFormPublished: (id: string, published: boolean) => Promise<void>
  setCoursePublished: (id: string, published: boolean) => Promise<void>

  /* Training. Nothing wrote course_assignments before, so no course ever
     actually reached a driver. */
  assignCourse: (courseId: string, driverIds: string[], dueOn: string | null) => Promise<number>
  unassignCourse: (assignmentId: string) => Promise<void>

  /* Repairs. A driver reports a defect; the office opens the work order. */
  addWorkOrder: (input: NewWorkOrder) => Promise<void>
  setWorkOrderStatus: (id: string, status: WorkOrder['status']) => Promise<void>
  resolveDefect: (
    defectId: string,
    outcome: 'resolved' | 'dismissed',
    correctiveAction: string,
  ) => Promise<void>
}

/*
 * Every "assign to a depot" field below is a depot id, never a name.
 *
 * It used to be the name, and the office could not tell: the dialog showed a
 * list of names, and the API looked the name back up. Renaming a depot then
 * quietly detached everything assigned to it. An empty string means "no depot"
 * on a driver or vehicle, and "every depot" on an invitation, form or course.
 */

export type NewDriver = {
  firstName: string
  lastName: string
  employeeNumber: string
  depotId: string
  email: string
  phone: string
  licenceExpires: string
  employment: 'active' | 'inactive' | 'terminated'
  currentLicenceExpires: string
  /** Empty means leave unassigned. */
  vehicleId: string
}

export type NewVehicle = {
  name: string
  plate: string
  vin: string
  makeModel: string
  year: string
  depotId: string
  odometerKm: string
  nextServiceKm: string
  status: 'active' | 'in_maintenance' | 'out_of_service' | 'retired'
  /** Empty means leave unassigned. */
  driverId: string
}

export type NewDepot = {
  name: string
  code: string
  timezone: string
  address: string
  latitude: number | null
  longitude: number | null
}
export type NewInvite = { name: string; email: string; role: string; depotId: string }
export type NewRoute = {
  driverId: string
  vehicleId: string
  origin: string
  destination: string
  stops: string
  startTime: string
  notes: string
  plannedDistanceKm: number | null
  pathPolyline: string | null
  plannedStops: api.NewRouteInput['plannedStops']
}
export type NewForm = { name: string; depotId: string }
export type NewCourse = {
  name: string
  /** Shown in the app above the file. On its own it is a read-and-acknowledge course. */
  description: string
  lengthMinutes: string
  /**
   * Who may SEE the course — not who has been given it. Being given a course
   * is a row in course_assignments, written from the course's own screen.
   */
  depotId: string
}
export type NewWorkOrder = { vehicleId: string; title: string; description: string; defectId?: string }

const FleetDataContext = createContext<FleetDataValue | null>(null)

/**
 * Blank until the settings row loads. Not a plausible-looking company: the
 * name shown on the settings screen and in the sidebar has to be the one in
 * the database, and a placeholder there would be read as real.
 */
const EMPTY_ORG: OrgSettings = {
  name: '',
  country: '',
  timezone: '',
  regulator: '',
}

/**
 * Whether anything detects driving with no driver signed in.
 *
 * False, and honest: it needs vehicle telemetry to compare against the duty
 * events, and there is no feed. The screen says "not checked yet" rather than
 * showing an empty list, which would read as "nothing wrong".
 *
 * Hours violations ARE evaluated now — see hours/rules.ts — but only when the
 * organisation has told us which rule book applies. Judging a driver against
 * the wrong limits is worse than saying nothing, so the flag follows the
 * setting rather than being hardcoded true.
 */
const UNASSIGNED_DETECTED = false

/** Initials from a display name: "Asha Patil" -> "AP". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase()
}

/** Minutes past the hour, in 24-hour form: "07:15". */
function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** "harsh_braking" -> "Harsh braking". Free-text keys read badly raw. */
function titleCaseWords(value: string): string {
  const clean = value.replace(/[_-]+/g, ' ').trim()
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/**
 * The graph has four lanes; the database has six statuses. Personal use and
 * yard moves are driving that does not count against the driving limit, and
 * they sit on the on-duty lane rather than getting lanes of their own.
 */
/** Duty statuses as the office says them. */
const DUTY_WORDS: Record<string, string> = {
  off_duty: 'Off duty',
  sleeper_berth: 'Sleeper',
  driving: 'Driving',
  on_duty_not_driving: 'On duty',
  personal_conveyance: 'Personal use',
  yard_move: 'Yard move',
}

/** Channel keys as the settings screen lists them. */
function channelWord(channel: string): string {
  if (channel === 'in_app') return 'In-app'
  if (channel === 'sms') return 'SMS'
  return titleCaseWords(channel)
}

/**
 * A route row into what the dispatch board shows.
 *
 * "Running late" is worked out here rather than stored: a route past its
 * planned end with stops outstanding is late, and no overnight job has to
 * remember to say so.
 */
function toRoute(row: api.RouteRow): Route {
  const done = row.stopsDone
  const total = row.stopsTotal
  const finished = row.status === 'completed' || (total > 0 && done === total)

  /*
   * Cancelled is answered before "finished", and before the late arithmetic.
   * It used to fall through both and come out as 'planned', which put called-off
   * work back on the board and — once dispatch started warning about
   * double-booking — would have counted a cancelled route as a commitment the
   * driver still had.
   */
  if (row.status === 'cancelled') {
    return {
      id: row.id,
      reference: row.reference,
      driver: row.driverName ?? '—',
      vehicle: row.vehicleName ?? '—',
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      origin: row.origin,
      destination: row.destination,
      distanceKm: row.plannedDistanceKm,
      path: parsePath(row.pathPolyline),
      stopsDone: done,
      stopsTotal: total,
      status: 'cancelled',
      eta: 'Cancelled',
    }
  }

  if (finished) {
    return {
      id: row.id,
      reference: row.reference,
      driver: row.driverName ?? '—',
      vehicle: row.vehicleName ?? '—',
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      origin: row.origin,
      destination: row.destination,
      distanceKm: row.plannedDistanceKm,
      path: parsePath(row.pathPolyline),
      stopsDone: done,
      stopsTotal: total,
      status: 'completed',
      eta: row.completedAt ? `Finished ${formatClock(row.completedAt)}` : 'Finished',
    }
  }

  const started = row.status === 'in_progress' || row.status === 'dispatched'
  const overBy =
    row.plannedEndAt && Date.now() > new Date(row.plannedEndAt).getTime()
      ? Math.round((Date.now() - new Date(row.plannedEndAt).getTime()) / 60_000)
      : 0

  return {
    id: row.id,
    reference: row.reference,
    driver: row.driverName ?? '—',
    vehicle: row.vehicleName ?? '—',
    driverId: row.driverId,
    vehicleId: row.vehicleId,
    origin: row.origin,
    destination: row.destination,
    distanceKm: row.plannedDistanceKm,
    path: parsePath(row.pathPolyline),
    stopsDone: done,
    stopsTotal: total,
    status: overBy > 0 ? 'late' : started ? 'in_progress' : 'planned',
    eta:
      overBy > 0
        ? `${overBy} min behind`
        : started
          ? 'On time'
          : row.plannedStartAt
            ? `Starts ${formatClock(row.plannedStartAt)}`
            : 'Not scheduled',
  }
}

/**
 * A timestamp into the wording the screens already use: "Today, 07:12",
 * "Yesterday", "2 days ago". Anything older than a week gets a plain date,
 * because "23 days ago" is harder to place than "09 Aug 2026".
 */
function formatWhen(iso: string): string {
  const then = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000)

  if (days <= 0) {
    return `Today, ${then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "2029-03-14" -> "14 Mar 2029", the way every other date reads here. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function FleetDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const orgId = session?.organization.id ?? null

  // Everything starts empty and loading. Nothing on screen predates its load,
  // so a screen can never show a row the database does not have.
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driversStatus, setDriversStatus] = useState<LoadStatus>('loading')
  const [driversError, setDriversError] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [fleetStatus, setFleetStatus] = useState<LoadStatus>('loading')
  const [fleetError, setFleetError] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [depots, setDepots] = useState<api.DepotRow[]>([])
  const [staffStatus, setStaffStatus] = useState<LoadStatus>('loading')
  const [staffError, setStaffError] = useState<string | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [routeStops, setRouteStops] = useState<Record<string, RouteStop[]>>({})
  const [forms, setForms] = useState<FormDef[]>([])
  const [formFields, setFormFields] = useState<Record<string, FormField[]>>({})
  const [courses, setCourses] = useState<Course[]>([])
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])
  const [org, setOrg] = useState<OrgSettings>(EMPTY_ORG)
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])

  const [logs, setLogs] = useState<DailyLog[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedSegment[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [inspectionDefects, setInspectionDefects] = useState<Record<string, InspectionDefect[]>>({})
  const [reportedDefects, setReportedDefects] = useState<ReportedDefect[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({})
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [scoreboard, setScoreboard] = useState<ScoreRow[]>([])
  /**
   * Duty segments per driver per day, built once at load.
   *
   * The graph, the day recap and the rule engine all read this. Building it
   * three times from the raw events would give three chances to disagree about
   * what a day contained.
   */
  const [dutySegments, setDutySegments] = useState<Map<string, Map<string, DutySegment[]>>>(
    new Map(),
  )
  /** Null when the organisation has not said which rule book applies. */
  const [regulator, setRegulator] = useState<ReturnType<typeof regulatorFrom>>(null)
  const [opsStatus, setOpsStatus] = useState<LoadStatus>('loading')
  const [opsError, setOpsError] = useState<string | null>(null)

  /**
   * Loads the roster from Supabase.
   *
   * Duty status, hours left and the safety score come back null: nothing is
   * recording them yet, and a default would read as a measurement. The screens
   * show a dash.
   */
  const loadDriversFromDb = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setDriversStatus('loading')
      setDriversError(null)
      try {
        const rows = await api.loadDrivers(orgId)
        if (signal?.cancelled) return
        setDrivers(
          rows.map((row) => {
            const name = `${row.firstName} ${row.lastName}`.trim()
            return {
              id: row.id,
        name,
        initials: initialsOf(name),
              firstName: row.firstName,
              lastName: row.lastName,
              employeeNumber: row.employeeNumber ?? '',
              email: row.email ?? '',
              phone: row.phone ?? '',
              depot: row.depotId && row.depotName ? { id: row.depotId, name: row.depotName } : null,
              employment: row.employment,
              duty: null,
              hoursLeft: null,
              safetyScore: null,
              vehicle: row.vehicleName,
              vehicleId: row.vehicleId,
              licenceExpires: formatDate(row.licenceExpiresOn),
              licenceExpiresOn: row.licenceExpiresOn ? row.licenceExpiresOn.slice(0, 10) : null,
              licenceWarning: row.licenceWarning,
              licenceExpired: row.licenceExpired,
              onApp: row.onApp,
            }
          }),
        )
        setDriversStatus('ready')
      } catch (error) {
        if (signal?.cancelled) return
        setDriversError(error instanceof Error ? error.message : 'The roster could not be loaded.')
        setDriversStatus('error')
      }
    },
    [orgId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void loadDriversFromDb(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadDriversFromDb])

  /** The fleet list and its repair jobs. Read together: the vehicles screen
   *  shows both, and the work order list names the vehicle it is against. */
  const loadFleetFromDb = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setFleetStatus('loading')
      setFleetError(null)
      try {
        const [vehicleRows, workOrderRows] = await Promise.all([
          api.loadVehicles(orgId),
          api.loadWorkOrders(orgId),
        ])
        if (signal?.cancelled) return

        setVehicles(
          vehicleRows.map((row) => ({
            id: row.id,
            kind: row.kind,
            name: row.name,
            plate: row.plate,
            vin: row.vin,
            makeModel: row.makeModel,
            year: row.year,
            status: row.status,
            driver: row.driverName,
            driverId: row.driverId,
            depot: row.depotId && row.depotName ? { id: row.depotId, name: row.depotName } : null,
            odometerKm: row.odometerKm,
            nextServiceKm: row.nextServiceKm,
            serviceOverdueKm: row.serviceOverdueKm,
          })),
        )
        setWorkOrders(
          workOrderRows.map((row) => ({
            id: row.id,
            reference: row.reference,
            vehicle: row.vehicleName,
            title: row.title,
            status: row.status,
            mechanic: row.mechanicName,
            opened: formatWhen(row.openedAt),
            costRupees: row.costRupees,
            requestedByDriverName: row.requestedByDriverName,
          })),
        )
        setFleetStatus('ready')
      } catch (error) {
        if (signal?.cancelled) return
        setFleetError(error instanceof Error ? error.message : 'The fleet could not be loaded.')
        setFleetStatus('error')
      }
    },
    [orgId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void loadFleetFromDb(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadFleetFromDb])

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    void (async () => {
      try {
        const written = await api.pairLiveRoutesOntoFleet(orgId)
        if (cancelled || written === 0) return
        await Promise.all([loadFleetFromDb(), loadDriversFromDb()])
      } catch {
        // Best effort: a route assign later still writes the pair.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, loadFleetFromDb, loadDriversFromDb])

  const addDriver = useCallback(
    async (input: NewDriver): Promise<DriverAddResult> => {
      if (!orgId) throw new Error('No organisation on this session.')
      const driverId = await api.createDriver(orgId, input)
      if (input.vehicleId) await api.assignDriverToVehicle(orgId, input.vehicleId, driverId)

      /*
       * The app account is a second step, and it is allowed to fail without
       * losing the driver. A driver with no email cannot be invited at all,
       * which is normal — the office adds the roster first and sorts out
       * phones later.
       */
      let result: DriverAddResult = { invited: false, emailed: false }
      if (input.email.trim()) {
        try {
          const invite = await api.inviteDriverToApp(driverId)
          result = {
            invited: true,
            emailed: invite.emailed,
            password: invite.password,
            reason: invite.reason,
          }
        } catch (error) {
          result = {
            invited: false,
            emailed: false,
            reason: error instanceof Error ? error.message : 'The invitation failed.',
          }
        }
      }

      // Read the roster back rather than pushing a guess onto the list. The
      // database decides the id, and a licence written as a document has to
      // be joined back in — building that row here would drift from what
      // loadDrivers returns.
      await Promise.all([loadDriversFromDb(), input.vehicleId ? loadFleetFromDb() : Promise.resolve()])
      return result
    },
    [orgId, loadDriversFromDb, loadFleetFromDb],
  )

  const saveDriver = useCallback(
    async (id: string, input: NewDriver) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.updateDriver(orgId, id, input)
      const current = drivers.find((row) => row.id === id)?.vehicleId ?? null
      const next = input.vehicleId || null
      const assignmentChanged = current !== next
      if (assignmentChanged) {
        if (next) await api.assignDriverToVehicle(orgId, next, id)
        else if (current) await api.assignDriverToVehicle(orgId, current, null)
      }
      await loadDriversFromDb()
      if (assignmentChanged) await loadFleetFromDb()
    },
    [orgId, drivers, loadDriversFromDb, loadFleetFromDb],
  )

  const addVehicle = useCallback(
    async (input: NewVehicle) => {
      if (!orgId) throw new Error('No organisation on this session.')
      const id = await api.createVehicle(orgId, input)
      if (input.driverId) await api.assignDriverToVehicle(orgId, id, input.driverId)
      await Promise.all([loadFleetFromDb(), loadDriversFromDb()])
      return id
    },
    [orgId, loadFleetFromDb, loadDriversFromDb],
  )

  const saveVehicle = useCallback(
    async (id: string, input: NewVehicle) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.updateVehicle(orgId, id, input)
      const current = vehicles.find((row) => row.id === id)?.driverId ?? null
      const next = input.driverId || null
      const assignmentChanged = current !== next
      if (assignmentChanged) await api.assignDriverToVehicle(orgId, id, next)
      await loadFleetFromDb()
      if (assignmentChanged) await loadDriversFromDb()
    },
    [orgId, vehicles, loadFleetFromDb, loadDriversFromDb],
  )

  const loadStaffFromDb = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setStaffStatus('loading')
      setStaffError(null)
      try {
        const [rows, roleRows, depotRows] = await Promise.all([
          api.loadStaff(orgId),
          api.loadRoles(orgId),
          api.loadDepots(orgId),
        ])
        if (signal?.cancelled) return
        setRoles(roleRows)
        setDepots(depotRows)
        setStaff(
          rows.map((row) => {
            // An invitation has no name until it is accepted, so the email
            // stands in — it is what the admin typed and what they recognise.
            const name = row.name?.trim() || row.email
            return {
              id: row.id,
              name,
              initials: initialsOf(name),
              email: row.email,
              role: row.roleName,
              fleet: row.fleetName ?? STRINGS.users.allDepots,
              status: row.status,
              lastActive: row.lastSeenAt ? formatWhen(row.lastSeenAt) : STRINGS.users.neverSignedIn,
            }
          }),
        )
        setStaffStatus('ready')
      } catch (error) {
        if (signal?.cancelled) return
        setStaffError(error instanceof Error ? error.message : 'The user list could not be loaded.')
        setStaffStatus('error')
      }
    },
    [orgId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void loadStaffFromDb(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadStaffFromDb])

  const inviteUser = useCallback(
    async (input: NewInvite) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.inviteStaff(orgId, input)
      await loadStaffFromDb()
    },
    [orgId, loadStaffFromDb],
  )

  const inviteDriver = useCallback(
    async (driverId: string) => {
      const result = await api.inviteDriverToApp(driverId)
      await loadDriversFromDb()
      return result
    },
    [loadDriversFromDb],
  )

  /**
   * Everything the remaining modules read, in one pass.
   *
   * The hours window is the surrounding five weeks, which covers the month
   * view either side of today without pulling a year of duty events for a
   * screen that shows one month.
   */
  const loadOperationsFromDb = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setOpsStatus('loading')
      setOpsError(null)
      try {
        const from = new Date()
        from.setDate(from.getDate() - 35)
        const to = new Date()
        to.setDate(to.getDate() + 35)

        const [
          hours,
          inspectionData,
          routeData,
          messageRows,
          docRows,
          safetyRows,
          courseRows,
          settings,
          formRows,
        ] = await Promise.all([
            api.loadHours(orgId, from.toISOString(), to.toISOString()),
            api.loadInspections(orgId),
            api.loadRoutes(orgId),
            api.loadMessages(orgId),
            api.loadTripDocuments(orgId),
            api.loadSafetyEvents(orgId),
            api.loadCourses(orgId),
            api.loadSettings(orgId),
            api.loadForms(orgId),
          ])
        if (signal?.cancelled) return

        /* ------------------------------------------------------------ hours */
        /*
         * A day is certified, not certified, or nothing at all. "Violation" and
         * "missing log" need the rule engine that does not exist yet — see the
         * hours_of_service migration — so no day is marked either, rather than
         * marked wrongly.
         */
        const byDriver = new Map<string, DailyLog>()
        for (const log of hours.logs) {
          const existing = byDriver.get(log.driverId) ?? {
            driverId: log.driverId,
            driver: log.driverName,
            states: {},
          }
          existing.states[log.logDate] = log.certifiedAt ? 'certified' : 'uncertified'
          byDriver.set(log.driverId, existing)
        }

        /*
         * A driver with duty events but no certification row has uncertified
         * days, which is exactly what a compliance officer is looking for.
         *
         * This loop used to `continue` when the driver was not already in the
         * map — and the map was built only from hos_daily_logs, so a driver who
         * had never certified anything was not in it. The result was the
         * opposite of what the comment claimed: the one driver whose log needed
         * chasing was the one missing from the screen, and their correction
         * requests rendered as a blank line with a link to nobody.
         *
         * They are added now instead of skipped. The name comes off the event,
         * which is why loadHours joins drivers.
         */
        for (const event of hours.events) {
          if (event.editOfId) continue
          const key = isoDateKey(new Date(event.startedAt))
          const existing = byDriver.get(event.driverId) ?? {
            driverId: event.driverId,
            driver: event.driverName,
            states: {},
          }
          if (!existing.states[key]) existing.states[key] = 'uncertified'
          // A name only ever gets filled in, never blanked: the daily-log join
          // and the event join can disagree about which one has it.
          if (!existing.driver && event.driverName) existing.driver = event.driverName
          byDriver.set(event.driverId, existing)
        }
        setLogs([...byDriver.values()])

        // Originals only: a proposed correction is not part of the day until
        // the driver accepts it. segmentsByDriverDate drops them itself, and
        // the clock is passed in so the same events always build the same days.
        const segments = segmentsByDriverDate(hours.events, new Date())
        setDutySegments(segments)

        /*
         * The row each request is arguing with, by id.
         *
         * Needed because a request is only half a sentence on its own. "Make
         * this Driving" is not something an office can approve; "10:23 was
         * recorded Off duty and the driver says it was Driving" is. fromStatus
         * used to be hardcoded to a dash, so the reviewer was deciding without
         * the half that mattered.
         */
        const originals = new Map(hours.events.map((e) => [e.id, e]))

        // Corrections still waiting on the driver. These are real rows.
        setEditRequests(
          hours.events
            .filter((e) => e.editStatus === 'pending')
            .map((e) => ({
              id: e.id,
              // Off the event, not out of byDriver. A request from a driver
              // with no certification history used to come through nameless.
              driver: e.driverName || byDriver.get(e.driverId)?.driver || '',
              requested: formatWhen(e.startedAt),
              reason: e.editReason ?? '',
              date: formatWhen(e.startedAt),
              vehicle: e.vehicleName ?? '—',
              logDate: formatDate(isoDateKey(new Date(e.startedAt))) ?? '',
              kind: 'change',
              /*
               * A dash only when the original is outside the loaded window —
               * the events are pulled 35 days either side, and a driver can
               * challenge something older than that. Better a dash there than
               * a guess.
               */
              fromStatus: (() => {
                const original = e.editOfId ? originals.get(e.editOfId) : undefined
                if (!original) return '—'
                return DUTY_WORDS[original.status] ?? original.status
              })(),
              toStatus: DUTY_WORDS[e.status] ?? e.status,
              timeFrom: formatClock(e.startedAt),
              timeTo: formatClock(e.startedAt),
            })),
        )

        /* ------------------------------------------------------- violations */
        /*
         * Worked out here from the duty events, never stored. A driver
         * correcting yesterday's log changes yesterday's violations, and
         * changing the organisation's regulator re-judges the whole history —
         * both for free, because nothing was written down.
         *
         * Only when the rule book is known. An unset regulator means the
         * screen says "not checked" rather than judging a driver against
         * limits nobody chose.
         */
        const book = regulatorFrom(settings.org.regulator ?? '')
        setRegulator(book)

        if (!book) {
          setViolations([])
        } else {
          const cycleDays = cycleDaysFor(book)
          const found: Violation[] = []

          for (const [driverId, days] of segments) {
            const driverName = byDriver.get(driverId)?.driver ?? ''
            for (const [date, today] of days) {
              const cycleWindow = windowEndingOn(date, cycleDays).map(
                (key) => days.get(key) ?? [],
              )
              for (const breach of violationsForDay(book, driverId, date, today, cycleWindow)) {
                found.push({
                  id: breach.id,
                  driver: driverName,
                  type: VIOLATION_WORDS[breach.kind],
                  detail: VIOLATION_DETAIL[breach.kind],
                  occurred: formatDate(date) ?? date,
                  // Nothing records a review decision yet, so every breach is
                  // open. Marking one reviewed lives only in this session —
                  // see resolveViolation.
                  status: 'open',
                  vehicle:
                    hours.events.find(
                      (e) =>
                        e.driverId === driverId &&
                        isoDateKey(new Date(e.startedAt)) === date &&
                        e.vehicleName,
                    )?.vehicleName ?? '—',
                  logDate: formatDate(date) ?? date,
                  limit: breach.limit,
                  actual: breach.actual,
                  overage: breach.overage,
                  // Duty events carry a position, but not every one does and a
                  // breach spans a whole day rather than happening at a point.
                  location: '—',
                })
              }
            }
          }

          // Worst first is not meaningful across rule kinds, so newest first:
          // a compliance officer works back from today.
          found.sort((a, b) => b.id.localeCompare(a.id))
          setViolations(found)
        }
        // Needs telemetry to spot driving with nobody signed in.
        setUnassigned([])

        /* ------------------------------------------------------ inspections */
        /*
         * Two homes for one list. A defect found during an inspection belongs
         * under that inspection. A defect raised on its own does not — the
         * schema allows a null submission_id on purpose, so a driver can
         * report "AC not working" mid-route without filling in a whole
         * pre-trip form. Those used to be skipped here, which meant a driver
         * could report a fault and the office would never see it.
         */
        const defectsBySubmission: Record<string, InspectionDefect[]> = {}
        const reported: ReportedDefect[] = []
        for (const defect of inspectionData.defects) {
          const row: InspectionDefect = {
            id: defect.id,
            area: defect.area,
            finding: defect.finding,
            severity:
              defect.severity === 'out_of_service'
                ? 'critical'
                : defect.severity === 'major'
                  ? 'major'
                  : 'minor',
            // Passed through rather than collapsed. "Dismissed" used to be
            // rewritten as "resolved" here, which claimed a repair that never
            // happened.
            status: defect.status,
            workOrderId: defect.workOrderId,
            correctiveAction: defect.correctiveAction,
          }
          if (defect.submissionId) {
            defectsBySubmission[defect.submissionId] = [
              ...(defectsBySubmission[defect.submissionId] ?? []),
              row,
            ]
          } else {
            reported.push({ ...row, vehicle: defect.vehicleName })
          }
        }
        setInspectionDefects(defectsBySubmission)
        setReportedDefects(reported)

        setInspections(
          inspectionData.submissions
            // Only the inspection forms. A fuel docket is a submission too, and
            // it does not belong on the inspections screen.
            .filter((sub) => sub.formKind !== 'custom')
            .map((sub) => {
              const found = defectsBySubmission[sub.id] ?? []
              const open = found.filter((d) => d.status === 'open')
              const worst =
                open.find((d) => d.severity === 'critical') ??
                open.find((d) => d.severity === 'major') ??
                open[0]
              return {
                id: sub.id,
                vehicle: sub.vehicleName ?? '—',
                driver: sub.driverName ?? '—',
                type: sub.formKind === 'dvir_pre' ? ('Pre-trip' as const) : ('Post-trip' as const),
                submitted: formatWhen(sub.submittedAt),
                defects: found.length,
                // Status follows the defects, not a field somebody ticked: an
                // inspection with an open defect is not resolved.
                status: open.length > 0 ? 'open_defect' : sub.status === 'submitted' ? 'pending' : 'resolved',
                worstDefect: worst
                  ? `${worst.area} — ${worst.severity === 'critical' ? 'safety critical' : worst.finding}`
                  : null,
              }
            }),
        )

        /* --------------------------------------------------------- dispatch */
        setRoutes(routeData.routes.map(toRoute))
        const stopsByRoute: Record<string, RouteStop[]> = {}
        for (const stop of routeData.stops) {
          stopsByRoute[stop.routeId] = [
            ...(stopsByRoute[stop.routeId] ?? []),
            {
              id: stop.id,
              sequence: stop.sequence,
              name: stop.name,
              address: stop.address ?? '',
              kmFromStart: stop.distanceFromStartKm,
              lat: stop.latitude,
              lng: stop.longitude,
              window:
                stop.windowStartAt && stop.windowEndAt
                  ? `${formatClock(stop.windowStartAt)} – ${formatClock(stop.windowEndAt)}`
                  : '',
              arrivedAt: stop.arrivedAt ? formatClock(stop.arrivedAt) : null,
              arrivedDistanceM: stop.arrivedDistanceM,
            },
          ]
        }
        for (const [id, list] of Object.entries(stopsByRoute)) {
          let running = 0
          stopsByRoute[id] = list.map((stop, index) => {
            if (stop.kmFromStart != null) return stop
            if (index === 0) return { ...stop, kmFromStart: 0 }
            const prev = list[index - 1]
            if (
              prev.lat == null ||
              prev.lng == null ||
              stop.lat == null ||
              stop.lng == null
            ) {
              return stop
            }
            running += haversineKm(
              { lat: prev.lat, lng: prev.lng },
              { lat: stop.lat, lng: stop.lng },
            )
            return { ...stop, kmFromStart: Math.round(running * 10) / 10 }
          })
        }
        setRouteStops(stopsByRoute)

        /* --------------------------------------------------------- messages */
        const conversations = new Map<string, Message[]>()
        const newest = new Map<string, api.MessageRow>()
        const unreadFor = new Map<string, number>()
        for (const row of messageRows) {
          conversations.set(row.driverId, [
            ...(conversations.get(row.driverId) ?? []),
            {
              id: row.id,
              from: row.direction === 'from_driver' ? 'driver' : 'office',
              body: row.body,
              at: formatClock(row.sentAt),
            },
          ])
          newest.set(row.driverId, row)
          if (row.direction === 'from_driver' && row.readAt === null) {
            unreadFor.set(row.driverId, (unreadFor.get(row.driverId) ?? 0) + 1)
          }
        }
        setMessagesByThread(Object.fromEntries(conversations))
        setThreads(
          [...newest.entries()]
            .map(([driverId, row]) => ({
              id: driverId,
              driver: row.driverName,
              initials: initialsOf(row.driverName),
              preview: row.body,
              at: formatWhen(row.sentAt),
              unreadCount: unreadFor.get(driverId) ?? 0,
            }))
            /*
             * Unread first, and within those the most waiting first. A
             * dispatcher works down this list; a thread with four unanswered
             * messages needs them before one with a single "ok".
             */
            .sort((a, b) => b.unreadCount - a.unreadCount),
        )

        /* -------------------------------------------------------- documents */
        setDocuments(
          docRows.map((row) => ({
            id: row.id,
            name: row.fileName,
            kind: titleCaseWords(row.docType),
            driver: row.driverName ?? '—',
            vehicle: row.vehicleName ?? '—',
            uploaded: formatWhen(row.uploadedAt),
            sizeKb: row.sizeBytes === null ? null : Math.round(row.sizeBytes / 1024),
            storagePath: row.storagePath,
          })),
        )

        /* ------------------------------------------------ safety and training */
        setSafetyEvents(
          safetyRows.map((row) => ({
            id: row.id,
            driver: row.driverName,
            initials: initialsOf(row.driverName),
            kind: titleCaseWords(row.eventType),
            severity: row.severity,
            location: row.locationName ?? '—',
            at: formatWhen(row.occurredAt),
            status: row.status === 'coached' ? 'coachable' : row.status,
          })),
        )
        // Needs a scoring rule over safety events. Nothing scores them yet.
        setScoreboard([])

        setCourses(
          courseRows.map((row) => ({
            id: row.id,
            name: row.title,
            description: row.description,
            contentPath: row.contentPath,
            lengthMinutes: row.lengthMinutes,
            assigned: row.assigned,
            completed: row.completed,
            overdue: row.overdue,
            status: row.status === 'published' ? 'published' : 'draft',
            assignTo: row.fleetName ?? STRINGS.training.allDrivers,
            learners: row.learners.map((l) => ({
              assignmentId: l.assignmentId,
              driverId: l.driverId,
              driverName: l.driverName,
              status: l.status,
              dueOn: l.dueOn,
              secondsSpent: l.secondsSpent,
            })),
          })),
        )

        /* --------------------------------------------------------- settings */
        setOrg({
          name: settings.org.name,
          country: settings.org.countryCode ?? '',
          timezone: settings.org.timezone,
          regulator: settings.org.regulator ?? '',
        })
        setAlertRules(
          settings.alertRules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            detail: rule.description ?? '',
            channels: rule.channels.map(channelWord).join(', '),
            on: rule.isActive,
          })),
        )
        setAudit(
          settings.audit.map((entry) => ({
            id: entry.id,
            who: entry.actorLabel ?? STRINGS.settings.systemActor,
            initials: initialsOf(entry.actorLabel ?? 'System'),
            action: titleCaseWords(entry.action),
            target: entry.summary ?? '',
            at: formatWhen(entry.createdAt),
          })),
        )

        /* ------------------------------------------------------------ forms */
        setForms(
          formRows.map((row) => ({
            id: row.id,
            name: row.name,
            fields: row.fieldCount,
            version: row.version,
            status: row.status === 'published' ? 'published' : 'draft',
            assignedTo: row.fleetName ?? STRINGS.forms.allDrivers,
            submissions: row.submissions,
            updated: formatWhen(row.updatedAt),
          })),
        )
        setFormFields(Object.fromEntries(formRows.map((row) => [row.id, row.fields])))

        setOpsStatus('ready')
      } catch (error) {
        if (signal?.cancelled) return
        setOpsError(error instanceof Error ? error.message : 'This could not be loaded.')
        setOpsStatus('error')
      }
    },
    [orgId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void loadOperationsFromDb(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadOperationsFromDb])

  /*
   * Live messages.
   *
   * The console read the thread once on load, so a driver's reply sat there
   * until somebody navigated away and back. A message is the one thing here
   * that is a conversation — everything else on this screen is a record being
   * reviewed, and those are fine to read on open.
   *
   * Only `messages` is on the wire (see the realtime_messages migration), so
   * this fires for messages and nothing else. It reloads the operations pass
   * rather than patching the thread in place: the thread list, the unread
   * badges and the notification bell are all derived from the same load, and
   * patching one of them would leave the other two behind.
   */
  useEffect(() => {
    if (!orgId) return
    return api.onMessagesChanged(orgId, () => {
      void loadOperationsFromDb()
    })
  }, [orgId, loadOperationsFromDb])

  /*
   * The inspection loop, live.
   *
   * A driver can now file an inspection, report a fault and raise a work order
   * from the app, and every one of those is somebody waiting on this console.
   * Two subscriptions rather than one because they cost different amounts:
   * work orders are in the fleet pass (vehicles and work orders), inspections
   * are in the operations pass, and reloading operations for a work order
   * would be paying the larger bill for the smaller change.
   *
   * Both debounced. A submission and the several defects it found arrive as
   * separate messages within a second of each other, and that is one reload,
   * not five.
   */
  useEffect(() => {
    if (!orgId) return

    let fleetTimer: ReturnType<typeof setTimeout> | undefined
    let opsTimer: ReturnType<typeof setTimeout> | undefined

    const stopWorkOrders = api.onWorkOrdersChanged(orgId, () => {
      if (fleetTimer) clearTimeout(fleetTimer)
      fleetTimer = setTimeout(() => void loadFleetFromDb(), 900)
    })

    const stopInspections = api.onInspectionsChanged(orgId, () => {
      if (opsTimer) clearTimeout(opsTimer)
      opsTimer = setTimeout(() => void loadOperationsFromDb(), 900)
    })

    /*
     * Correction requests only, not every duty event — see the api function.
     * A driver who has asked to change a past log is waiting on a person here,
     * and a request that sits invisible until somebody happens to reload is a
     * request the driver assumes was ignored.
     */
    const stopCorrections = api.onCorrectionRequested(orgId, () => {
      if (opsTimer) clearTimeout(opsTimer)
      opsTimer = setTimeout(() => void loadOperationsFromDb(), 900)
    })

    return () => {
      if (fleetTimer) clearTimeout(fleetTimer)
      if (opsTimer) clearTimeout(opsTimer)
      stopWorkOrders()
      stopInspections()
      stopCorrections()
    }
  }, [orgId, loadFleetFromDb, loadOperationsFromDb])

  const addRoute = useCallback(
    async (input: NewRoute): Promise<Route | null> => {
      if (!orgId) throw new Error('No organisation on this session.')
      const id = await api.createRoute(orgId, input)
      await Promise.all([loadOperationsFromDb(), loadFleetFromDb(), loadDriversFromDb()])
      // Read back rather than guessing: the database owns the reference, and
      // the stop rows decide "0 of 8".
      const fresh = await api.loadRoutes(orgId)
      const row = fresh.routes.find((r) => r.id === id)
      return row ? toRoute(row) : null
    },
    [orgId, loadOperationsFromDb, loadFleetFromDb, loadDriversFromDb],
  )

  const assignRoute = useCallback(
    async (routeId: string, patch: { driverId?: string | null; vehicleId?: string | null }) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.assignRoute(orgId, routeId, patch)
      await Promise.all([loadOperationsFromDb(), loadFleetFromDb(), loadDriversFromDb()])
    },
    [orgId, loadOperationsFromDb, loadFleetFromDb, loadDriversFromDb],
  )

  const addForm = useCallback(
    async (input: NewForm) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.createForm(orgId, input, DEFAULT_NEW_FORM_FIELDS)
      await loadOperationsFromDb()
    },
    [orgId, loadOperationsFromDb],
  )

  /**
   * Returns the new course's id, because a file can only be uploaded against a
   * course that exists — the path has the course id in it, and the driver read
   * policy reads that segment.
   */
  const addCourse = useCallback(
    async (input: NewCourse, file?: File | null) => {
      if (!orgId) throw new Error('No organisation on this session.')
      const id = await api.createCourse(orgId, input)
      if (file) await api.uploadCourseContent(orgId, id, file)
      await loadOperationsFromDb()
      return id
    },
    [orgId, loadOperationsFromDb],
  )

  const saveCourseDetails = useCallback(
    async (courseId: string, input: { description: string; lengthMinutes: string }) => {
      await api.updateCourseDetails(courseId, input)
      await loadOperationsFromDb()
    },
    [loadOperationsFromDb],
  )

  const setCourseContent = useCallback(
    async (courseId: string, file: File | null) => {
      if (!orgId) throw new Error('No organisation on this session.')
      if (file) await api.uploadCourseContent(orgId, courseId, file)
      else await api.removeCourseContent(courseId)
      await loadOperationsFromDb()
    },
    [orgId, loadOperationsFromDb],
  )

  /**
   * Violations are worked out from duty events on read, so there is no row to
   * update — the decision lives only in this session. When the rule engine
   * lands it will need somewhere to record "reviewed", and that is the point
   * to give it a table.
   */
  const resolveViolation = useCallback((id: string, decision: 'approve' | 'reject') => {
    setViolations((current) =>
      current.map((v) =>
        v.id === id ? { ...v, status: decision === 'approve' ? 'reviewed' : 'dismissed' } : v,
      ),
    )
  }, [])

  const resolveEditRequest = useCallback(
    async (id: string, decision: 'approve' | 'reject') => {
      // Off the queue first, so a reviewer working down a list is not waiting
      // on a round trip for each one.
    setEditRequests((current) => current.filter((e) => e.id !== id))

      try {
        await api.resolveDutyEdit(id, decision)
      } catch (error) {
        // Put it back. A decision that did not save must not look decided —
        // this is a compliance record, and the reviewer has to know.
        await loadOperationsFromDb()
        throw error
      }
    },
    [loadOperationsFromDb],
  )

  const setSafetyEventStatus = useCallback(
    async (id: string, status: SafetyEvent['status']) => {
      // Shown immediately, then written. A reviewer clicking down a list of
      // twenty events should not wait for a round trip on each one.
    setSafetyEvents((current) => current.map((e) => (e.id === id ? { ...e, status } : e)))
      // 'new' is the absence of a decision, and there is nothing to record.
      if (status === 'new') return
      await api.setSafetyEventStatus(id, status === 'coachable' ? 'coachable' : 'dismissed')
    },
    [],
  )

  const saveOrg = useCallback(
    async (next: OrgSettings) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.saveOrgSettings(orgId, next)
      setOrg(next)
      await loadOperationsFromDb()
    },
    [orgId, loadOperationsFromDb],
  )

  const toggleAlertRule = useCallback(async (id: string) => {
    let turningOn = false
    setAlertRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule
        turningOn = !rule.on
        return { ...rule, on: turningOn }
      }),
    )
    await api.setAlertRuleActive(id, turningOn)
  }, [])

  const sendToDriver = useCallback(
    async (driverId: string, body: string) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.sendMessage(orgId, driverId, body)
      await loadOperationsFromDb()
    },
    [orgId, loadOperationsFromDb],
  )

  const markThreadRead = useCallback(
    (driverId: string) => {
      // Cleared on screen straight away — the badge must not lag behind the
      // thread the reader is looking at.
      setThreads((current) =>
        current.map((thread) => (thread.id === driverId ? { ...thread, unreadCount: 0 } : thread)),
      )
      // Not awaited: a read receipt is not worth blocking the UI, and a
      // failure means it stays unread, which is the safe direction.
      void api.markMessagesRead(driverId)
    },
    [],
  )

  /** One message per driver, so each gets their own read receipt. */
  const broadcast = useCallback(
    async (body: string) => {
      if (!orgId) throw new Error('No organisation on this session.')
      const sent = await api.broadcastMessage(orgId, drivers.map((d) => d.id), body)
      await loadOperationsFromDb()
      return sent
    },
    [orgId, drivers, loadOperationsFromDb],
  )

  /* ------------------------------------------------------------- depots */

  const addDepot = useCallback(
    async (input: NewDepot) => {
      if (!orgId) throw new Error('No organisation on this session.')
      const id = await api.createDepot(orgId, input)
      await loadStaffFromDb()
      return id
    },
    [orgId, loadStaffFromDb],
  )

  const saveDepot = useCallback(
    async (id: string, input: NewDepot) => {
      await api.updateDepot(id, input)
      // The roster and the fleet both show the depot's name, so a rename has
      // to be read back everywhere rather than only on the depots screen.
      await Promise.all([loadStaffFromDb(), loadDriversFromDb(), loadFleetFromDb()])
    },
    [loadStaffFromDb, loadDriversFromDb, loadFleetFromDb],
  )

  const removeDepot = useCallback(
    async (id: string) => {
      await api.archiveDepot(id)
      await loadStaffFromDb()
    },
    [loadStaffFromDb],
  )

  /* -------------------------------------------- driver to vehicle */

  const assignDriver = useCallback(
    async (vehicleId: string, driverId: string | null) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.assignDriverToVehicle(orgId, vehicleId, driverId)
      // Both lists name the other side of this pair, so both are stale now.
      await Promise.all([loadFleetFromDb(), loadDriversFromDb()])
    },
    [orgId, loadFleetFromDb, loadDriversFromDb],
  )

  /* ---------------------------------------------------- publishing */

  const setFormPublished = useCallback(
    async (id: string, published: boolean) => {
      setForms((current) =>
        current.map((f) => (f.id === id ? { ...f, status: published ? 'published' : 'draft' } : f)),
      )
      try {
        await api.setFormPublished(id, published)
        await loadOperationsFromDb()
      } catch (error) {
        // Put it back. A form that looks published and is not would leave the
        // office waiting for submissions that can never arrive.
        await loadOperationsFromDb()
        throw error
      }
    },
    [loadOperationsFromDb],
  )

  const setCoursePublished = useCallback(
    async (id: string, published: boolean) => {
      setCourses((current) =>
        current.map((c) => (c.id === id ? { ...c, status: published ? 'published' : 'draft' } : c)),
      )
      try {
        await api.setCoursePublished(id, published)
        await loadOperationsFromDb()
      } catch (error) {
        await loadOperationsFromDb()
        throw error
      }
    },
    [loadOperationsFromDb],
  )

  /* ------------------------------------------------------ training */

  const assignCourse = useCallback(
    async (courseId: string, driverIds: string[], dueOn: string | null) => {
      if (!orgId) throw new Error('No organisation on this session.')
      const added = await api.assignCourse(orgId, courseId, driverIds, dueOn)
      await loadOperationsFromDb()
      return added
    },
    [orgId, loadOperationsFromDb],
  )

  const unassignCourse = useCallback(
    async (assignmentId: string) => {
      await api.unassignCourse(assignmentId)
      await loadOperationsFromDb()
    },
    [loadOperationsFromDb],
  )

  /* ------------------------------------------------------- repairs */

  const addWorkOrder = useCallback(
    async (input: NewWorkOrder) => {
      if (!orgId) throw new Error('No organisation on this session.')
      await api.createWorkOrder(orgId, input)
      // The fleet list carries the work orders; the inspection carries the
      // defect that now points at one.
      await Promise.all([loadFleetFromDb(), loadOperationsFromDb()])
    },
    [orgId, loadFleetFromDb, loadOperationsFromDb],
  )

  const setWorkOrderStatusOnDb = useCallback(
    async (id: string, status: WorkOrder['status']) => {
      setWorkOrders((current) => current.map((w) => (w.id === id ? { ...w, status } : w)))
      try {
        await api.setWorkOrderStatus(id, status)
      } catch (error) {
        // Put it back. A job that still needs doing must not look finished.
        await loadFleetFromDb()
        throw error
      }
    },
    [loadFleetFromDb],
  )

  const resolveDefectOnDb = useCallback(
    async (defectId: string, outcome: 'resolved' | 'dismissed', correctiveAction: string) => {
      /*
       * Patched by defect id across both lists rather than by which inspection
       * it belongs to. A defect the driver raised on its own has no
       * inspection, so asking the caller which one to look in meant the
       * standalone list never updated.
       */
      setInspectionDefects((current) => {
        const next: Record<string, InspectionDefect[]> = {}
        for (const [key, list] of Object.entries(current)) {
          next[key] = list.map((d) => (d.id === defectId ? { ...d, status: outcome } : d))
        }
        return next
      })
      setReportedDefects((current) =>
        current.map((d) => (d.id === defectId ? { ...d, status: outcome } : d)),
      )
      try {
        await api.resolveDefect(defectId, outcome, correctiveAction)
        // The inspection's own status is derived from its defects, so it has
        // to be read back rather than patched here.
        await loadOperationsFromDb()
      } catch (error) {
        await loadOperationsFromDb()
        throw error
      }
    },
    [loadOperationsFromDb],
  )

  const dutySegmentsFor = useCallback(
    (driverId: string, date: Date): DutySegment[] =>
      dutySegments.get(driverId)?.get(isoDateKey(date)) ?? [],
    [dutySegments],
  )

  /**
   * The days that count toward the cycle total for one date, oldest first.
   *
   * The window length belongs to the rule book — 8 days under FMCSA, 7 under
   * the EU — so screens ask for it rather than assuming one.
   */
  const cycleWindowFor = useCallback(
    (driverId: string, date: Date): DutySegment[][] => {
      if (!regulator) return []
      const days = dutySegments.get(driverId)
      if (!days) return []
      return windowEndingOn(isoDateKey(date), cycleDaysFor(regulator)).map(
        (key) => days.get(key) ?? [],
      )
    },
    [dutySegments, regulator],
  )

  /*
   * Driving time left today, filled in from the rule engine.
   *
   * Derived here rather than in loadDrivers because it needs three things that
   * arrive separately: the roster, the duty events, and the organisation's
   * regulator. It stays null until all three are in — a dash means "not known",
   * and 11:00 for a driver whose events have not loaded would be a lie the
   * dispatcher would act on.
   */
  const driversWithHours = useMemo(() => {
    if (!regulator) return drivers
    const todayKey = isoDateKey(new Date())
    return drivers.map((driver) => {
      const today = dutySegments.get(driver.id)?.get(todayKey)
      // No events today is not eleven hours left. The driver may not have
      // signed on yet, and the dispatcher should see a dash and ask.
      if (!today || today.length === 0) return driver
      const left = drivingLeftToday(regulator, today)
      return left === null ? driver : { ...driver, hoursLeft: formatMinutes(left) }
    })
  }, [drivers, dutySegments, regulator])

  const value = useMemo<FleetDataValue>(
    () => ({
      drivers: driversWithHours,
      driversStatus,
      driversError,
      reloadDrivers: () => void loadDriversFromDb(),
      vehicles,
      workOrders,
      fleetStatus,
      fleetError,
      reloadFleet: () => void loadFleetFromDb(),
      roles,
      depots,
      staffStatus,
      staffError,
      reloadStaff: () => void loadStaffFromDb(),
      logs,
      unassigned,
      violationsEvaluated: regulator !== null,
      unassignedDetected: UNASSIGNED_DETECTED,
      inspections,
      inspectionDefects,
      reportedDefects,
      threads,
      messagesByThread,
      documents,
      scoreboard,
      opsStatus,
      opsError,
      reloadOps: () => void loadOperationsFromDb(),
      sendToDriver,
      broadcast,
      markThreadRead,
      dutySegmentsFor,
      cycleWindowFor,
      staff,
      routes,
      routeStops,
      forms,
      formFields,
      courses,
      safetyEvents,
      violations,
      editRequests,
      org,
      alertRules,
      audit,
      addDriver,
      saveDriver,
      addVehicle,
      saveVehicle,
      inviteUser,
      inviteDriver,
      addRoute,
      assignRoute,
      addForm,
      addCourse,
      setCourseContent,
      saveCourseDetails,
      resolveViolation,
      resolveEditRequest,
      setSafetyEventStatus,
      saveOrg,
      toggleAlertRule,
      addDepot,
      saveDepot,
      removeDepot,
      assignDriver,
      setFormPublished,
      setCoursePublished,
      assignCourse,
      unassignCourse,
      addWorkOrder,
      setWorkOrderStatus: setWorkOrderStatusOnDb,
      resolveDefect: resolveDefectOnDb,
    }),
    [
      driversWithHours, driversStatus, driversError, loadDriversFromDb,
      vehicles, workOrders, fleetStatus, fleetError, loadFleetFromDb,
      staff, roles, depots, staffStatus, staffError, loadStaffFromDb,
      logs, unassigned, inspections, inspectionDefects, reportedDefects, threads, messagesByThread,
      documents, scoreboard, opsStatus, opsError, loadOperationsFromDb,
      sendToDriver, broadcast, markThreadRead, dutySegmentsFor, cycleWindowFor,
      routes, routeStops, forms, formFields, courses,
      safetyEvents, violations, editRequests, org, alertRules, audit,
      addDriver, saveDriver, addVehicle, saveVehicle, inviteUser, inviteDriver, addRoute, assignRoute, addForm, addCourse, setCourseContent, saveCourseDetails,
      resolveViolation, resolveEditRequest, setSafetyEventStatus, saveOrg, toggleAlertRule,
      addDepot, saveDepot, removeDepot, assignDriver, assignCourse, unassignCourse,
      setFormPublished, setCoursePublished,
      addWorkOrder, setWorkOrderStatusOnDb, resolveDefectOnDb,
    ],
  )

  return <FleetDataContext.Provider value={value}>{children}</FleetDataContext.Provider>
}

export function useFleetData(): FleetDataValue {
  const ctx = useContext(FleetDataContext)
  if (!ctx) throw new Error('useFleetData must be used inside <FleetDataProvider>')
  return ctx
}
