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

/*
 * The shape the whole engine works in.
 *
 * Public because a rule book no longer has to be one of the two named below:
 * a fleet can write its own, and what reaches these functions is the resolved
 * set of numbers rather than the name of a regime. Everything downstream then
 * behaves identically whether the limits came from 49 CFR or from a form
 * somebody filled in.
 */
export type Limits = {
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
  /*
   * Consecutive minutes off duty required before driving again. Null where the
   * rule book has no such rule.
   *
   * CONSECUTIVE is the rule, not a detail of it: five hours off, work, five
   * more is not a rest under any regime, and adding the two together would
   * report a driver as compliant when they are not.
   */
  dailyRest: number | null
  /*
   * The three below are a FLEET'S OWN POLICY, not law. Null on both built-in
   * regimes, because neither FMCSA nor EU 561/2006 contains any of them — see
   * the migration that added the columns.
   */
  /** Work required before a break may be taken. */
  minWorkBeforeBreak: number | null
  /** Longest single break, not counting a daily rest. */
  maxBreak: number | null
  /** Longest on-duty-not-driving time in a day. */
  maxOnDuty: number | null
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
    // 395.3(a)(1).
    dailyRest: 10 * H,
    // Not in 49 CFR 395. A fleet that wants these sets its own rule book.
    minWorkBeforeBreak: null,
    maxBreak: null,
    maxOnDuty: null,
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
    // Article 8. Reducible to 9 hours three times a week, which is not
    // tracked — so 9 is used, because flagging a legal reduction as a breach
    // would be worse than missing one short rest.
    dailyRest: 9 * H,
    // Not in 561/2006, as above.
    minWorkBeforeBreak: null,
    maxBreak: null,
    maxOnDuty: null,
  },
}

export type RuleViolation = {
  /** Stable within a driver and date, so a list can key on it. */
  id: string
  kind:
    | 'daily_driving'
    | 'duty_window'
    | 'missing_break'
    | 'cycle'
    | 'daily_rest'
    /* The three below come from a fleet's own rule book, not from a regulation. */
    | 'break_too_early'
    | 'break_too_long'
    | 'on_duty_too_long'
  /** What the limit was. */
  limit: string
  /** What was actually recorded. */
  actual: string
  /** How far past, when that is a meaningful number. */
  overage: string | null
}

const ON_DUTY: DutyStatus[] = ['driving', 'on_duty']

/** A day, in minutes. Yesterday's segments are measured back from this. */
const DAY_MINUTES = 24 * 60

/**
 * How long a rest has to be before it counts as ending the shift rather than
 * interrupting it, when the rule book does not say.
 *
 * This distinction is the whole reason a break cap can exist at all. A fleet
 * that caps breaks at three hours does not mean its drivers may not sleep for
 * ten — it means they may not sit for four in the middle of a shift. Without
 * telling the two apart, "max break 3h" would flag every night's rest, which
 * is the contradiction that made this rule look impossible.
 *
 * Eight hours, used only when daily_rest_minutes is unset. No regime's daily
 * rest is shorter: the EU's reduced rest is nine and FMCSA's is ten, and the
 * shortest sleeper-berth period either recognises is seven.
 */
const REST_ENDS_SHIFT = 8 * 60

/** Rest long enough to be the day's rest rather than a break. */
function restFloor(limits: Limits): number {
  return limits.dailyRest ?? REST_ENDS_SHIFT
}

/**
 * Every rest block in the day, with the work that came immediately before it.
 *
 * Contiguous blocks of the same kind are joined: a driver who taps Off duty
 * and then Sleeper has taken one rest, not two, and counting them separately
 * would report both as too short.
 */
function restsWithPrecedingWork(
  today: DutySegment[],
): Array<{ rest: number; workBefore: number; at: number }> {
  const ordered = [...today].sort((a, b) => a.from - b.from)
  const out: Array<{ rest: number; workBefore: number; at: number }> = []

  let work = 0
  let rest = 0
  let restStart = 0

  const flush = () => {
    if (rest > 0) out.push({ rest, workBefore: work, at: restStart })
    /* Work resets after a rest: the next break has to be earned again. */
    if (rest > 0) work = 0
    rest = 0
  }

  for (const seg of ordered) {
    const length = Math.max(0, seg.to - seg.from)
    if (ON_DUTY.includes(seg.status)) {
      flush()
      work += length
    } else {
      if (rest === 0) restStart = seg.from
      rest += length
    }
  }
  flush()

  return out
}

/**
 * Consecutive minutes off duty immediately before the driver started work.
 *
 * ---------------------------------------------------------------------------
 * Why it reaches into yesterday
 * ---------------------------------------------------------------------------
 * A night's sleep crosses midnight, which is the normal case rather than an
 * edge one. Segments are stored per calendar day, so a rest from 21:00 to
 * 07:00 is two segments in two days — and a check that only looked at today
 * would see seven hours where there were ten, and report a violation against
 * a driver who slept properly.
 *
 * So the run is walked backwards from the first working segment of today, and
 * when it reaches midnight it continues into the end of yesterday.
 *
 * Returns null when the driver did no work at all: there was nothing to be
 * rested for, and a day off is not a breach.
 */
function restBeforeWork(today: DutySegment[], yesterday: DutySegment[]): number | null {
  const ordered = [...today].sort((a, b) => a.from - b.from)
  const firstWork = ordered.find((seg) => ON_DUTY.includes(seg.status))
  if (!firstWork) return null

  let rest = 0
  let edge = firstWork.from

  /* Backwards through today, only while each block touches the one after it. */
  for (const seg of [...ordered].reverse()) {
    if (seg.to !== edge) continue
    if (ON_DUTY.includes(seg.status)) break
    rest += seg.to - seg.from
    edge = seg.from
  }

  /*
   * Only continue into yesterday if the run actually reached midnight.
   * Stopping short means the driver was working at midnight, and yesterday's
   * rest belongs to yesterday's shift, not to this one.
   */
  if (edge !== 0) return rest

  let yEdge = DAY_MINUTES
  for (const seg of [...yesterday].sort((a, b) => a.from - b.from).reverse()) {
    if (seg.to !== yEdge) break
    if (ON_DUTY.includes(seg.status)) break
    rest += seg.to - seg.from
    yEdge = seg.from
  }

  return rest
}

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
  limits: Limits,
  driverId: string,
  isoDate: string,
  today: DutySegment[],
  cycleWindow: DutySegment[][],
  /*
   * The day before, for the daily-rest check. Required rather than optional:
   * an optional argument a caller forgets is a legal check that silently
   * stops running, which is worse than one that was never written.
   *
   * Pass [] for the oldest day loaded — the rest before it cannot be known,
   * and the check is skipped rather than guessed.
   */
  yesterday: DutySegment[],
): RuleViolation[] {
  if (today.length === 0) return []

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

  /*
   * Daily rest. Skipped when yesterday was not loaded, because a rest that
   * began in a day nobody fetched would look like no rest at all.
   */
  if (limits.dailyRest !== null && yesterday.length > 0) {
    const rested = restBeforeWork(today, yesterday)
    if (rested !== null && rested < limits.dailyRest) {
      out.push({
        id: `${key}-rest`,
        kind: 'daily_rest',
        limit: `${formatClock(limits.dailyRest)} off duty before driving`,
        actual: `${formatClock(rested)} off duty before coming on`,
        overage: formatClock(limits.dailyRest - rested),
      })
    }
  }

  /*
   * A fleet's own shift rules. All three are skipped unless the rule book sets
   * them, which the two legal regimes never do.
   *
   * The day's rest is exempt from both break rules. A ten-hour sleep is not a
   * four-hour break that went on too long, and it is not a break taken before
   * the driver had earned one — it is the end of the shift.
   */
  if (limits.minWorkBeforeBreak !== null || limits.maxBreak !== null) {
    const floor = restFloor(limits)

    for (const block of restsWithPrecedingWork(today)) {
      if (block.rest >= floor) continue

      if (
        limits.minWorkBeforeBreak !== null &&
        block.workBefore > 0 &&
        block.workBefore < limits.minWorkBeforeBreak
      ) {
        out.push({
          id: `${key}-early-${block.at}`,
          kind: 'break_too_early',
          limit: `${formatClock(limits.minWorkBeforeBreak)} of work before a break`,
          actual: `${formatClock(block.workBefore)} of work before stopping`,
          overage: formatClock(limits.minWorkBeforeBreak - block.workBefore),
        })
      }

      if (limits.maxBreak !== null && block.rest > limits.maxBreak) {
        out.push({
          id: `${key}-long-${block.at}`,
          kind: 'break_too_long',
          limit: `${formatClock(limits.maxBreak)} break`,
          actual: `${formatClock(block.rest)} break`,
          overage: formatClock(block.rest - limits.maxBreak),
        })
      }
    }
  }

  if (limits.maxOnDuty !== null) {
    /* Loading and unloading, without the driving. */
    const working = today
      .filter((seg) => seg.status === 'on_duty')
      .reduce((sum, seg) => sum + Math.max(0, seg.to - seg.from), 0)

    if (working > limits.maxOnDuty) {
      out.push({
        id: `${key}-onduty`,
        kind: 'on_duty_too_long',
        limit: `${formatClock(limits.maxOnDuty)} on duty, not driving`,
        actual: `${formatClock(working)} on duty, not driving`,
        overage: formatClock(working - limits.maxOnDuty),
      })
    }
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
  limits: Limits | null,
  today: DutySegment[],
): number | null {
  if (!limits) return null
  return Math.max(0, limits.dailyDriving - drivingMinutes(today))
}

/**
 * The longest break a driver must take before driving again, and how much
 * driving triggers it. Shown next to the recap so the figure has a limit
 * beside it rather than standing alone.
 */
export function limitsFor(regulator: Regulator): Limits {
  return LIMITS[regulator]
}

/**
 * A fleet's own rule book, as stored.
 *
 * Separate from limitsFor rather than folded into it: the built-ins are
 * checked against the regulations they cite, and these numbers are whatever
 * somebody typed. Keeping the two apart means it is always clear at the call
 * site which kind is in hand.
 */
export type RuleBookRow = {
  daily_driving_minutes: number
  duty_window_minutes: number | null
  driving_before_break_minutes: number
  break_length_minutes: number
  cycle_minutes: number
  cycle_days: number
  daily_rest_minutes: number | null
  min_work_before_break_minutes: number | null
  max_break_minutes: number | null
  max_on_duty_minutes: number | null
}

export function limitsFromRuleBook(row: RuleBookRow): Limits {
  return {
    dailyDriving: row.daily_driving_minutes,
    dutyWindow: row.duty_window_minutes,
    drivingBeforeBreak: row.driving_before_break_minutes,
    breakLength: row.break_length_minutes,
    cycle: row.cycle_minutes,
    cycleDays: row.cycle_days,
    dailyRest: row.daily_rest_minutes,
    minWorkBeforeBreak: row.min_work_before_break_minutes,
    maxBreak: row.max_break_minutes,
    maxOnDuty: row.max_on_duty_minutes,
  }
}


export type Recap = {
  /** Minutes left, or null when the clock does not apply or is not known. */
  onDuty: number | null
  driving: number | null
  /** Driving left before a break is required. */
  breakIn: number | null
  cycle: number | null
  /*
   * Rest the driver still owes today, when the rule book requires any.
   *
   * Every clock here is "what is left", and rest is no exception: two hours
   * slept out of ten leaves eight to take. Shown the other way round — filling
   * up — one clock on the strip would read backwards from the rest.
   */
  restOwed: number | null
  /** On-duty-not-driving allowance left, on a rule book that caps it. */
  loadLeft: number | null
  /*
   * How far PAST each limit, where it is exceeded.
   *
   * The figures above are floored at zero so nobody reads a negative clock,
   * and flooring threw the overage away — a clock that had run out drew an
   * empty ring with nothing to say how far past it went. Zero where the limit
   * holds, null where there is no such limit.
   */
  over: {
    onDuty: number | null
    driving: number | null
    breakIn: number | null
    cycle: number | null
    restOwed: number | null
    loadLeft: number | null
  }
}

/**
 * What a driver has LEFT, as opposed to what they have used.
 *
 * dayRecap in totals.ts answers the other question — hours worked — and both
 * are worth showing: the office reconciling a timesheet wants the total, and
 * the office deciding whether to send one more load wants what is left.
 *
 * A deliberate mirror of recapFor in the driver app's hosLimits. The two have
 * to agree to the minute, because a dispatcher and a driver arguing about
 * whether there is time for another drop are reading the same four numbers off
 * two screens.
 *
 * `cycleWindow` is the days counting toward the cycle, this one included.
 */
export function recapFor(
  limits: Limits | null,
  today: DutySegment[],
  cycleWindow: DutySegment[][],
): Recap {
  const nothing = {
    onDuty: null,
    driving: null,
    breakIn: null,
    cycle: null,
    restOwed: null,
    loadLeft: null,
  }

  if (!limits) return { ...nothing, over: nothing }

  const left = (limit: number, used: number) => Math.max(0, limit - used)
  const past = (limit: number, used: number) => Math.max(0, used - limit)

  const rested = today
    .filter((s) => s.status === 'off' || s.status === 'sleeper')
    .reduce((sum, s) => sum + Math.max(0, s.to - s.from), 0)

  const loaded = today
    .filter((s) => s.status === 'on_duty')
    .reduce((sum, s) => sum + Math.max(0, s.to - s.from), 0)

  /* Measured once, so left and over can never disagree about the same day. */
  const usedWindow = dutyWindowMinutes(today)
  const usedDriving = drivingMinutes(today)
  const usedSinceBreak = drivingWithoutBreak(today, limits)
  const usedCycle = cycleWindow.reduce((sum, day) => sum + onDutyMinutes(day), 0)

  return {
    onDuty: limits.dutyWindow === null ? null : left(limits.dutyWindow, usedWindow),
    driving: left(limits.dailyDriving, usedDriving),
    breakIn: left(limits.drivingBeforeBreak, usedSinceBreak),
    cycle: left(limits.cycle, usedCycle),
    /*
     * Total rest in the day, not the consecutive run the violation check uses.
     * The two answer different questions: the check asks whether the driver
     * was fit to start, this asks how much of the day's rest is still to come.
     */
    restOwed: limits.dailyRest === null ? null : left(limits.dailyRest, rested),
    loadLeft: limits.maxOnDuty === null ? null : left(limits.maxOnDuty, loaded),
    over: {
      onDuty: limits.dutyWindow === null ? null : past(limits.dutyWindow, usedWindow),
      driving: past(limits.dailyDriving, usedDriving),
      breakIn: past(limits.drivingBeforeBreak, usedSinceBreak),
      cycle: past(limits.cycle, usedCycle),
      /* Rest is a requirement, not an allowance: there is no overrunning it. */
      restOwed: limits.dailyRest === null ? null : 0,
      loadLeft: limits.maxOnDuty === null ? null : past(limits.maxOnDuty, loaded),
    },
  }
}
