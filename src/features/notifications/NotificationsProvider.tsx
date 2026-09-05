import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Notification } from './types'
import { useFleetData } from '../fleet-data'
import { STRINGS } from '../../constants'

/**
 * Holds the notification list for the whole console.
 *
 * There is no notifications table, and that is deliberate — see the
 * audit_and_alerts migration. A notification is a thing that already needs
 * attention, so the list is built from what the console has already loaded:
 * open defects, expiring licences, corrections waiting on a driver, late
 * routes. Nothing is stored twice, and nothing can go stale.
 *
 * The cost is that "read" lives only in this session. Persisting it needs a
 * row per person per notification, which is the one thing a notifications
 * table would genuinely buy — worth adding when push notifications land, and
 * not before.
 */

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { drivers, inspections, inspectionDefects, editRequests, routes, threads } = useFleetData()

  /** Ids marked read in this session. */
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set())

  const derived = useMemo<Notification[]>(() => {
    const t = STRINGS.notifications.derived
    const out: Notification[] = []

    // Unsafe defects first: a truck that must not be driven outranks paperwork.
    for (const inspection of inspections) {
      const worst = (inspectionDefects[inspection.id] ?? []).filter((d) => d.status === 'open')
      const critical = worst.find((d) => d.severity === 'critical')
      if (!critical) continue
      out.push({
        id: `defect-${critical.id}`,
        kind: 'defect',
        tone: 'danger',
        title: t.unsafeDefect(inspection.vehicle),
        detail: `${critical.area} — ${critical.finding}`,
        at: inspection.submitted,
        read: false,
        href: `/inspections/${inspection.id}`,
      })
    }

    for (const driver of drivers) {
      if (driver.licenceExpired) {
        out.push({
          id: `licence-expired-${driver.id}`,
          kind: 'expiry',
          tone: 'danger',
          title: t.licenceExpired(driver.name),
          detail: driver.licenceExpires ?? '',
          at: '',
          read: false,
          href: `/drivers/${driver.id}`,
        })
      } else if (driver.licenceWarning) {
        out.push({
          id: `licence-${driver.id}`,
          kind: 'expiry',
          tone: 'warning',
          title: t.licenceExpiring(driver.name),
          detail: driver.licenceExpires ?? '',
          at: '',
          read: false,
          href: `/drivers/${driver.id}`,
        })
      }
    }

    for (const request of editRequests) {
      out.push({
        id: `edit-${request.id}`,
        kind: 'violation',
        tone: 'accent',
        title: t.correctionWaiting(request.driver),
        detail: request.reason,
        at: request.requested,
        read: false,
        href: '/hours',
      })
    }

    /*
     * Unread driver messages.
     *
     * One entry per thread, not per message: twelve messages from one driver
     * is one conversation to go and read, and twelve rows would bury every
     * other kind of notification under it. The count is in the wording.
     *
     * The driver app does the same thing in the other direction, so both sides
     * of a conversation raise a notification — which is the point. A message
     * nobody is told about is a message nobody answers.
     */
    for (const thread of threads) {
      if (thread.unreadCount === 0) continue
      out.push({
        id: `message-${thread.id}-${thread.unreadCount}`,
        kind: 'message',
        tone: 'accent',
        title:
          thread.unreadCount === 1
            ? t.driverMessaged(thread.driver)
            : t.driverMessagedCount(thread.driver, thread.unreadCount),
        detail: thread.preview,
        at: thread.at,
        read: false,
        href: '/messages',
      })
    }

    for (const route of routes) {
      if (route.status !== 'late') continue
      out.push({
        id: `route-${route.id}`,
        kind: 'route',
        tone: 'warning',
        title: t.routeLate(route.reference),
        detail: `${route.eta} · ${route.driver}`,
        at: '',
        read: false,
        href: `/dispatch/${route.id}`,
      })
    }

    return out
  }, [drivers, inspections, inspectionDefects, editRequests, routes, threads])

  const notifications = useMemo(
    () => derived.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n)),
    [derived, readIds],
  )

  const markRead = useCallback((id: string) => {
    setReadIds((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    // Returns the same set when nothing is unread, so the button is a no-op
    // rather than a pointless render.
    setReadIds((current) => {
      const unread = derived.filter((n) => !current.has(n.id))
      if (unread.length === 0) return current
      const next = new Set(current)
      for (const n of unread) next.add(n.id)
      return next
    })
  }, [derived])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markRead,
      markAllRead,
    }),
    [notifications, markRead, markAllRead],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
