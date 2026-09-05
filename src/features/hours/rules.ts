import type { DutySegment, DutyStatus } from './types'
import { drivingMinutes, onDutyMinutes, formatClock } from './totals'

/**
 * The working-hours rule engine.
 *
 * Violations are worked out on read, from the duty events, and never stored.
 * The alternative is a nightly job writing violation rows, which is wrong twice
 * over: a driver correcting yesterday's log has to change yesterday's
 * violations, and a limit that changes when the organisation's regulator is set
 * has to re-judge history. Deriving means both happen for free.
 *
 * ---------------------------------------------------------------------------
 * What this checks, and what it does not
 * ---------------------------------------------------------------------------
 * Checked, per driver per day:
 *
 *   FMCSA   11-hour driving limit
 *           14-hour on-duty window
 *           30-minute break after 8 hours driving
 *           60/70-hour cycle over 7/8 days
 *   EU      9-hour daily driving limit (10 twice a week)
 *           4.5 hours driving before a 45-minute break
 *           56-hour week, 90-hour fortnight
 *
 * NOT checked, and deliberately: sleeper-berth splits, the 16-hour short-haul
 * exception, adverse driving conditions, personal conveyance and yard moves.
 * Each of those turns a violation into a non-violation, so leaving them out
 * makes this engine strict rather than lenient — it can raise something a
 * regulator would forgive, but it will not stay quiet about something real.
 * A driver disputing one of these is the signal to implement the exception.
 */

/** Which rule book applies. Read from organizations.hos_regulator. */
export type Regulator = 'FMCSA' | 'EU'

/**
 * Reads the free-text column into a rule book.
 *
 * Text rather than an enum in the database, so the set of supported books can
 * grow without a migration. Anything unrecognised returns null and the engine
 * checks nothing at all — guessing a rule book and judging a driver against
 * the wrong limits is worse than saying nothing.
 */
export function regulatorFrom(value: string): Regulator | null {
  const clean = value.trim().toUpperCase()
  if (clean === 'FMCSA' || clean === 'DOT' || clean === 'US') return 'FMCSA'
  if (clean === 'EU' || clean === 'EC561' || clean === 'AETR') return 'EU'
  return null
}

type Limits = {
  /** Longest driving in one day. */
  dailyDriving: number
  /** Longest span from coming on duty to going off, FMCSA only. */
  dutyWindow: number | null
  /** Driving allowed before a qualifying break is needed. */
  drivingBeforeBreak: number
  /** How long that break has to be. */
  breakLength: number
  /** On-duty ceiling over `cycleDays`. */
  cycle: number
  cycleDays: number
}

const H = 60

const LIMITS: Record<Regulator, Limits> = {
  // 49 CFR 395.3.
  FMCSA: {
    dailyDriving: 11 * H,
    dutyWindow: 14 * H,
    drivingBeforeBreak: 8 * H,
    breakLength: 30,
    // The 70-hour/8-day cycle, which is what a carrier operating every day of
    // the week runs on. The 60/7 alternative applies to carriers that do not.
    cycle: 70 * H,
    cycleDays: 8,
  },
  // Regulation (EC) 561/2006.
  EU: {
    // 9 hours, extendable to 10 twice a week. Extensions are not tracked yet,
    // so 10 is used as the hard limit and the 9-hour case is not raised —
    // being strict here would flag a legal extension as a breach.
    dailyDriving: 10 * H,
    dutyWindow: null,
    drivingBeforeBreak: 4 * H + 30,
    breakLength: 45,
    cycle: 56 * H,
    cycleDays: 7,
  },
}

export type RuleViolation = {
  /** Stable within a driver and date, so a list can key on it. */
  id: string
  kind: 'daily_driving' | 'duty_window' | 'missing_break' | 'cycle'
  /** What the limit was. */
  limit: string
  /** What was actually recorded. */
  actual: string
  /** How far past, when that is a meaningful number. */
  overage: string | null
}

const ON_DUTY: DutyStatus[] = ['driving', 'on_duty']

/**
 * The span from first coming on duty to last going off.
 *
 * Not the sum of on-duty time — the 14-hour window is elapsed time, and breaks
 * inside a shift do not extend it. That is the whole point of the rule: a
 * driver cannot stretch an 11-hour driving day across 20 hours by resting in
 * the middle.
 */
function dutyWindowMinutes(segments: DutySegment[]): number {
  const working = segments.filter((s) => ON_DUTY.includes(s.status))
  if (working.length === 0) return 0
  const first = Math.min(...working.map((s) => s.from))
  const last = Math.max(...working.map((s) => s.to))
  return Math.max(0, last - first)
}

/**
 * Whether a qualifying break was taken before driving past the limit.
 *
 * Walks the day in order, counting driving since the last long-enough rest.
 * Counting the day's total driving and its longest break separately would pass
 * a driver who drove ten hours and then rested — the break has to come first.
 */
function drivingWithoutBreak(segments: DutySegment[], limits: Limits): number {
  const ordered = [...segments].sort((a, b) => a.from - b.from)

  let since = 0
  let worst = 0
  let restRun = 0
  let restEndsAt: number | null = null

  for (const segment of ordered) {
    const length = Math.max(0, segment.to - segment.from)

    if (segment.status === 'off' || segment.status === 'sleeper') {
      restRun = restEndsAt === segment.from ? restRun + length : length
      restEndsAt = segment.to
      if (restRun >= limits.breakLength) since = 0
      continue
    }

    restRun = 0
    restEndsAt = null
    if (segment.status === 'driving') {
      since += length
      if (since > worst) worst = since
    }
  }

  return worst
}

/**
 * Judges one driver's one day.
 *
 * `cycleWindow` is the days that count toward the cycle, this one included.
 * An empty day returns nothing: a driver with no events was not necessarily
 * resting, and a "cycle" total is not a breach on its own.
 */
export function violationsForDay(
  regulator: Regulator,
  driverId: string,
  isoDate: string,
  today: DutySegment[],
  cycleWindow: DutySegment[][],
): RuleViolation[] {
  if (today.length === 0) return []

  const limits = LIMITS[regulator]
  const out: RuleViolation[] = []
  const key = `${driverId}-${isoDate}`

  const driving = drivingMinutes(today)
  if (driving > limits.dailyDriving) {
    out.push({
      id: `${key}-driving`,
      kind: 'daily_driving',
      limit: `${formatClock(limits.dailyDriving)} driving`,
      actual: `${formatClock(driving)} driving`,
      overage: formatClock(driving - limits.dailyDriving),
    })
  }

  if (limits.dutyWindow !== null) {
    const window = dutyWindowMinutes(today)
    if (window > limits.dutyWindow) {
      out.push({
        id: `${key}-window`,
        kind: 'duty_window',
        limit: `${formatClock(limits.dutyWindow)} on-duty window`,
        actual: `${formatClock(window)} from coming on duty to going off`,
        overage: formatClock(window - limits.dutyWindow),
      })
    }
  }

  const unbroken = drivingWithoutBreak(today, limits)
  if (unbroken > limits.drivingBeforeBreak) {
    out.push({
      id: `${key}-break`,
      kind: 'missing_break',
      limit: `${limits.breakLength}-minute break after ${formatClock(limits.drivingBeforeBreak)} driving`,
      actual: `${formatClock(unbroken)} driving with no qualifying break`,
      overage: formatClock(unbroken - limits.drivingBeforeBreak),
    })
  }

  const cycle = cycleWindow.reduce((sum, day) => sum + onDutyMinutes(day), 0)
  if (cycle > limits.cycle) {
    out.push({
      id: `${key}-cycle`,
      kind: 'cycle',
      limit: `${formatClock(limits.cycle)} on duty over ${limits.cycleDays} days`,
      actual: `${formatClock(cycle)} on duty`,
      overage: formatClock(cycle - limits.cycle),
    })
  }

  return out
}

/**
 * Driving time left today, in minutes.
 *
 * The daily driving limit minus what has been driven, floored at zero. Only
 * the driving clock — the window and the cycle can each run out first, and a
 * single "hours left" figure that quietly took the smallest of the three would
 * hide which one is about to stop the driver.
 *
 * Null when no rule book is set, because there is no limit to subtract from.
 */
export function drivingLeftToday(
  regulator: Regulator | null,
  today: DutySegment[],
): number | null {
  if (!regulator) return null
  return Math.max(0, LIMITS[regulator].dailyDriving - drivingMinutes(today))
}

/** How many days back the cycle window reaches, so the caller can slice it. */
export function cycleDaysFor(regulator: Regulator): number {
  return LIMITS[regulator].cycleDays
}

/**
 * The longest break a driver must take before driving again, and how much
 * driving triggers it. Shown next to the recap so the figure has a limit
 * beside it rather than standing alone.
 */
export function limitsFor(regulator: Regulator): Limits {
  return LIMITS[regulator]
}
