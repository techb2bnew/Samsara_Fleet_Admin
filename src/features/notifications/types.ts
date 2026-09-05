import type { Tone } from '../../constants'

/**
 * What the bell shows.
 *
 * There is no notifications table, by decision — see NotificationsProvider. A
 * notification is derived from something the console has already loaded, so
 * these are shapes, never stored rows.
 */

export type NotificationKind =
  | 'violation'
  | 'defect'
  | 'expiry'
  | 'maintenance'
  | 'route'
  | 'message'

export type Notification = {
  id: string
  kind: NotificationKind
  tone: Tone
  title: string
  detail: string
  /** Pre-formatted relative time, or empty when the source has no timestamp. */
  at: string
  read: boolean
  href: string
}
