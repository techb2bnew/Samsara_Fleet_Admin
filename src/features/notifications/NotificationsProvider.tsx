import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MOCK_NOTIFICATIONS, type Notification } from '../../mocks/notifications'

/**
 * Holds the notification list for the whole console.
 *
 * The unread badge in the header and the panel below it have to agree, and so
 * will the full page — so read state lives here rather than inside any one of
 * them. When this is wired to Supabase, only this file changes.
 */

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      // Returns the same array when nothing is unread, so a pointless render is
      // skipped and the button is effectively a no-op rather than a state churn.
      current.some((n) => !n.read) ? current.map((n) => ({ ...n, read: true })) : current,
    )
  }, [])

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
