import type { Tone } from '../../constants'

/**
 * What the dashboard shows.
 *
 * The Supabase snapshot is mapped into these shapes, so the page renders tiles
 * and alerts without knowing what was queried to produce them.
 */

export type Kpi = {
  id: string
  label: string
  value: number
  /** Shown under the number — context, not decoration. */
  detail: string
  /** Present only when the number is something to act on. */
  tone?: Tone
  href: string
}

export type Alert = {
  id: string
  tone: Tone
  title: string
  detail: string
  /** Relative time, already formatted for display. */
  at: string
  href: string
}

export type ActivityItem = {
  id: string
  who: string
  initials: string
  what: string
  at: string
  href: string
}

export type DashboardData = {
  kpis: Kpi[]
  alerts: Alert[]
  activity: ActivityItem[]
}
