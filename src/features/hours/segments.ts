import type { DutyEventRow } from '../../supabase/api'
import { isoDateKey, type DutySegment, type DutyStatus } from './types'

/**
 * Duty events into 24-hour graph segments.
 *
 * The database stores only when each status *started*, because a status runs
 * until the next event — storing an end time as well would mean two rows to
 * keep in step and a way for them to disagree.
 *
 * Personal conveyance and yard move both draw as on duty. They are separate
 * statuses in the schema because the rules treat them differently, and the
 * graph has four rows.
 */
const GRAPH_STATUS: Record<string, DutyStatus> = {
  off_duty: 'off',
  sleeper_berth: 'sleeper',
  driving: 'driving',
  on_duty_not_driving: 'on_duty',
  personal_conveyance: 'on_duty',
  yard_move: 'on_duty',
}

const MINUTES_IN_DAY = 24 * 60

function minutesInto(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Every driver's every day, keyed by driver id then ISO date.
 *
 * Built once per load rather than per screen. The graph, the recap and the
 * rule engine all need the same shape, and three different walks over the same
 * events is three chances for them to disagree about what a day contained.
 *
 * `now` is passed in rather than read here so the same events always produce
 * the same segments — a function that consults the clock cannot be tested.
 */
export function segmentsByDriverDate(
  events: DutyEventRow[],
  now: Date,
): Map<string, Map<string, DutySegment[]>> {
  const byDriver = new Map<string, Map<string, DutyEventRow[]>>()

  for (const event of events) {
    // A proposed correction is not part of the day until it is accepted.
    if (event.editOfId) continue
    const date = isoDateKey(new Date(event.startedAt))
    const days = byDriver.get(event.driverId) ?? new Map<string, DutyEventRow[]>()
    days.set(date, [...(days.get(date) ?? []), event])
    byDriver.set(event.driverId, days)
  }

  const todayKey = isoDateKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const out = new Map<string, Map<string, DutySegment[]>>()
  for (const [driverId, days] of byDriver) {
    const built = new Map<string, DutySegment[]>()
    for (const [date, rows] of days) {
      const ordered = [...rows].sort((a, b) => a.startedAt.localeCompare(b.startedAt))

      /*
       * The last block of the day runs to midnight, or to now if the day is
       * still going. A driver who is on duty right now has not finished being
       * on duty, and drawing their block to midnight would credit them with
       * hours they have not worked yet — which matters, because the rule
       * engine reads these.
       */
      const endOfDay = date === todayKey ? nowMinutes : MINUTES_IN_DAY

      built.set(
        date,
        ordered.map((event, i) => ({
          status: GRAPH_STATUS[event.status] ?? 'on_duty',
          from: minutesInto(event.startedAt),
          to: i + 1 < ordered.length ? minutesInto(ordered[i + 1].startedAt) : endOfDay,
        })),
      )
    }
    out.set(driverId, built)
  }

  return out
}

/**
 * The calendar day before `date`.
 *
 * Built from a Date rather than by subtracting from the string, so month ends
 * and leap days are the calendar's problem and not this file's.
 */
export function dayBefore(date: string): string {
  const day = new Date(`${date}T00:00:00`)
  day.setDate(day.getDate() - 1)
  return isoDateKey(day)
}

/** The ISO dates ending at `date`, `days` long, oldest first. */
export function windowEndingOn(date: string, days: number): string[] {
  const end = new Date(`${date}T00:00:00`)
  const out: string[] = []
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(end)
    day.setDate(end.getDate() - back)
    out.push(isoDateKey(day))
  }
  return out
}
