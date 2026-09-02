/**
 * Demonstration data for the console.
 *
 * Everything here is invented, and it lives in one place so that no screen
 * carries data of its own. When a module is wired to Supabase, its import
 * changes from this file to a query — the component itself does not move.
 *
 * The numbers are deliberately plausible for a mid-size carrier: about forty
 * trucks, a handful of live problems, not a suspiciously perfect fleet.
 */

import type { ActivityItem, Alert, Kpi } from '../features/dashboard/types'

/* ------------------------------------------------------------------ counts */

export const MOCK_KPIS: Kpi[] = [
  { id: 'on-duty', label: 'Drivers on duty', value: 27, detail: 'of 41 on the roster', href: '/drivers' },
  { id: 'moving', label: 'Vehicles moving', value: 19, detail: '6 idle, 2 offline', href: '/map' },
  { id: 'violations', label: 'Hours violations', value: 3, detail: 'need review today', tone: 'danger', href: '/hours' },
  { id: 'defects', label: 'Open defects', value: 5, detail: '1 marked unsafe to drive', tone: 'warning', href: '/inspections' },
  { id: 'unassigned', label: 'Unassigned driving', value: 2, detail: 'segments to claim', tone: 'warning', href: '/hours' },
  { id: 'stops', label: 'Stops completed', value: 84, detail: 'of 112 planned today', tone: 'success', href: '/dispatch' },
]

/* ------------------------------------------------------------------ alerts */

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1',
    tone: 'danger',
    title: 'Ravi Deshmukh exceeded the 11-hour driving limit',
    detail: 'Truck 214 · limit passed by 26 minutes',
    at: '12 min ago',
    href: '/drivers/d1',
  },
  {
    id: 'a2',
    tone: 'danger',
    title: 'Truck 108 marked unsafe to drive',
    detail: 'Brake fault found on pre-trip inspection',
    at: '38 min ago',
    href: '/inspections/i1',
  },
  {
    id: 'a3',
    tone: 'warning',
    title: "Sunita Rao's medical certificate expires in 9 days",
    detail: 'Expires 9 September · renewal not recorded',
    at: '2 hours ago',
    href: '/drivers/d3',
  },
  {
    id: 'a4',
    tone: 'warning',
    title: 'Truck 133 service overdue by 1,240 km',
    detail: 'Scheduled every 20,000 km',
    at: '4 hours ago',
    href: '/vehicles/v3',
  },
  {
    id: 'a5',
    tone: 'accent',
    title: 'Route NL-4471 running 40 minutes late',
    detail: '3 stops remaining · Amit Verma',
    at: '5 hours ago',
    href: '/dispatch/r1',
  },
]

/* -------------------------------------------------------------- activity */

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'v1', who: 'Priya Sharma', initials: 'PS', what: 'approved a log edit for Ravi Deshmukh', at: '08:42', href: '/hours' },
  { id: 'v2', who: 'Kabir Nair', initials: 'KN', what: 'closed work order WO-2291 on Truck 108', at: '08:15', href: '/work-orders/w4' },
  { id: 'v3', who: 'Meera Iyer', initials: 'MI', what: 'dispatched route NL-4482 to Dev Singh', at: '07:58', href: '/dispatch/r2' },
  { id: 'v4', who: 'Amit Verma', initials: 'AV', what: 'submitted a pre-trip inspection for Truck 214', at: '07:31', href: '/inspections/i3' },
  { id: 'v5', who: 'Priya Sharma', initials: 'PS', what: 'invited nikhil@northline.example as Dispatcher', at: '07:10', href: '/users' },
]

/* ------------------------------------------------------------ notifications */

export const MOCK_UNREAD_NOTIFICATIONS = 4
