import { useCallback, useEffect, useState } from 'react'
import * as api from '../../supabase/api'
import { STRINGS } from '../../constants'
import { useAuth } from '../auth/AuthProvider'
import type { MapVehicle, MapVehicleStatus } from './types'

/**
 * Where the live map gets its vehicles: the real fleet and each vehicle's last
 * reported position.
 *
 * The database stores position, speed and ignition. It does not store a
 * status — "driving", "idle", "offline" are read off those three, here, so the
 * rule lives in one place and changing it does not need a migration.
 */

const t = STRINGS.map

/**
 * A vehicle that has not reported for this long is treated as offline.
 *
 * Fifteen minutes, not two: a truck in a tunnel or a basement dock goes quiet
 * for a few minutes routinely, and marking it offline every time would make the
 * status useless. Long enough to mean something is actually wrong.
 */
const OFFLINE_AFTER_MINUTES = 15

/** Below this a vehicle is stopped, not crawling. GPS noise sits around 1-2. */
const MOVING_ABOVE_KPH = 3

type State =
  | { status: 'loading'; vehicles: null; error: null }
  | { status: 'ready'; vehicles: MapVehicle[]; error: null }
  | { status: 'error'; vehicles: null; error: string }

/* ------------------------------------------------------------- formatting */

/** "8 sec ago" / "12 min ago" / "4 hours ago". */
function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return t.live.secondsAgo(seconds)
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t.live.minutesAgo(minutes)
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t.live.hoursAgo(hours)
  return t.live.daysAgo(Math.round(hours / 24))
}

function statusOf(row: api.MapVehicleRow): MapVehicleStatus {
  if (!row.positionAt) return 'offline'
  const minutesSince = (Date.now() - new Date(row.positionAt).getTime()) / 60_000
  if (minutesSince > OFFLINE_AFTER_MINUTES) return 'offline'
  if ((row.speedKph ?? 0) > MOVING_ABOVE_KPH) return 'driving'
  // Reporting, stopped. Ignition tells idling apart from parked up.
  return row.ignitionOn ? 'idle' : 'resting'
}

/**
 * Places every vehicle on the 0–100 grid the schematic fallback draws on.
 *
 * The fleet's own bounding box is the frame, so the picture keeps real relative
 * positions — a truck north of the depot appears above it. Latitude is flipped
 * because north is up on a map and down in CSS.
 *
 * A fleet parked in one yard has no spread to scale against, so anything
 * narrower than MIN_SPAN is centred rather than divided by zero.
 */
const MIN_SPAN = 0.01
const PADDING = 12

function withGridPositions(
  rows: Array<Omit<MapVehicle, 'x' | 'y'>>,
): MapVehicle[] {
  const located = rows.filter((r) => r.lat !== 0 || r.lng !== 0)
  if (located.length === 0) return rows.map((r) => ({ ...r, x: 50, y: 50 }))

  const lats = located.map((r) => r.lat)
  const lngs = located.map((r) => r.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const latSpan = maxLat - minLat
  const lngSpan = maxLng - minLng
  const usable = 100 - PADDING * 2

  return rows.map((r) => ({
    ...r,
    x:
      lngSpan < MIN_SPAN ? 50 : PADDING + ((r.lng - minLng) / lngSpan) * usable,
    y:
      latSpan < MIN_SPAN ? 50 : PADDING + ((maxLat - r.lat) / latSpan) * usable,
  }))
}

function toMapVehicles(rows: api.MapVehicleRow[]): MapVehicle[] {
  const withoutGrid = rows.map((row) => {
    const lat = row.latitude ?? 0
    const lng = row.longitude ?? 0
    const status = statusOf(row)
    return {
      id: row.id,
      name: row.name,
      driver: row.driverName,
      status,
      // A stopped vehicle's last reported speed is noise; show zero.
      speedKmh: status === 'driving' ? Math.round(row.speedKph ?? 0) : 0,
      lastPing: row.positionAt ? relativeTime(row.positionAt) : t.live.neverReported,
      // No reverse geocoding, so coordinates are the honest answer. Inventing a
      // place name from a depot would put a truck at the yard while it is on
      // the highway.
      place:
        row.latitude === null || row.longitude === null
          ? t.live.noPosition
          : t.live.coordinates(row.latitude, row.longitude),
      lat,
      lng,
    }
  })

  return withGridPositions(withoutGrid)
}

/* ---------------------------------------------------------------- the hook */

export function useLiveMap() {
  const { session } = useAuth()
  const orgId = session?.organization.id ?? null

  const [state, setState] = useState<State>({
    status: 'loading',
    vehicles: null,
    error: null,
  })

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!orgId) return

      setState({ status: 'loading', vehicles: null, error: null })
      try {
        const rows = await api.loadMapVehicles(orgId)
        if (signal?.cancelled) return
        setState({ status: 'ready', vehicles: toMapVehicles(rows), error: null })
      } catch (error) {
        if (signal?.cancelled) return
        setState({
          status: 'error',
          vehicles: null,
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

  return { ...state, reload: () => void load() }
}
