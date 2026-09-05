import type { Tone } from '../../constants'

/**
 * The working-hours screen's shapes.
 *
 * `DailyLog` holds a state per calendar date rather than a seven-day pattern:
 * a driver's Tuesday is not last Tuesday.
 */

export type LogState = 'certified' | 'uncertified' | 'violation' | 'missing' | 'off'

export type DailyLog = {
  driverId: string
  driver: string
  /** Keyed by ISO date, "2026-09-01". Absent means nothing was recorded. */
  states: Record<string, LogState>
}

/** One duty-status block on a 24-hour graph. Times are minutes from midnight. */
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

/**
 * A breach of the working-hours rules.
 *
 * Derived from duty events against the rule set in force, never stored — see
 * the hours_of_service migration. Until that rule engine exists this list is
 * empty on live data, which is the honest answer: nothing has been evaluated.
 */
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

/**
 * A driver's request to change a past log, or the office proposing one.
 *
 * These are real rows: duty events with edit_status = 'pending'. Approving one
 * does not rewrite the driver's log — it sends the change to their phone for
 * them to accept, because a carrier may not alter a driver's record.
 */
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

/** Driving recorded with nobody signed in. Needs telemetry to detect. */
export type UnassignedSegment = {
  id: string
  vehicle: string
  period: string
  distanceKm: number
}

export const LOG_STATE_TONE: Record<LogState, Tone | null> = {
  certified: 'success',
  uncertified: 'warning',
  violation: 'danger',
  missing: 'danger',
  off: null,
}

export const LOG_STATE_LABEL: Record<LogState, string> = {
  certified: 'Certified',
  uncertified: 'Not certified',
  violation: 'Violation',
  missing: 'Missing log',
  off: 'Off duty',
}

/** ISO date for a Date, in local time. Used as the key into DailyLog.states. */
export function isoDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Nothing recorded reads as off duty, which is what an empty day means. */
export function logStateOn(log: DailyLog, date: Date): LogState {
  return log.states[isoDateKey(date)] ?? 'off'
}
