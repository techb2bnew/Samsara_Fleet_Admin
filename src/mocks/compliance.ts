/** Working hours (A06) and vehicle inspections (A07). */
import type { Tone } from '../constants'

export type DailyLog = {
  driverId: string
  driver: string
  /** One entry per day, most recent last. */
  days: Array<'certified' | 'uncertified' | 'violation' | 'missing' | 'off'>
}

export const LOG_DATES = ['25 Aug', '26 Aug', '27 Aug', '28 Aug', '29 Aug', '30 Aug', '31 Aug']

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
  status: 'open' | 'reviewed'
}

export const MOCK_VIOLATIONS: Violation[] = [
  { id: 'x1', driver: 'Ravi Deshmukh', type: '11-hour driving limit', detail: 'Exceeded by 26 minutes on Truck 214', occurred: 'Today, 09:14', status: 'open' },
  { id: 'x2', driver: 'Lata Kulkarni', type: '30-minute break', detail: 'Drove 8h 40m without a qualifying break', occurred: 'Yesterday, 16:02', status: 'open' },
  { id: 'x3', driver: 'Ravi Deshmukh', type: '14-hour window', detail: 'Shift ran 14h 12m', occurred: '28 Aug, 21:40', status: 'open' },
  { id: 'x4', driver: 'Manoj Pawar', type: 'Form and manner', detail: 'Two days with no log submitted', occurred: '27 Aug', status: 'reviewed' },
]

export type EditRequest = {
  id: string
  driver: string
  requested: string
  reason: string
  date: string
}

export const MOCK_EDIT_REQUESTS: EditRequest[] = [
  { id: 'e1', driver: 'Amit Verma', requested: 'Change 14:10–15:00 from On duty to Off duty', reason: 'Waiting at the depot gate, not working', date: '30 Aug' },
  { id: 'e2', driver: 'Neha Joshi', requested: 'Add On duty 06:00–06:30', reason: 'Pre-trip inspection not recorded', date: '29 Aug' },
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
  { id: 'i1', vehicle: 'Truck 108', driver: 'Kabir Nair', type: 'Pre-trip', submitted: 'Today, 07:05', defects: 2, status: 'open_defect', worstDefect: 'Brakes — safety critical' },
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
