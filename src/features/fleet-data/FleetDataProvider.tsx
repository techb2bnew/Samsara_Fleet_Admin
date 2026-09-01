import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MOCK_DRIVERS, MOCK_STAFF, type Driver, type StaffUser } from '../../mocks/people'
import { MOCK_VEHICLES, type Vehicle } from '../../mocks/vehicles'
import {
  DEFAULT_NEW_FORM_FIELDS,
  MOCK_FORM_FIELDS,
  MOCK_FORMS,
  MOCK_ROUTE_STOPS,
  MOCK_ROUTES,
  stopsForNewRoute,
  type FormDef,
  type FormField,
  type Route,
  type RouteStop,
} from '../../mocks/operations'
import {
  MOCK_ALERT_RULES,
  MOCK_AUDIT,
  MOCK_COURSES,
  MOCK_SAFETY_EVENTS,
  type AlertRule,
  type AuditEntry,
  type Course,
  type SafetyEvent,
} from '../../mocks/admin'
import { MOCK_EDIT_REQUESTS, MOCK_VIOLATIONS, type EditRequest, type Violation } from '../../mocks/compliance'

/**
 * Every list the console can change, in one place.
 *
 * The mock files hold the starting data; this holds the working copy. Adding a
 * driver has to make that driver appear in the table, or the form is a picture
 * of a form — so the lists live in state rather than being imported directly by
 * each screen.
 *
 * When this is wired to Supabase each function below becomes a mutation and the
 * lists become queries. No screen changes, because no screen imports the mocks.
 */

export type OrgSettings = {
  name: string
  country: string
  timezone: string
  regulator: string
}

type FleetDataValue = {
  drivers: Driver[]
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

  addDriver: (input: NewDriver) => void
  addVehicle: (input: NewVehicle) => void
  inviteUser: (input: NewInvite) => void
  addRoute: (input: NewRoute) => Route
  addForm: (input: NewForm) => void
  addCourse: (input: NewCourse) => void

  resolveViolation: (id: string, decision: 'approve' | 'reject') => void
  resolveEditRequest: (id: string, decision: 'approve' | 'reject') => void
  setSafetyEventStatus: (id: string, status: SafetyEvent['status']) => void
  saveOrg: (next: OrgSettings) => void
  toggleAlertRule: (id: string) => void
}

export type NewDriver = {
  firstName: string
  lastName: string
  employeeNumber: string
  terminal: string
  email: string
  phone: string
  licenceExpires: string
}

export type NewVehicle = {
  name: string
  plate: string
  makeModel: string
  year: string
  terminal: string
  odometerKm: string
}

export type NewInvite = { name: string; email: string; role: string; fleet: string }
export type NewRoute = { driver: string; vehicle: string; stops: string; startTime: string; notes: string }
export type NewForm = { name: string; assignedTo: string }
export type NewCourse = { name: string; lengthMinutes: string; assignTo: string }

const FleetDataContext = createContext<FleetDataValue | null>(null)

const INITIAL_ORG: OrgSettings = {
  name: 'Northline Haulage',
  country: 'India',
  timezone: 'Asia/Kolkata',
  regulator: '—',
}

/** Initials from a display name: "Asha Patil" -> "AP". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase()
}

function assignedCount(assignTo: string, drivers: Driver[]) {
  if (assignTo === 'Nobody yet' || assignTo === 'Not assigned') return 0
  if (assignTo === 'All drivers') return drivers.length
  return drivers.filter((driver) => driver.terminal === assignTo).length
}

function seedStops(routes: Route[]): Record<string, RouteStop[]> {
  const out: Record<string, RouteStop[]> = { ...MOCK_ROUTE_STOPS }
  for (const route of routes) {
    if (!out[route.id]) out[route.id] = stopsForNewRoute(route.id, route.stopsTotal)
  }
  return out
}

export function FleetDataProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS)
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES)
  const [staff, setStaff] = useState<StaffUser[]>(MOCK_STAFF)
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES)
  const [routeStops, setRouteStops] = useState<Record<string, RouteStop[]>>(() => seedStops(MOCK_ROUTES))
  const [forms, setForms] = useState<FormDef[]>(MOCK_FORMS)
  const [formFields, setFormFields] = useState<Record<string, FormField[]>>(MOCK_FORM_FIELDS)
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>(MOCK_SAFETY_EVENTS)
  const [violations, setViolations] = useState<Violation[]>(MOCK_VIOLATIONS)
  const [editRequests, setEditRequests] = useState<EditRequest[]>(MOCK_EDIT_REQUESTS)
  const [org, setOrg] = useState<OrgSettings>(INITIAL_ORG)
  const [alertRules, setAlertRules] = useState<AlertRule[]>(MOCK_ALERT_RULES)
  const [audit, setAudit] = useState<AuditEntry[]>(MOCK_AUDIT)

  // Ids only have to be unique within the session; the database will own them
  // for real.
  const nextId = useRef(1)
  const makeId = (prefix: string) => `${prefix}-new-${nextId.current++}`

  const recordAudit = useCallback((action: string, target: string) => {
    const entry: AuditEntry = {
      id: makeId('au'),
      who: 'Demo',
      initials: 'DE',
      action,
      target,
      at: 'Just now',
    }
    setAudit((current) => [entry, ...current])
  }, [])

  const addDriver = useCallback((input: NewDriver) => {
    const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()
    setDrivers((current) => [
      {
        id: makeId('d'),
        name,
        initials: initialsOf(name),
        employeeNumber: input.employeeNumber.trim() || '—',
        terminal: input.terminal,
        // A new driver has not started a shift, so they are off duty with a
        // full clock rather than defaulting to "driving".
        status: 'off_duty',
        vehicle: null,
        hoursLeft: '11:00',
        licenceExpires: input.licenceExpires || '—',
        licenceWarning: false,
        safetyScore: 100,
      },
      ...current,
    ])
  }, [])

  const addVehicle = useCallback((input: NewVehicle) => {
    const odometer = Number(input.odometerKm) || 0
    setVehicles((current) => [
      {
        id: makeId('v'),
        name: input.name.trim(),
        plate: input.plate.trim().toUpperCase(),
        makeModel: input.makeModel.trim() || '—',
        year: Number(input.year) || new Date().getFullYear(),
        status: 'active',
        driver: null,
        odometerKm: odometer,
        nextServiceKm: odometer + 20_000,
        serviceOverdueKm: 0,
      },
      ...current,
    ])
  }, [])

  const inviteUser = useCallback((input: NewInvite) => {
    setStaff((current) => [
      {
        id: makeId('u'),
        name: input.name.trim(),
        initials: initialsOf(input.name),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        fleet: input.fleet,
        status: 'invited',
        lastActive: 'Never signed in',
      },
      ...current,
    ])
  }, [])

  const addRoute = useCallback((input: NewRoute) => {
    const stops = Math.max(1, Number(input.stops) || 1)
    const id = makeId('r')
    let created!: Route
    setRoutes((current) => {
      created = {
        id,
        reference: `NL-${4500 + current.length}`,
        driver: input.driver,
        vehicle: input.vehicle,
        stopsDone: 0,
        stopsTotal: stops,
        status: 'planned',
        eta: input.startTime ? `Starts ${input.startTime}` : 'Not scheduled',
      }
      return [created, ...current]
    })
    setRouteStops((current) => ({ ...current, [id]: stopsForNewRoute(id, stops) }))
    return created
  }, [])

  const addForm = useCallback((input: NewForm) => {
    const id = makeId('f')
    const fields: FormField[] = DEFAULT_NEW_FORM_FIELDS.map((field, index) => ({
      ...field,
      id: `${id}-ff-${index + 1}`,
    }))
    setForms((current) => [
      {
        id,
        name: input.name.trim(),
        fields: fields.length,
        version: 1,
        status: 'draft',
        assignedTo: input.assignedTo,
        submissions: 0,
        updated: 'Just now',
      },
      ...current,
    ])
    setFormFields((current) => ({ ...current, [id]: fields }))
  }, [])

  const addCourse = useCallback(
    (input: NewCourse) => {
      setCourses((current) => [
        {
          id: makeId('c'),
          name: input.name.trim(),
          lengthMinutes: Number(input.lengthMinutes) || 10,
          assigned: assignedCount(input.assignTo, drivers),
          completed: 0,
          overdue: 0,
          status: 'draft',
          assignTo: input.assignTo,
        },
        ...current,
      ])
    },
    [drivers],
  )

  const resolveViolation = useCallback((id: string, decision: 'approve' | 'reject') => {
    setViolations((current) =>
      current.map((v) =>
        v.id === id ? { ...v, status: decision === 'approve' ? 'reviewed' : 'dismissed' } : v,
      ),
    )
  }, [])

  const resolveEditRequest = useCallback((id: string, _decision: 'approve' | 'reject') => {
    // Either decision removes it from the queue. The real version records which
    // it was, and pushes an approval to the driver's phone for acceptance.
    setEditRequests((current) => current.filter((e) => e.id !== id))
  }, [])

  const setSafetyEventStatus = useCallback((id: string, status: SafetyEvent['status']) => {
    setSafetyEvents((current) => current.map((e) => (e.id === id ? { ...e, status } : e)))
  }, [])

  const saveOrg = useCallback(
    (next: OrgSettings) => {
      setOrg(next)
      recordAudit('Updated organisation', next.name)
    },
    [recordAudit],
  )

  const toggleAlertRule = useCallback(
    (id: string) => {
      let name = ''
      let turningOn = false
      setAlertRules((current) =>
        current.map((rule) => {
          if (rule.id !== id) return rule
          name = rule.name
          turningOn = !rule.on
          return { ...rule, on: turningOn }
        }),
      )
      if (name) recordAudit(turningOn ? 'Turned on alert' : 'Turned off alert', name)
    },
    [recordAudit],
  )

  const value = useMemo<FleetDataValue>(
    () => ({
      drivers,
      vehicles,
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
      addVehicle,
      inviteUser,
      addRoute,
      addForm,
      addCourse,
      resolveViolation,
      resolveEditRequest,
      setSafetyEventStatus,
      saveOrg,
      toggleAlertRule,
    }),
    [
      drivers, vehicles, staff, routes, routeStops, forms, formFields, courses,
      safetyEvents, violations, editRequests, org, alertRules, audit,
      addDriver, addVehicle, inviteUser, addRoute, addForm, addCourse,
      resolveViolation, resolveEditRequest, setSafetyEventStatus, saveOrg, toggleAlertRule,
    ],
  )

  return <FleetDataContext.Provider value={value}>{children}</FleetDataContext.Provider>
}

export function useFleetData(): FleetDataValue {
  const ctx = useContext(FleetDataContext)
  if (!ctx) throw new Error('useFleetData must be used inside <FleetDataProvider>')
  return ctx
}
