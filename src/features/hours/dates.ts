/**
 * Dates and duty-graph arithmetic for the working-hours screens.
 *
 * Pure functions: they take a date or a list of segments and give an answer.
 * Nothing here invents data.
 */

import type { DutySegment, DutyStatus } from './types'

export type HoursPeriod = 'day' | 'week' | 'month'

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

/** Monday of the week a date falls in. Weeks run Monday to Sunday here. */
function startOfWeekMonday(date: Date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
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

export function formatLogColumn(date: Date, period: HoursPeriod) {
  if (period === 'month') return String(date.getDate())
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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

/** One duty-status block on a 24-hour ELD graph. Times are minutes from midnight. */
export const DUTY_STATUSES: DutyStatus[] = ['off', 'sleeper', 'driving', 'on_duty']

export function dutyTotals(segments: DutySegment[]): Record<DutyStatus, number> {
  const totals: Record<DutyStatus, number> = { off: 0, sleeper: 0, driving: 0, on_duty: 0 }
  for (const segment of segments) totals[segment.status] += Math.max(0, segment.to - segment.from)
  return totals
}

/*
 * formatDutyHours is gone.
 *
 * It rendered minutes as decimal hours — "9.5", and "0.1" for six minutes —
 * and the log grid was the only thing that called it. A duty log is kept in
 * hours and minutes, on paper and on every ELD screen, and an inspector
 * reading "0.1" has to convert it before it means anything. formatClock, used
 * everywhere else in this console, gives "9:28".
 */
