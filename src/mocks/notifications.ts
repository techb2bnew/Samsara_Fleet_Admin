/**
 * Demonstration notifications.
 *
 * These mirror the alert rules described in module A15 — a violation, an expiry,
 * an overdue service, a late route — so the panel shows the kinds of thing the
 * real system will actually raise, rather than filler.
 */

import type { Tone } from '../constants'

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
  /** Pre-formatted relative time. Real data will compute this from a timestamp. */
  at: string
  read: boolean
  href: string
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    kind: 'violation',
    tone: 'danger',
    title: 'Driving limit exceeded',
    detail: 'Ravi Deshmukh passed the 11-hour limit by 26 minutes on Truck 214.',
    at: '12 min ago',
    read: false,
    href: '/drivers/d1',
  },
  {
    id: 'n2',
    kind: 'defect',
    tone: 'danger',
    title: 'Truck 108 marked unsafe to drive',
    detail: 'Brake fault reported by Manoj Pawar on a pre-trip inspection.',
    at: '38 min ago',
    read: false,
    href: '/inspections/i1',
  },
  {
    id: 'n3',
    kind: 'expiry',
    tone: 'warning',
    title: 'Medical certificate expiring',
    detail: "Sunita Rao's certificate expires on 9 September. No renewal recorded.",
    at: '2 hours ago',
    read: false,
    href: '/drivers/d3',
  },
  {
    id: 'n4',
    kind: 'maintenance',
    tone: 'warning',
    title: 'Service overdue',
    detail: 'Truck 133 is 1,240 km past its 20,000 km service.',
    at: '4 hours ago',
    read: false,
    href: '/vehicles/v3',
  },
  {
    id: 'n5',
    kind: 'route',
    tone: 'accent',
    title: 'Route running late',
    detail: 'NL-4471 is 40 minutes behind with 3 stops remaining.',
    at: '5 hours ago',
    read: true,
    href: '/dispatch/r1',
  },
  {
    id: 'n6',
    kind: 'message',
    tone: 'accent',
    title: 'New message from Dev Singh',
    detail: '"Held up at the Pune depot, gate queue is about an hour."',
    at: 'Yesterday',
    read: true,
    href: '/messages?driver=Dev%20Singh',
  },
  {
    id: 'n7',
    kind: 'expiry',
    tone: 'neutral',
    title: 'Licence renewed',
    detail: "Amit Verma's licence was renewed until March 2031.",
    at: 'Yesterday',
    read: true,
    href: '/drivers/d2',
  },
]
