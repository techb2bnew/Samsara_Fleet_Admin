import type { DutySegment, DutyStatus } from './types'
import { dutyTotals } from './dates'

/**
 * Working-hours arithmetic over recorded duty segments.
 *
 * Everything here counts what was actually recorded. Nothing works out what is
 * *left* — that needs a limit, the limit depends on the regulator, and that
 * lives in rules.ts. Keeping the two apart means these figures are true
 * whatever rule book applies.
 */

/** Driving and on-duty-not-driving both count against the on-duty clock. */
const ON_DUTY: DutyStatus[] = ['driving', 'on_duty']

/** Off duty and sleeper berth both count as rest. */
const RESTING: DutyStatus[] = ['off', 'sleeper']

export function onDutyMinutes(segments: DutySegment[]): number {
  const totals = dutyTotals(segments)
  return ON_DUTY.reduce((sum, status) => sum + totals[status], 0)
}

export function drivingMinutes(segments: DutySegment[]): number {
  return dutyTotals(segments).driving
}

/**
 * The longest unbroken rest in a day.
 *
 * Adjacent off-duty and sleeper blocks are one break: a driver who moves from
 * the cab to the bunk has not interrupted their rest, and counting that as two
 * shorter breaks is how a compliant 45-minute stop reads as two 20-minute ones.
 *
 * Segments are sorted first rather than trusted in order — they arrive from a
 * query, and one out-of-order row would silently split a break in half.
 */
export function longestBreakMinutes(segments: DutySegment[]): number {
  const ordered = [...segments].sort((a, b) => a.from - b.from)

  let longest = 0
  let run = 0
  let runEndsAt: number | null = null

  for (const segment of ordered) {
    const resting = RESTING.includes(segment.status)
    const length = Math.max(0, segment.to - segment.from)

    // Contiguous only. A gap between two rest blocks means something happened
    // in between that was not recorded, and joining them across it would
    // invent rest nobody took.
    if (resting && runEndsAt !== null && segment.from === runEndsAt) {
      run += length
    } else if (resting) {
      run = length
    } else {
      run = 0
    }

    runEndsAt = resting ? segment.to : null
    if (run > longest) longest = run
  }

  return longest
}

/**
 * On-duty minutes across a run of days, newest last.
 *
 * This is the "cycle" figure: FMCSA counts 60 hours over 7 days or 70 over 8,
 * and the EU counts 56 over a week. The window length is the caller's to
 * choose because it belongs to the rule book, not to the arithmetic.
 */
export function cycleMinutes(days: DutySegment[][]): number {
  return days.reduce((sum, segments) => sum + onDutyMinutes(segments), 0)
}

/**
 * "07:26" — the same figure with the hour padded to two digits.
 *
 * For the totals down the side of a log grid, where the figures form a column
 * and a one-digit hour left them ragged against the two-digit ones. Every ELD
 * screen and every paper log pads them for the same reason.
 */
export function formatClockPadded(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/** "7:26" — hours and minutes, the way a log book reads. */
export function formatClock(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * The four figures under the 24-hour graph.
 *
 * All four are measured, none is estimated. `cycleDays` decides how far back
 * the cycle total reaches; pass the days themselves so this does not need to
 * know how to fetch anything.
 */
export function dayRecap(
  today: DutySegment[],
  cycleWindow: DutySegment[][],
): { onDuty: string; driving: string; break: string; cycle: string } | null {
  // Nothing recorded is not a day of zeroes. A driver with no events either
  // was not working or their phone has not synced, and "0:00 driving" claims
  // to know which.
  if (today.length === 0) return null

  return {
    onDuty: formatClock(onDutyMinutes(today)),
    driving: formatClock(drivingMinutes(today)),
    break: formatClock(longestBreakMinutes(today)),
    cycle: formatClock(cycleMinutes(cycleWindow)),
  }
}
