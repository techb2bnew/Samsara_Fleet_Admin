/** Safety and coaching (A11), training (A12), reports (A14), audit (A15). */
import type { Tone } from '../constants'

export type SafetyEvent = {
  id: string
  driver: string
  initials: string
  kind: 'Harsh braking' | 'Speeding' | 'Harsh acceleration' | 'Sharp turn'
  severity: 'high' | 'medium' | 'low'
  location: string
  at: string
  status: 'new' | 'coachable' | 'dismissed'
}

export const MOCK_SAFETY_EVENTS: SafetyEvent[] = [
  { id: 's1', driver: 'Manoj Pawar', initials: 'MP', kind: 'Speeding', severity: 'high', location: 'NH-60 near Sinnar', at: 'Today, 08:22', status: 'new' },
  { id: 's2', driver: 'Ravi Deshmukh', initials: 'RD', kind: 'Harsh braking', severity: 'medium', location: 'Katraj bypass', at: 'Today, 07:55', status: 'new' },
  { id: 's3', driver: 'Dev Singh', initials: 'DS', kind: 'Sharp turn', severity: 'low', location: 'Hadapsar industrial', at: 'Yesterday', status: 'coachable' },
  { id: 's4', driver: 'Manoj Pawar', initials: 'MP', kind: 'Harsh acceleration', severity: 'medium', location: 'Nashik Rd', at: 'Yesterday', status: 'coachable' },
  { id: 's5', driver: 'Neha Joshi', initials: 'NJ', kind: 'Harsh braking', severity: 'low', location: 'Pune-Solapur Rd', at: '29 Aug', status: 'dismissed' },
]

export const SEVERITY_TONE: Record<SafetyEvent['severity'], Tone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

export const SAFETY_STATUS_LABEL: Record<SafetyEvent['status'], string> = {
  new: 'Needs review',
  coachable: 'Coaching assigned',
  dismissed: 'Dismissed',
}

export const MOCK_SCOREBOARD = [
  { rank: 1, driver: 'Lata Kulkarni', initials: 'LK', score: 96, change: 2 },
  { rank: 2, driver: 'Amit Verma', initials: 'AV', score: 94, change: 0 },
  { rank: 3, driver: 'Imran Shaikh', initials: 'IS', score: 91, change: -1 },
  { rank: 4, driver: 'Sunita Rao', initials: 'SR', score: 88, change: 3 },
  { rank: 5, driver: 'Neha Joshi', initials: 'NJ', score: 85, change: -2 },
]

/* ---------------------------------------------------------------- training */

export type Course = {
  id: string
  name: string
  lengthMinutes: number
  assigned: number
  completed: number
  overdue: number
  status: 'published' | 'draft'
  assignTo: string
}

export const MOCK_COURSES: Course[] = [
  { id: 'c1', name: 'Speed management on national highways', lengthMinutes: 18, assigned: 41, completed: 34, overdue: 3, status: 'published', assignTo: 'All drivers' },
  { id: 'c2', name: 'Pre-trip inspection walkthrough', lengthMinutes: 12, assigned: 41, completed: 41, overdue: 0, status: 'published', assignTo: 'All drivers' },
  { id: 'c3', name: 'Safe following distance', lengthMinutes: 9, assigned: 12, completed: 7, overdue: 2, status: 'published', assignTo: 'Pune depot' },
  { id: 'c4', name: 'Monsoon driving refresher', lengthMinutes: 22, assigned: 0, completed: 0, overdue: 0, status: 'draft', assignTo: 'Nobody yet' },
]

/* ----------------------------------------------------------------- reports */

export type Report = {
  id: string
  name: string
  description: string
  group: 'Fleet' | 'Compliance' | 'Safety' | 'Operations'
  lastRun: string
}

export const MOCK_REPORTS: Report[] = [
  { id: 'rep1', name: 'Driver utilisation', description: 'Hours worked against hours available, per driver.', group: 'Fleet', lastRun: 'Today' },
  { id: 'rep2', name: 'Vehicle utilisation', description: 'Distance and time in service, per vehicle.', group: 'Fleet', lastRun: 'Today' },
  { id: 'rep3', name: 'Idle time', description: 'Engine on, vehicle stationary, by depot.', group: 'Fleet', lastRun: 'Yesterday' },
  { id: 'rep4', name: 'Fuel and mileage', description: 'Consumption against distance, with outliers flagged.', group: 'Fleet', lastRun: '2 days ago' },
  { id: 'rep5', name: 'Working hours summary', description: 'Hours logged and remaining, per driver per week.', group: 'Compliance', lastRun: 'Today' },
  { id: 'rep6', name: 'Violation trends', description: 'Breaches by type over time.', group: 'Compliance', lastRun: 'Today' },
  { id: 'rep7', name: 'Defect trends', description: 'Faults found by vehicle area and severity.', group: 'Compliance', lastRun: 'Yesterday' },
  { id: 'rep8', name: 'Safety scores', description: 'Driver scores and movement over the period.', group: 'Safety', lastRun: 'Today' },
  { id: 'rep9', name: 'Training completion', description: 'Assigned, completed and overdue courses.', group: 'Safety', lastRun: '3 days ago' },
  { id: 'rep10', name: 'On-time delivery', description: 'Stops made inside their arrival window.', group: 'Operations', lastRun: 'Today' },
  { id: 'rep11', name: 'Document compliance', description: 'Paperwork captured against stops completed.', group: 'Operations', lastRun: 'Yesterday' },
]

/* ------------------------------------------------------------------- audit */

export type AuditEntry = {
  id: string
  who: string
  initials: string
  action: string
  target: string
  at: string
}

export const MOCK_AUDIT: AuditEntry[] = [
  { id: 'au1', who: 'Priya Sharma', initials: 'PS', action: 'Approved log edit', target: 'Ravi Deshmukh · 28 Aug', at: 'Today, 08:42' },
  { id: 'au2', who: 'Kabir Nair', initials: 'KN', action: 'Closed work order', target: 'WO-2291 · Truck 108', at: 'Today, 08:15' },
  { id: 'au3', who: 'Meera Iyer', initials: 'MI', action: 'Dispatched route', target: 'NL-4482 · Dev Singh', at: 'Today, 07:58' },
  { id: 'au4', who: 'Priya Sharma', initials: 'PS', action: 'Invited user', target: 'nikhil@northline.example · Dispatcher', at: 'Today, 07:10' },
  { id: 'au5', who: 'Farah Qureshi', initials: 'FQ', action: 'Exported audit pack', target: '8 drivers · 01–28 Aug', at: 'Yesterday, 16:30' },
  { id: 'au6', who: 'Priya Sharma', initials: 'PS', action: 'Changed alert rule', target: 'Speeding · notify safety manager', at: 'Yesterday, 11:02' },
]

export type AlertRule = {
  id: string
  name: string
  detail: string
  channels: string
  on: boolean
}

export const MOCK_ALERT_RULES: AlertRule[] = [
  { id: 'ar1', name: 'Hours violation', detail: 'Notify the compliance officer immediately', channels: 'Email, in-app', on: true },
  { id: 'ar2', name: 'Safety-critical defect', detail: 'Notify the fleet admin and the mechanic', channels: 'Email, in-app, SMS', on: true },
  { id: 'ar3', name: 'Licence expiring', detail: 'Warn 30 days before the expiry date', channels: 'Email', on: true },
  { id: 'ar4', name: 'Service overdue', detail: 'Notify the mechanic when a vehicle passes its interval', channels: 'In-app', on: true },
  { id: 'ar5', name: 'Speeding', detail: 'Notify the safety manager above 15 km/h over the limit', channels: 'In-app', on: false },
]

/* --------------------------------------------------------------- live map */

export type MapVehicle = {
  id: string
  name: string
  driver: string | null
  status: 'driving' | 'idle' | 'resting' | 'offline'
  speedKmh: number
  lastPing: string
  place: string
  /** Real coordinates, used by the Google map. */
  lat: number
  lng: number
  /** Position as a percentage of the panel, used by the schematic fallback. */
  x: number
  y: number
}

export const MOCK_MAP_VEHICLES: MapVehicle[] = [
  { id: 'm1', name: 'Truck 214', driver: 'Ravi Deshmukh', status: 'driving', speedKmh: 62, lastPing: '8 sec ago', place: 'NH-48, Khed Shivapur', lat: 18.3742, lng: 73.857, x: 34, y: 58 },
  { id: 'm2', name: 'Truck 187', driver: 'Amit Verma', status: 'driving', speedKmh: 48, lastPing: '12 sec ago', place: 'Hadapsar, Pune', lat: 18.5089, lng: 73.926, x: 58, y: 41 },
  { id: 'm3', name: 'Truck 133', driver: 'Sunita Rao', status: 'idle', speedKmh: 0, lastPing: '31 sec ago', place: 'Nashik depot yard', lat: 19.9975, lng: 73.7898, x: 47, y: 22 },
  { id: 'm4', name: 'Truck 202', driver: 'Dev Singh', status: 'resting', speedKmh: 0, lastPing: '2 min ago', place: 'Pune depot', lat: 18.488, lng: 73.87, x: 66, y: 63 },
  { id: 'm5', name: 'Truck 155', driver: 'Lata Kulkarni', status: 'driving', speedKmh: 71, lastPing: '5 sec ago', place: 'Pune-Solapur Rd', lat: 18.4529, lng: 74.021, x: 74, y: 76 },
  { id: 'm6', name: 'Truck 176', driver: 'Neha Joshi', status: 'driving', speedKmh: 54, lastPing: '9 sec ago', place: 'Chakan MIDC', lat: 18.7606, lng: 73.8636, x: 25, y: 33 },
  { id: 'm7', name: 'Truck 108', driver: null, status: 'offline', speedKmh: 0, lastPing: '4 hours ago', place: 'Nashik workshop', lat: 19.9615, lng: 73.76, x: 41, y: 15 },
]

export const MAP_STATUS_TONE: Record<MapVehicle['status'], Tone> = {
  driving: 'success',
  idle: 'warning',
  resting: 'accent',
  offline: 'danger',
}

export const MAP_STATUS_LABEL: Record<MapVehicle['status'], string> = {
  driving: 'Driving',
  idle: 'Idle',
  resting: 'Resting',
  offline: 'Offline',
}
