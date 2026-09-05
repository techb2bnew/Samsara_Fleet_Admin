import type { Tone } from '../../constants'

/**
 * What the live map shows.
 *
 * The Supabase query is mapped into this shape, so the map, the side panel and
 * the vehicle list all read one thing.
 */

export type MapVehicleStatus = 'driving' | 'idle' | 'resting' | 'offline'

export type MapVehicle = {
  id: string
  name: string
  driver: string | null
  status: MapVehicleStatus
  speedKmh: number
  /** Relative time, already formatted for display. */
  lastPing: string
  /** Where it is, in words. Coordinates when nothing better is known. */
  place: string
  /** Real coordinates, used by the Google map. */
  lat: number
  lng: number
  /**
   * Position as a percentage of the panel, used by the schematic fallback.
   *
   * Derived from lat/lng against the whole fleet's bounding box, so the
   * schematic keeps the real relative layout — a truck north of the depot
   * appears above it — rather than being scattered decoration.
   */
  x: number
  y: number
}

export const MAP_STATUS_LABEL: Record<MapVehicleStatus, string> = {
  driving: 'Driving',
  idle: 'Idling',
  resting: 'Parked',
  offline: 'Offline',
}

export const MAP_STATUS_TONE: Record<MapVehicleStatus, Tone> = {
  driving: 'success',
  idle: 'warning',
  resting: 'accent',
  offline: 'danger',
}
