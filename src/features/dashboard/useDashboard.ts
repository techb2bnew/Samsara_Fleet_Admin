import { useCallback, useEffect, useState } from 'react'
import { USE_MOCK_DATA } from '../../config'
import * as api from '../../supabase/api'
import { STRINGS } from '../../constants'
import { MOCK_ACTIVITY, MOCK_ALERTS, MOCK_KPIS } from '../../mocks/fleet'
import { useAuth } from '../auth/AuthProvider'
import type { ActivityItem, Alert, DashboardData, Kpi } from './types'

/**
 * Where the dashboard gets its numbers.
 *
 * USE_MOCK_DATA decides: on, the invented figures the console was designed
 * against; off, live counts from Supabase. The page itself renders whatever
 * comes back and never knows which ran.
 *
 * ---------------------------------------------------------------------------
 * What live data can and cannot answer yet
 * ---------------------------------------------------------------------------
 * The mock dashboard shows six figures. Only some of them have a table behind
 * them today, so the live dashboard shows what the schema can actually prove
 * and leaves the rest out rather than printing a zero that looks like good news:
 *
 *   drivers on duty       needs duty_status_events   (hours-of-service)
 *   vehicles moving       needs vehicle positions    (telemetry)
 *   hours violations      needs duty_status_events
 *   unassigned driving    needs duty_status_events
 *   stops completed       needs routes and stops     (dispatch)
 *   recent activity       needs an audit trail
 *
 * As each of those lands, add its query to api.loadDashboard and its tile here.
 */

const t = STRINGS.dashboard

type State =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: DashboardData; error: null }
  | { status: 'error'; data: null; error: string }

const MOCK_DATA: DashboardData = {
  kpis: MOCK_KPIS,
  alerts: MOCK_ALERTS,
  activity: MOCK_ACTIVITY,
}

/* ------------------------------------------------------------- formatting */

/** "9 September" — the year is noise for something due within a month. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

/**
 * "in 9 days" / "3 days ago" / "today", from a date or timestamp.
 *
 * Whole days only. An expiry is a date, not a moment, so "in 9 days" is the
 * honest precision — "in 8 hours" would read as though the clock mattered.
 */
function relativeDays(iso: string): string {
  const then = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(then) - startOfDay(new Date())) / 86_400_000)

  if (days === 0) return t.live.today
  if (days > 0) return t.live.inDays(days)
  return t.live.daysAgo(-days)
}

/** "licence" -> "Licence". Document types are free text in the schema. */
function titleCase(value: string): string {
  const clean = value.replace(/[_-]+/g, ' ').trim()
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/* ------------------------------------------------ snapshot -> what is shown */

function toKpis(counts: api.DashboardCounts): Kpi[] {
  const tiles: Kpi[] = [
    {
      id: 'drivers-active',
      label: t.live.driversActive,
      value: counts.driversActive,
      detail: t.live.ofRoster(counts.driversTotal),
      href: '/drivers',
    },
    {
      id: 'vehicles-active',
      label: t.live.vehiclesActive,
      value: counts.vehiclesActive,
      detail: t.live.ofFleet(counts.vehiclesTotal),
      href: '/vehicles',
    },
    {
      id: 'out-of-service',
      label: t.live.outOfService,
      value: counts.vehiclesOutOfService,
      detail: t.live.outOfServiceHint,
      tone: counts.vehiclesOutOfService > 0 ? 'danger' : undefined,
      href: '/vehicles',
    },
    {
      id: 'expiring-docs',
      label: t.live.expiringDocuments,
      value: counts.expiringDocuments,
      detail: t.live.expiringDocumentsHint,
      tone: counts.expiringDocuments > 0 ? 'warning' : undefined,
      href: '/drivers',
    },
    {
      id: 'service-due',
      label: t.live.serviceDue,
      value: counts.serviceDue,
      detail: t.live.serviceDueHint,
      tone: counts.serviceDue > 0 ? 'warning' : undefined,
      href: '/vehicles',
    },
    {
      id: 'work-orders',
      label: t.live.openWorkOrders,
      value: counts.workOrdersOpen,
      detail: t.live.openWorkOrdersHint,
      href: '/vehicles',
    },
  ]

  // Only during rollout: once every driver has the app this is always zero, and
  // a tile that is permanently zero is a tile nobody reads.
  if (counts.driversWithoutLogin > 0) {
    tiles.push({
      id: 'drivers-no-login',
      label: t.live.driversWithoutLogin,
      value: counts.driversWithoutLogin,
      detail: t.live.driversWithoutLoginHint,
      href: '/drivers',
    })
  }

  return tiles
}

/**
 * Alerts, worst first: a truck already overdue for service outranks a licence
 * expiring next month.
 */
function toAlerts(snapshot: api.DashboardSnapshot): Alert[] {
  const services: Alert[] = snapshot.dueServices.map((service) => ({
    id: `service-${service.id}`,
    tone: 'warning',
    title: t.live.serviceOverdue(service.vehicleName || t.live.unnamedVehicle, service.name),
    detail:
      service.nextDueKm !== null && service.odometerKm !== null && service.odometerKm >= service.nextDueKm
        ? t.live.serviceOverdueByKm(Math.round(service.odometerKm - service.nextDueKm))
        : service.nextDueAt
          ? t.live.serviceDueOn(formatDay(service.nextDueAt))
          : '',
    at: service.nextDueAt ? relativeDays(service.nextDueAt) : '',
    href: service.vehicleId ? `/vehicles/${service.vehicleId}` : '/vehicles',
  }))

  const documents: Alert[] = snapshot.expiringDocuments.map((doc) => {
    const expired = doc.expiresOn !== null && new Date(doc.expiresOn) < new Date()
    return {
      id: `doc-${doc.id}`,
      tone: expired ? 'danger' : 'warning',
      title: expired
        ? t.live.documentExpired(doc.ownerName, titleCase(doc.docType))
        : t.live.documentExpiring(doc.ownerName, titleCase(doc.docType)),
      detail: doc.expiresOn ? t.live.expiresOn(formatDay(doc.expiresOn)) : '',
      at: doc.expiresOn ? relativeDays(doc.expiresOn) : '',
      href: doc.driverId
        ? `/drivers/${doc.driverId}`
        : doc.vehicleId
          ? `/vehicles/${doc.vehicleId}`
          : '/documents',
    }
  })

  const workOrders: Alert[] = snapshot.openWorkOrders.map((order) => ({
    id: `wo-${order.id}`,
    tone: 'accent',
    title: t.live.workOrderOpen(order.reference ?? order.title),
    detail: order.vehicleName ? t.live.workOrderOn(order.vehicleName) : order.title,
    at: relativeDays(order.openedAt),
    href: '/vehicles',
  }))

  const byTone = { danger: 0, warning: 1, accent: 2, success: 3, neutral: 4 }
  return [...services, ...documents, ...workOrders].sort(
    (a, b) => byTone[a.tone] - byTone[b.tone],
  )
}

/* ---------------------------------------------------------------- the hook */

export function useDashboard() {
  const { session } = useAuth()
  const orgId = session?.organization.id ?? null

  const [state, setState] = useState<State>(
    USE_MOCK_DATA
      ? { status: 'ready', data: MOCK_DATA, error: null }
      : { status: 'loading', data: null, error: null },
  )

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (USE_MOCK_DATA) {
        setState({ status: 'ready', data: MOCK_DATA, error: null })
        return
      }
      if (!orgId) return

      setState({ status: 'loading', data: null, error: null })
      try {
        const snapshot = await api.loadDashboard(orgId)
        if (signal?.cancelled) return
        setState({
          status: 'ready',
          data: {
            kpis: toKpis(snapshot.counts),
            alerts: toAlerts(snapshot),
            // No audit trail yet, so there is nothing truthful to list here.
            activity: [] as ActivityItem[],
          },
          error: null,
        })
      } catch (error) {
        if (signal?.cancelled) return
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : t.live.loadFailed,
        })
      }
    },
    [orgId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  return {
    ...state,
    /** True when the activity feed has no backend, so the page can say so. */
    activityUnavailable: !USE_MOCK_DATA,
    reload: () => void load(),
  }
}
