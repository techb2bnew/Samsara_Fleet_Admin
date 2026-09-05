/**
 * The working-hours rule engine.
 *
 * Pure functions over duty segments — no network, no database. These are the
 * calculations a compliance officer acts on and a driver can be stood down
 * over, so the cases below are the ones that are easy to get subtly wrong:
 * a limit hit exactly, a break taken after the driving rather than before,
 * rest split across two statuses, and a day with nothing recorded.
 */

import { describe, expect, it } from 'vitest'
import type { DutySegment } from '../src/features/hours/types'
import {
  cycleDaysFor,
  regulatorFrom,
  violationsForDay,
} from '../src/features/hours/rules'
import {
  drivingMinutes,
  longestBreakMinutes,
  onDutyMinutes,
  dayRecap,
  formatClock,
} from '../src/features/hours/totals'

/** Minutes from midnight, so the fixtures read like a log book. */
const at = (h: number, m = 0) => h * 60 + m

const seg = (status: DutySegment['status'], from: number, to: number): DutySegment => ({
  status,
  from,
  to,
})

/** No cycle pressure, so a day's own rules are the only thing under test. */
const noCycle = (day: DutySegment[]) => [day]

const kinds = (day: DutySegment[], cycle = noCycle(day), regulator: 'FMCSA' | 'EU' = 'FMCSA') =>
  violationsForDay(regulator, 'd1', '2026-09-02', day, cycle).map((v) => v.kind)

describe('regulatorFrom', () => {
  it('reads the rule books it supports, however they are written', () => {
    expect(regulatorFrom('FMCSA')).toBe('FMCSA')
    expect(regulatorFrom('  fmcsa ')).toBe('FMCSA')
    expect(regulatorFrom('DOT')).toBe('FMCSA')
    expect(regulatorFrom('EU')).toBe('EU')
    expect(regulatorFrom('ec561')).toBe('EU')
  })

  it('returns null for anything it does not know', () => {
    // Deliberate: guessing a rule book means judging a driver against limits
    // nobody chose. The screen says "not checked" instead.
    expect(regulatorFrom('')).toBeNull()
    expect(regulatorFrom('India')).toBeNull()
    expect(regulatorFrom('FMSCA')).toBeNull()
  })
})

describe('totals', () => {
  it('counts driving and on duty separately, and both against on duty', () => {
    const day = [
      seg('on_duty', at(6), at(6, 30)),
      seg('driving', at(6, 30), at(10)),
      seg('off', at(10), at(10, 45)),
      seg('driving', at(10, 45), at(13)),
    ]
    expect(drivingMinutes(day)).toBe(at(3, 30) + at(2, 15))
    expect(onDutyMinutes(day)).toBe(at(3, 30) + at(2, 15) + 30)
  })

  it('treats adjacent off duty and sleeper as one break', () => {
    // A driver who moves from the cab to the bunk has not interrupted their
    // rest. Counting two blocks would turn a legal 45 minutes into 20 and 25.
    const day = [
      seg('driving', at(6), at(10)),
      seg('off', at(10), at(10, 20)),
      seg('sleeper', at(10, 20), at(10, 45)),
      seg('driving', at(10, 45), at(14)),
    ]
    expect(longestBreakMinutes(day)).toBe(45)
  })

  it('does not join rest blocks with a gap between them', () => {
    // Something happened in the gap that was not recorded. Joining across it
    // would invent rest nobody took.
    const day = [
      seg('off', at(10), at(10, 20)),
      seg('off', at(11), at(11, 25)),
    ]
    expect(longestBreakMinutes(day)).toBe(25)
  })

  it('sorts before walking, so one out-of-order row cannot split a break', () => {
    const day = [
      seg('sleeper', at(10, 20), at(10, 45)),
      seg('driving', at(6), at(10)),
      seg('off', at(10), at(10, 20)),
    ]
    expect(longestBreakMinutes(day)).toBe(45)
  })

  it('formats as a log book reads', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(446)).toBe('7:26')
    expect(formatClock(at(11) + 26)).toBe('11:26')
  })

  it('gives no recap for a day with nothing recorded', () => {
    // Not a day of zeroes. Either the driver was not working or their phone
    // has not synced, and "0:00 driving" claims to know which.
    expect(dayRecap([], [])).toBeNull()
  })

  it('reports hours used, not hours left', () => {
    const day = [seg('driving', at(6), at(9)), seg('off', at(9), at(10))]
    expect(dayRecap(day, [day])).toEqual({
      onDuty: '3:00',
      driving: '3:00',
      break: '1:00',
      cycle: '3:00',
    })
  })
})

describe('FMCSA: 11-hour driving limit', () => {
  it('allows exactly eleven hours', () => {
    // A limit hit exactly is not a breach. Using >= here is the classic
    // off-by-one that writes up a driver who stopped on time.
    const day = [
      seg('driving', at(0), at(4)),
      seg('off', at(4), at(4, 30)),
      seg('driving', at(4, 30), at(11, 30)),
    ]
    expect(drivingMinutes(day)).toBe(at(11))
    expect(kinds(day)).not.toContain('daily_driving')
  })

  it('raises it past eleven, with the overage', () => {
    const day = [
      seg('driving', at(0), at(4)),
      seg('off', at(4), at(4, 30)),
      seg('driving', at(4, 30), at(11, 56)),
    ]
    const found = violationsForDay('FMCSA', 'd1', '2026-09-02', day, noCycle(day))
    const breach = found.find((v) => v.kind === 'daily_driving')
    expect(breach).toBeDefined()
    expect(breach!.actual).toBe('11:26 driving')
    expect(breach!.overage).toBe('0:26')
  })
})

describe('FMCSA: 14-hour on-duty window', () => {
  it('measures elapsed time, so a break in the middle does not extend it', () => {
    // The whole point of the rule: a driver cannot stretch a legal driving day
    // across twenty hours by resting in between.
    const day = [
      seg('on_duty', at(5), at(6)),
      seg('off', at(6), at(14)),
      seg('driving', at(14), at(19, 30)),
    ]
    expect(onDutyMinutes(day)).toBe(at(6, 30))
    expect(kinds(day)).toContain('duty_window')
  })

  it('allows a shift that fits inside the window', () => {
    const day = [
      seg('on_duty', at(5), at(5, 30)),
      seg('driving', at(5, 30), at(11)),
      seg('off', at(11), at(12)),
      seg('driving', at(12), at(18)),
    ]
    expect(kinds(day)).not.toContain('duty_window')
  })

  it('is not checked under EU rules, which have no equivalent', () => {
    const day = [
      seg('on_duty', at(5), at(6)),
      seg('off', at(6), at(14)),
      seg('driving', at(14), at(18)),
    ]
    expect(kinds(day, noCycle(day), 'EU')).not.toContain('duty_window')
  })
})

describe('FMCSA: 30-minute break', () => {
  it('is satisfied by a break taken before the eighth hour', () => {
    const day = [
      seg('driving', at(6), at(11)),
      seg('off', at(11), at(11, 35)),
      seg('driving', at(11, 35), at(16)),
    ]
    expect(drivingMinutes(day)).toBe(at(9, 25))
    expect(kinds(day)).not.toContain('missing_break')
  })

  it('is not satisfied by a break taken afterwards', () => {
    /*
     * The case a naive check gets wrong: total driving is nine hours and the
     * longest break is forty minutes, so counting the two separately passes.
     * The break has to come first, and this driver drove nine hours straight.
     */
    const day = [
      seg('driving', at(6), at(15)),
      seg('off', at(15), at(15, 40)),
    ]
    expect(longestBreakMinutes(day)).toBe(40)
    expect(kinds(day)).toContain('missing_break')
  })

  it('does not count a rest that is too short', () => {
    const day = [
      seg('driving', at(6), at(10)),
      seg('off', at(10), at(10, 20)),
      seg('driving', at(10, 20), at(15)),
    ]
    expect(kinds(day)).toContain('missing_break')
  })

  it('resets the count, so two legal stints are fine', () => {
    const day = [
      seg('driving', at(0), at(7)),
      seg('off', at(7), at(7, 45)),
      seg('driving', at(7, 45), at(14)),
    ]
    expect(kinds(day)).not.toContain('missing_break')
  })
})

describe('EU: 4.5 hours before a 45-minute break', () => {
  it('allows four and a half hours', () => {
    const day = [seg('driving', at(6), at(10, 30))]
    expect(kinds(day, noCycle(day), 'EU')).not.toContain('missing_break')
  })

  it('raises five hours with no break', () => {
    const day = [seg('driving', at(6), at(11))]
    expect(kinds(day, noCycle(day), 'EU')).toContain('missing_break')
  })

  it('does not accept a 30-minute break, which is enough under FMCSA', () => {
    const day = [
      seg('driving', at(6), at(10, 15)),
      seg('off', at(10, 15), at(10, 45)),
      seg('driving', at(10, 45), at(14)),
    ]
    expect(kinds(day, noCycle(day), 'FMCSA')).not.toContain('missing_break')
    expect(kinds(day, noCycle(day), 'EU')).toContain('missing_break')
  })
})

describe('EU: daily driving limit', () => {
  it('allows ten hours, because nine is extendable twice a week', () => {
    // Being strict here would flag a legal extension as a breach. Until
    // extensions are tracked, ten is the hard limit.
    const day = [
      seg('driving', at(0), at(4, 30)),
      seg('off', at(4, 30), at(5, 30)),
      seg('driving', at(5, 30), at(11)),
    ]
    expect(drivingMinutes(day)).toBe(at(10))
    expect(kinds(day, noCycle(day), 'EU')).not.toContain('daily_driving')
  })

  it('raises past ten', () => {
    const day = [
      seg('driving', at(0), at(4, 30)),
      seg('off', at(4, 30), at(5, 30)),
      seg('driving', at(5, 30), at(11, 30)),
    ]
    expect(kinds(day, noCycle(day), 'EU')).toContain('daily_driving')
  })
})

describe('the cycle', () => {
  it('counts on-duty hours across the whole window, not just today', () => {
    // Eight days of nine on-duty hours is 72, past the 70-hour ceiling —
    // while no single day breaks any daily rule.
    const oneDay = [seg('on_duty', at(6), at(7)), seg('driving', at(7), at(15))]
    const window = Array.from({ length: 8 }, () => oneDay)
    expect(kinds(oneDay, window)).toContain('cycle')
    expect(kinds(oneDay, window)).not.toContain('daily_driving')
  })

  it('stays inside the ceiling when the window is short enough', () => {
    const oneDay = [seg('driving', at(7), at(15))]
    expect(kinds(oneDay, Array.from({ length: 8 }, () => oneDay))).not.toContain('cycle')
  })

  it('uses each rule book’s own window', () => {
    expect(cycleDaysFor('FMCSA')).toBe(8)
    expect(cycleDaysFor('EU')).toBe(7)
  })

  it('applies the EU weekly ceiling of 56 hours', () => {
    // Seven days of nine on-duty hours is 63, past 56 but inside FMCSA's 70.
    const oneDay = [seg('on_duty', at(6), at(7)), seg('driving', at(7), at(15))]
    const week = Array.from({ length: 7 }, () => oneDay)
    expect(kinds(oneDay, week, 'EU')).toContain('cycle')
    expect(kinds(oneDay, week, 'FMCSA')).not.toContain('cycle')
  })
})

describe('a day with nothing recorded', () => {
  it('raises nothing at all', () => {
    /*
     * A driver with no events was not necessarily resting — their phone may
     * not have synced. Reporting a clean day would claim to know that, and
     * reporting a breach would be worse. The missing certification shows up on
     * the log grid instead, which is where it belongs.
     */
    expect(violationsForDay('FMCSA', 'd1', '2026-09-02', [], [[]])).toEqual([])
    expect(violationsForDay('EU', 'd1', '2026-09-02', [], [[]])).toEqual([])
  })

  it('raises nothing even when the cycle window is full', () => {
    const busy = [seg('driving', at(0), at(12))]
    const window = Array.from({ length: 8 }, () => busy)
    expect(violationsForDay('FMCSA', 'd1', '2026-09-02', [], window)).toEqual([])
  })
})

describe('violation identity', () => {
  it('is stable for the same driver, day and rule', () => {
    // Screens key lists on this. An id that changed between reads would make
    // React discard and rebuild every row on every refresh.
    const day = [seg('driving', at(0), at(13))]
    const first = violationsForDay('FMCSA', 'd1', '2026-09-02', day, noCycle(day))
    const second = violationsForDay('FMCSA', 'd1', '2026-09-02', day, noCycle(day))
    expect(first.map((v) => v.id)).toEqual(second.map((v) => v.id))
    expect(new Set(first.map((v) => v.id)).size).toBe(first.length)
  })

  it('differs between drivers and between days', () => {
    const day = [seg('driving', at(0), at(13))]
    const a = violationsForDay('FMCSA', 'd1', '2026-09-02', day, noCycle(day))[0]
    const b = violationsForDay('FMCSA', 'd2', '2026-09-02', day, noCycle(day))[0]
    const c = violationsForDay('FMCSA', 'd1', '2026-09-03', day, noCycle(day))[0]
    expect(a.id).not.toBe(b.id)
    expect(a.id).not.toBe(c.id)
  })
})
