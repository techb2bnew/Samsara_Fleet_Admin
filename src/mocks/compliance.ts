/** Working hours (A06) and vehicle inspections (A07). */
import type { Tone } from '../constants'

export type LogState = 'certified' | 'uncertified' | 'violation' | 'missing' | 'off'

export type DailyLog = {
  driverId: string
  driver: string
  /** Seven-day pattern, cycled from 25 Aug 2026. */
  days: LogState[]
}

export type HoursPeriod = 'day' | 'week' | 'month'

export const MOCK_LOGS: DailyLog[] = [
  { driverId: 'd1', driver: 'Ravi Deshmukh', days: ['certified', 'certified', 'certified', 'violation', 'certified', 'uncertified', 'violation'] },
  { driverId: 'd2', driver: 'Amit Verma', days: ['certified', 'certified', 'off', 'certified', 'certified', 'certified', 'uncertified'] },
  { driverId: 'd3', driver: 'Sunita Rao', days: ['certified', 'off', 'certified', 'certified', 'certified', 'certified', 'uncertified'] },
  { driverId: 'd4', driver: 'Dev Singh', days: ['certified', 'certified', 'certified', 'certified', 'missing', 'certified', 'certified'] },
  { driverId: 'd5', driver: 'Imran Shaikh', days: ['off', 'off', 'certified', 'certified', 'certified', 'certified', 'off'] },
  { driverId: 'd6', driver: 'Lata Kulkarni', days: ['certified', 'certified', 'certified', 'certified', 'certified', 'violation', 'uncertified'] },
  { driverId: 'd7', driver: 'Manoj Pawar', days: ['certified', 'certified', 'missing', 'missing', 'off', 'off', 'off'] },
  { driverId: 'd8', driver: 'Neha Joshi', days: ['certified', 'certified', 'certified', 'off', 'certified', 'certified', 'uncertified'] },
]

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfWeekMonday(date: Date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function datesForPeriod(period: HoursPeriod, anchor = new Date()): Date[] {
  const anchor0 = startOfDay(anchor)
  if (period === 'day') return [anchor0]
  if (period === 'week') {
    const from = startOfWeekMonday(anchor0)
    return Array.from({ length: 7 }, (_, i) => {
      const next = new Date(from)
      next.setDate(from.getDate() + i)
      return next
    })
  }
  const year = anchor0.getFullYear()
  const month = anchor0.getMonth()
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1))
}

export function shiftAnchor(anchor: Date, period: HoursPeriod, step: -1 | 1) {
  const d = startOfDay(anchor)
  if (period === 'day') {
    d.setDate(d.getDate() + step)
    return d
  }
  if (period === 'week') {
    d.setDate(d.getDate() + step * 7)
    return d
  }
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + step)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return d
}

export function isCurrentPeriod(period: HoursPeriod, anchor: Date, today = new Date()) {
  const selected = datesForPeriod(period, anchor)
  const current = datesForPeriod(period, today)
  return (
    selected[0].getTime() === current[0].getTime() &&
    selected[selected.length - 1].getTime() === current[current.length - 1].getTime()
  )
}

export function toIsoDate(date: Date) {
  const d = startOfDay(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function fromIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return startOfDay(new Date(year, month - 1, day))
}

export function toIsoMonth(date: Date) {
  const d = startOfDay(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fromIsoMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return startOfDay(new Date(year, month - 1, 1))
}

const PATTERN_ORIGIN = startOfDay(new Date(2026, 7, 25))

export function logStateOn(log: DailyLog, date: Date): LogState {
  const diff = Math.round((startOfDay(date).getTime() - PATTERN_ORIGIN.getTime()) / 86_400_000)
  const i = ((diff % 7) + 7) % 7
  return log.days[i]
}

export function formatLogColumn(date: Date, period: HoursPeriod) {
  if (period === 'month') return String(date.getDate())
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** One duty-status block on a 24-hour ELD graph. Times are minutes from midnight. */
export type DutyStatus = 'off' | 'sleeper' | 'driving' | 'on_duty'

export type DutySegment = {
  status: DutyStatus
  from: number
  to: number
}

export type DutyClocks = {
  onDuty: string
  driving: string
  break: string
  cycle: string
}

export const DUTY_STATUSES: DutyStatus[] = ['off', 'sleeper', 'driving', 'on_duty']

function at(hours: number, minutes = 0) {
  return hours * 60 + minutes
}

const REST_DAY: DutySegment[] = [
  { status: 'off', from: 0, to: at(2) },
  { status: 'sleeper', from: at(2), to: at(10, 30) },
  { status: 'driving', from: at(10, 30), to: at(10, 42) },
  { status: 'on_duty', from: at(10, 42), to: at(11, 42) },
  { status: 'off', from: at(11, 42), to: 1440 },
]

const DRIVING_DAY: DutySegment[] = [
  { status: 'sleeper', from: 0, to: at(4) },
  { status: 'on_duty', from: at(4), to: at(4, 30) },
  { status: 'driving', from: at(4, 30), to: at(8, 30) },
  { status: 'on_duty', from: at(8, 30), to: at(9) },
  { status: 'driving', from: at(9), to: at(13) },
  { status: 'off', from: at(13), to: at(13, 30) },
  { status: 'driving', from: at(13, 30), to: at(18) },
  { status: 'on_duty', from: at(18), to: at(18, 40) },
  { status: 'sleeper', from: at(18, 40), to: 1440 },
]

const MIXED_DAY: DutySegment[] = [
  { status: 'off', from: 0, to: at(5) },
  { status: 'on_duty', from: at(5), to: at(5, 25) },
  { status: 'driving', from: at(5, 25), to: at(10) },
  { status: 'on_duty', from: at(10), to: at(10, 30) },
  { status: 'driving', from: at(10, 30), to: at(14) },
  { status: 'off', from: at(14), to: at(14, 30) },
  { status: 'driving', from: at(14, 30), to: at(17) },
  { status: 'on_duty', from: at(17), to: at(17, 20) },
  { status: 'off', from: at(17, 20), to: 1440 },
]

const YARD_DAY: DutySegment[] = [
  { status: 'off', from: 0, to: at(7, 30) },
  { status: 'on_duty', from: at(7, 30), to: at(9) },
  { status: 'off', from: at(9), to: at(16) },
  { status: 'on_duty', from: at(16), to: at(16, 45) },
  { status: 'off', from: at(16, 45), to: 1440 },
]

const TEMPLATES = [REST_DAY, DRIVING_DAY, MIXED_DAY, YARD_DAY]

/** Ravi’s long driving day is the one that matches the open 11-hour violation. */
const DRIVER_TEMPLATE: Record<string, number> = {
  d1: 1,
  d2: 2,
  d3: 0,
  d4: 2,
  d5: 3,
  d6: 1,
  d7: 3,
  d8: 2,
}

export function dutyLogFor(driverId: string, date: Date): DutySegment[] {
  const base = DRIVER_TEMPLATE[driverId] ?? Math.abs(driverId.charCodeAt(driverId.length - 1)) % TEMPLATES.length
  const shift = startOfDay(date).getDate() % TEMPLATES.length
  return TEMPLATES[(base + shift) % TEMPLATES.length]
}

export function dutyTotals(segments: DutySegment[]): Record<DutyStatus, number> {
  const totals: Record<DutyStatus, number> = { off: 0, sleeper: 0, driving: 0, on_duty: 0 }
  for (const segment of segments) totals[segment.status] += Math.max(0, segment.to - segment.from)
  return totals
}

export function formatDutyHours(minutes: number) {
  if (minutes <= 0) return '0.0'
  return (Math.round((minutes / 60) * 10) / 10).toFixed(1)
}

function padClock(value: string) {
  if (value === '—') return '11:00'
  const [hours, minutes] = value.split(':')
  return `${(hours ?? '0').padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`
}

export function dutyClocksFor(hoursLeft: string): DutyClocks {
  const depleted = hoursLeft === '0:00'
  return {
    onDuty: depleted ? '00:10' : '12:50',
    driving: padClock(hoursLeft),
    break: depleted ? '00:00' : '07:50',
    cycle: depleted ? '02:20' : '68:50',
  }
}

export function formatPeriodLabel(period: HoursPeriod, dates: Date[]) {
  if (dates.length === 0) return ''
  if (period === 'day') {
    return dates[0].toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  }
  if (period === 'week') {
    const from = dates[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    const to = dates[dates.length - 1].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return `${from} – ${to}`
  }
  return dates[0].toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export const LOG_STATE_TONE: Record<DailyLog['days'][number], Tone | null> = {
  certified: 'success',
  uncertified: 'warning',
  violation: 'danger',
  missing: 'danger',
  off: null,
}

export const LOG_STATE_LABEL: Record<DailyLog['days'][number], string> = {
  certified: 'Certified',
  uncertified: 'Not certified',
  violation: 'Violation',
  missing: 'Missing log',
  off: 'Off duty',
}

export type Violation = {
  id: string
  driver: string
  type: string
  detail: string
  occurred: string
  status: 'open' | 'reviewed' | 'dismissed'
  vehicle: string
  logDate: string
  limit: string
  actual: string
  overage: string | null
  location: string
}

export const MOCK_VIOLATIONS: Violation[] = [
  {
    id: 'x1',
    driver: 'Ravi Deshmukh',
    type: '11-hour driving limit',
    detail: 'Exceeded by 26 minutes on Truck 214',
    occurred: 'Today, 09:14',
    status: 'open',
    vehicle: 'Truck 214',
    logDate: '1 Sep 2026',
    limit: '11 hours driving',
    actual: '11 hours 26 minutes driving',
    overage: '26 minutes',
    location: 'NH-48, approaching Pune',
  },
  {
    id: 'x2',
    driver: 'Lata Kulkarni',
    type: '30-minute break',
    detail: 'Drove 8h 40m without a qualifying break',
    occurred: 'Yesterday, 16:02',
    status: 'open',
    vehicle: 'Truck 155',
    logDate: '31 Aug 2026',
    limit: '30-minute break after 8 hours driving',
    actual: '8 hours 40 minutes driving with no qualifying break',
    overage: '40 minutes past the break window',
    location: 'Mumbai–Nashik highway',
  },
  {
    id: 'x3',
    driver: 'Ravi Deshmukh',
    type: '14-hour window',
    detail: 'Shift ran 14h 12m',
    occurred: '28 Aug, 21:40',
    status: 'open',
    vehicle: 'Truck 214',
    logDate: '28 Aug 2026',
    limit: '14-hour on-duty window',
    actual: '14 hours 12 minutes on duty',
    overage: '12 minutes',
    location: 'Pune depot inbound',
  },
  {
    id: 'x4',
    driver: 'Manoj Pawar',
    type: 'Form and manner',
    detail: 'Two days with no log submitted',
    occurred: '27 Aug',
    status: 'reviewed',
    vehicle: 'Truck 202',
    logDate: '26–27 Aug 2026',
    limit: 'A certified log for every working day',
    actual: 'No log submitted for two days',
    overage: null,
    location: 'Unknown — no ELD event',
  },
]

export type EditRequest = {
  id: string
  driver: string
  requested: string
  reason: string
  date: string
  vehicle: string
  logDate: string
  kind: 'change' | 'add'
  fromStatus: string
  toStatus: string
  timeFrom: string
  timeTo: string
}

export const MOCK_EDIT_REQUESTS: EditRequest[] = [
  {
    id: 'e1',
    driver: 'Amit Verma',
    requested: 'Change 14:10–15:00 from On duty to Off duty',
    reason: 'Waiting at the depot gate, not working',
    date: '30 Aug',
    vehicle: 'Truck 187',
    logDate: '30 Aug 2026',
    kind: 'change',
    fromStatus: 'On duty',
    toStatus: 'Off duty',
    timeFrom: '14:10',
    timeTo: '15:00',
  },
  {
    id: 'e2',
    driver: 'Neha Joshi',
    requested: 'Add On duty 06:00–06:30',
    reason: 'Pre-trip inspection not recorded',
    date: '29 Aug',
    vehicle: 'Truck 108',
    logDate: '29 Aug 2026',
    kind: 'add',
    fromStatus: 'Not logged',
    toStatus: 'On duty',
    timeFrom: '06:00',
    timeTo: '06:30',
  },
]

export const MOCK_UNASSIGNED = [
  { id: 'ua1', vehicle: 'Truck 155', period: '30 Aug, 05:12 – 05:48', distanceKm: 31 },
  { id: 'ua2', vehicle: 'Truck 202', period: '29 Aug, 22:03 – 22:19', distanceKm: 9 },
]

/* -------------------------------------------------------------- inspections */

export type Inspection = {
  id: string
  vehicle: string
  driver: string
  type: 'Pre-trip' | 'Post-trip'
  submitted: string
  defects: number
  status: 'pending' | 'open_defect' | 'resolved'
  worstDefect: string | null
}

export const MOCK_INSPECTIONS: Inspection[] = [
  { id: 'i1', vehicle: 'Truck 108', driver: 'Manoj Pawar', type: 'Pre-trip', submitted: 'Today, 07:05', defects: 2, status: 'open_defect', worstDefect: 'Brakes — safety critical' },
  { id: 'i2', vehicle: 'Truck 133', driver: 'Sunita Rao', type: 'Pre-trip', submitted: 'Today, 06:41', defects: 1, status: 'open_defect', worstDefect: 'Rear left tyre worn' },
  { id: 'i3', vehicle: 'Truck 214', driver: 'Ravi Deshmukh', type: 'Pre-trip', submitted: 'Today, 06:18', defects: 0, status: 'pending', worstDefect: null },
  { id: 'i4', vehicle: 'Truck 187', driver: 'Amit Verma', type: 'Post-trip', submitted: 'Yesterday, 19:30', defects: 0, status: 'resolved', worstDefect: null },
  { id: 'i5', vehicle: 'Truck 202', driver: 'Dev Singh', type: 'Post-trip', submitted: 'Yesterday, 18:55', defects: 1, status: 'resolved', worstDefect: 'Wiper blade replaced' },
]

export const INSPECTION_TONE: Record<Inspection['status'], Tone> = {
  pending: 'accent',
  open_defect: 'danger',
  resolved: 'success',
}

export const INSPECTION_LABEL: Record<Inspection['status'], string> = {
  pending: 'Awaiting review',
  open_defect: 'Open defect',
  resolved: 'Resolved',
}

export type InspectionDefect = {
  id: string
  area: string
  finding: string
  severity: 'critical' | 'major' | 'minor'
  status: 'open' | 'resolved'
}

export const DEFECT_TONE: Record<InspectionDefect['severity'], Tone> = {
  critical: 'danger',
  major: 'warning',
  minor: 'neutral',
}

export const MOCK_INSPECTION_DEFECTS: Record<string, InspectionDefect[]> = {
  i1: [
    { id: 'id1', area: 'Brakes', finding: 'Front axle pads below the legal minimum', severity: 'critical', status: 'open' },
    { id: 'id2', area: 'Lights', finding: 'Left indicator intermittent', severity: 'minor', status: 'open' },
  ],
  i2: [
    { id: 'id3', area: 'Tyres', finding: 'Rear left tyre worn to the wear bars', severity: 'major', status: 'open' },
  ],
  i5: [
    { id: 'id4', area: 'Wipers', finding: 'Driver-side blade replaced', severity: 'minor', status: 'resolved' },
  ],
}
