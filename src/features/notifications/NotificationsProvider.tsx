import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Notification } from './types'
import { useFleetData } from '../fleet-data'
import { useAuth } from '../auth/AuthProvider'
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
 * "Read" is kept in localStorage, keyed by user id. It used to live only in
 * memory, so marking everything read and signing back in showed the same list
 * unread again — the console looked like it had ignored the click.
 *
 * localStorage rather than a table, because these ids are derived. A thread
 * with three unread messages is `message-<id>-3`, and when a fourth arrives it
 * becomes `message-<id>-4` and is unread again — which is the behaviour that is
 * wanted, and which a stored row per notification would have to reproduce
 * anyway. The honest cost is that read state is per browser: the same person on
 * a second machine starts fresh. Worth a table when push notifications land,
 * and not before.
 */

/** Enough to cover what the console can show; small enough to stay quick. */
const KEEP = 200;

function storageKey(userId: string): string {
  return `samsara.console.readNotifications.${userId}`
}

/**
 * Read once, and never allowed to throw.
 *
 * Safari in private mode and a browser with site data blocked both make
 * localStorage throw on access rather than returning null, and a notification
 * bell is not worth a white screen.
 */
function loadRead(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveRead(userId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids].slice(-KEEP)))
  } catch {
    // Nothing to do and nothing worth telling anyone. The list still works
    // for this session; only the memory of it is lost.
  }
}

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { drivers, inspections, inspectionDefects, editRequests, routes, threads } = useFleetData()

  // AuthContextValue spreads AuthState, so status and session sit on it.
  const { status, session } = useAuth()
  const userId = status === 'signedIn' ? session.user.id : null

  /** Ids already marked read, restored from this browser. */
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set())

  /*
   * Keyed by user, so two people sharing a machine do not clear each other's
   * bell. Reloaded when the user changes rather than merged: signing in as
   * somebody else should show their unread list, not the last person's.
   */
  useEffect(() => {
    setReadIds(userId ? loadRead(userId) : new Set())
  }, [userId])

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

  const markRead = useCallback(
    (id: string) => {
      setReadIds((current) => {
        if (current.has(id)) return current
        const next = new Set(current)
        next.add(id)
        if (userId) saveRead(userId, next)
        return next
      })
    },
    [userId],
  )

  const markAllRead = useCallback(() => {
    // Returns the same set when nothing is unread, so the button is a no-op
    // rather than a pointless render.
    setReadIds((current) => {
      const unread = derived.filter((n) => !current.has(n.id))
      if (unread.length === 0) return current
      const next = new Set(current)
      for (const n of unread) next.add(n.id)
      if (userId) saveRead(userId, next)
      return next
    })
  }, [derived, userId])

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
