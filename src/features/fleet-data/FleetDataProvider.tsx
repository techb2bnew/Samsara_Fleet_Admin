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
import { MOCK_FORMS, MOCK_ROUTES, type FormDef, type Route } from '../../mocks/operations'
import {
  MOCK_COURSES,
  MOCK_SAFETY_EVENTS,
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

type FleetDataValue = {
  drivers: Driver[]
  vehicles: Vehicle[]
  staff: StaffUser[]
  routes: Route[]
  forms: FormDef[]
  courses: Course[]
  safetyEvents: SafetyEvent[]
  violations: Violation[]
  editRequests: EditRequest[]

  addDriver: (input: NewDriver) => void
  addVehicle: (input: NewVehicle) => void
  inviteUser: (input: NewInvite) => void
  addRoute: (input: NewRoute) => void
  addForm: (input: NewForm) => void
  addCourse: (input: NewCourse) => void

  reviewViolation: (id: string) => void
  resolveEditRequest: (id: string, decision: 'approve' | 'reject') => void
  setSafetyEventStatus: (id: string, status: SafetyEvent['status']) => void
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

/** Initials from a display name: "Asha Patil" -> "AP". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase()
}

export function FleetDataProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS)
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES)
  const [staff, setStaff] = useState<StaffUser[]>(MOCK_STAFF)
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES)
  const [forms, setForms] = useState<FormDef[]>(MOCK_FORMS)
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>(MOCK_SAFETY_EVENTS)
  const [violations, setViolations] = useState<Violation[]>(MOCK_VIOLATIONS)
  const [editRequests, setEditRequests] = useState<EditRequest[]>(MOCK_EDIT_REQUESTS)

  // Ids only have to be unique within the session; the database will own them
  // for real.
  const nextId = useRef(1)
  const makeId = (prefix: string) => `${prefix}-new-${nextId.current++}`

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
    setRoutes((current) => [
      {
        id: makeId('r'),
        reference: `NL-${4500 + current.length}`,
        driver: input.driver,
        vehicle: input.vehicle,
        stopsDone: 0,
        stopsTotal: stops,
        status: 'planned',
        eta: input.startTime ? `Starts ${input.startTime}` : 'Not scheduled',
      },
      ...current,
    ])
  }, [])

  const addForm = useCallback((input: NewForm) => {
    setForms((current) => [
      {
        id: makeId('f'),
        name: input.name.trim(),
        fields: 0,
        version: 1,
        status: 'draft',
        assignedTo: input.assignedTo,
        submissions: 0,
        updated: 'Just now',
      },
      ...current,
    ])
  }, [])

  const addCourse = useCallback((input: NewCourse) => {
    setCourses((current) => [
      {
        id: makeId('c'),
        name: input.name.trim(),
        lengthMinutes: Number(input.lengthMinutes) || 10,
        assigned: 0,
        completed: 0,
        overdue: 0,
        status: 'draft',
      },
      ...current,
    ])
  }, [])

  const reviewViolation = useCallback((id: string) => {
    setViolations((current) =>
      current.map((v) => (v.id === id ? { ...v, status: 'reviewed' } : v)),
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

  const value = useMemo<FleetDataValue>(
    () => ({
      drivers,
      vehicles,
      staff,
      routes,
      forms,
      courses,
      safetyEvents,
      violations,
      editRequests,
      addDriver,
      addVehicle,
      inviteUser,
      addRoute,
      addForm,
      addCourse,
      reviewViolation,
      resolveEditRequest,
      setSafetyEventStatus,
    }),
    [
      drivers, vehicles, staff, routes, forms, courses, safetyEvents, violations, editRequests,
      addDriver, addVehicle, inviteUser, addRoute, addForm, addCourse,
      reviewViolation, resolveEditRequest, setSafetyEventStatus,
    ],
  )

  return <FleetDataContext.Provider value={value}>{children}</FleetDataContext.Provider>
}

export function useFleetData(): FleetDataValue {
  const ctx = useContext(FleetDataContext)
  if (!ctx) throw new Error('useFleetData must be used inside <FleetDataProvider>')
  return ctx
}
