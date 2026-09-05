import type { Tone } from '../../constants'
import type { LatLng } from './geometry'

/**
 * Routes and their stops.
 *
 * "Running late" is not a stored status — it is the planned end compared
 * against the clock and the stops still outstanding, worked out on read. A
 * route cannot sit in the database marked on time while it is two hours over.
 */

export type Route = {
  id: string
  reference: string
  driver: string
  vehicle: string
  driverId: string | null
  vehicleId: string | null
  origin: string
  destination: string
  distanceKm: number | null
  path: LatLng[]
  stopsDone: number
  stopsTotal: number
  /*
   * 'late' is derived here, not a database status — a route past its planned
   * end with stops outstanding. 'cancelled' IS a database status and used to
   * be missing from this union, which meant a cancelled route fell through to
   * 'planned' and sat on the board looking like work somebody still had to do.
   */
  status: 'planned' | 'in_progress' | 'late' | 'completed' | 'cancelled'
  /** Already worded: "40 min behind", "On time", "Finished 14:20". */
  eta: string
}

export type RouteStop = {
  id: string
  sequence: number
  name: string
  address: string
  /** Kilometres from the origin along the planned drive. Null when unknown. */
  kmFromStart: number | null
  lat: number | null
  lng: number | null
  /** Already worded, "08:00 – 09:00". Empty when no window was set. */
  window: string
  arrivedAt: string | null
  /**
   * Metres the driver was from this stop when they marked it arrived.
   *
   * Null is "not checked", not "zero" — the app could not get a fix, or the
   * stop has no coordinates to measure against. Worth showing: a route whose
   * stops were all marked from the same place was never driven.
   */
  arrivedDistanceM: number | null
}

export const ROUTE_TONE: Record<Route['status'], Tone> = {
  planned: 'neutral',
  in_progress: 'accent',
  late: 'danger',
  completed: 'success',
  cancelled: 'neutral',
}

export const ROUTE_LABEL: Record<Route['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  late: 'Running late',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
