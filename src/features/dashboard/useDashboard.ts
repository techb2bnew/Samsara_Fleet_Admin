import { useCallback, useEffect, useState } from 'react'
import * as api from '../../supabase/api'
import { STRINGS } from '../../constants'
import { useAuth } from '../auth/AuthProvider'
import type { ActivityItem, Alert, DashboardData, Kpi } from './types'

/**
 * Where the dashboard gets its numbers: live counts from Supabase, and nothing
 * else. The page renders whatever comes back.
 *
 * ---------------------------------------------------------------------------
 * What the data can and cannot answer yet
 * ---------------------------------------------------------------------------
 * The dashboard shows what the schema can actually prove and leaves the rest
 * out rather than printing a zero that looks like good news. Still missing:
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

/**
 * How fresh the position feed is.
 *
 *   'live'    something reported within the offline window
 *   'stale'   the newest report is older than that
 *   'silent'  nothing has ever reported
 *   null      not known yet, or the load failed
 */
export type FeedState = 'live' | 'stale' | 'silent' | null

/** Matches the live map's rule, so the two screens never disagree. */
const FEED_STALE_AFTER_MINUTES = 15

type State =
  | { status: 'loading'; data: null; error: null; feed: null }
  | { status: 'ready'; data: DashboardData; error: null; feed: FeedState }
  | { status: 'error'; data: null; error: string; feed: null }

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
      href: '/vehicles?tab=out_of_service',
    },
    {
      id: 'expiring-docs',
      label: t.live.expiringDocuments,
      value: counts.expiringDocuments,
      detail: t.live.expiringDocumentsHint,
      tone: counts.expiringDocuments > 0 ? 'warning' : undefined,
      /*
       * Documents, filtered to the ones this tile is counting.
       *
       * It pointed at /drivers, which is neither where documents live nor
       * where an expiry is visible. The query string is read by the page: a
       * tile that says "1" and then shows a list of six is a tile that made
       * somebody do the filtering by hand.
       */
      href: '/documents?show=expiring',
    },
    {
      id: 'service-due',
      label: t.live.serviceDue,
      value: counts.serviceDue,
      detail: t.live.serviceDueHint,
      tone: counts.serviceDue > 0 ? 'warning' : undefined,
      href: '/vehicles?tab=service_due',
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
      /*
       * The document itself, not the driver or the truck it belongs to.
       *
       * This used to land on the owner's page, leaving somebody to find the
       * expiring document among everything else filed against them — which is
       * the one thing they already knew when they clicked. The detail page
       * shows the file, so the answer to "is this the right one" is on screen.
       */
      href: `/documents/${doc.id}`,
    }
  })

  const workOrders: Alert[] = snapshot.openWorkOrders.map((order) => ({
    id: `wo-${order.id}`,
    tone: 'accent',
    title: t.live.workOrderOpen(order.reference ?? order.title),
    detail: order.vehicleName ? t.live.workOrderOn(order.vehicleName) : order.title,
    at: relativeDays(order.openedAt),
    /* The job, not the vehicle list. /work-orders/:id has existed all along. */
    href: `/work-orders/${order.id}`,
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

  const [state, setState] = useState<State>({
    status: 'loading',
    data: null,
    error: null,
    feed: null,
  })

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setState({ status: 'loading', data: null, error: null, feed: null })
      try {
        const snapshot = await api.loadDashboard(orgId)
        if (signal?.cancelled) return
        const newest = snapshot.counts.lastPositionAt
        const feed: FeedState =
          newest === null
            ? 'silent'
            : (Date.now() - new Date(newest).getTime()) / 60_000 <= FEED_STALE_AFTER_MINUTES
              ? 'live'
              : 'stale'

        setState({
          status: 'ready',
          feed,
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
          feed: null,
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
    /**
     * The activity feed has no backend yet: audit entries have to be written
     * by the server, and nothing does. The page says so rather than showing
     * "all clear", which would claim nothing has happened.
     */
    activityUnavailable: true,
    reload: () => void load(),
  }
}
