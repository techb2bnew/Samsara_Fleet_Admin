import { formatKm, sampleAlongPath, serializePath, type LatLng } from './geometry'

export type PlannedStop = {
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  distanceFromStartKm: number | null
}

export type RouteEnd = {
  query: string
  label: string
  at?: LatLng | null
}

export type PlannedDrive = {
  plannedDistanceKm: number
  pathPolyline: string
  stops: PlannedStop[]
  /** Already worded, e.g. "a stop every 50 km". */
  spacing: string
  /**
   * False when Directions was refused and the line is the straight distance
   * between the two depots. The route is still real; it just does not hug the
   * road until the map key is allowed to call Directions.
   */
  followedRoad: boolean
}

/**
 * Turns an origin, a destination and a stop count into a drive.
 *
 * Prefers Google Directions so the line follows the road. When the key is not
 * allowed to call that service — the usual `REQUEST_DENIED` — the two depot
 * coordinates are used instead, so planning still produces a map rather than
 * a Google error in the form.
 */
export async function planAlongRoute(
  maps: typeof google.maps,
  origin: RouteEnd,
  destination: RouteEnd,
  stopCount: number,
): Promise<PlannedDrive> {
  const from = origin.query.trim()
  const to = destination.query.trim()
  if (!from || !to) throw new Error('Enter a start and an end.')

  const labels = { start: origin.label, end: destination.label }

  try {
    const alongRoad = await alongDirections(maps, origin, destination, stopCount, labels)
    if (alongRoad) return alongRoad
  } catch (error) {
    if (!canFallBack(error)) throw new Error(humanizeMapsError(error))
  }

  const start = await resolvePoint(maps, origin)
  const end = await resolvePoint(maps, destination)
  return fromStraightLine(start, end, stopCount, labels, from, to)
}

async function alongDirections(
  maps: typeof google.maps,
  origin: RouteEnd,
  destination: RouteEnd,
  stopCount: number,
  labels: { start: string; end: string },
): Promise<PlannedDrive | null> {
  const directions = new maps.DirectionsService()
  const result = await directions.route({
    origin: origin.at ?? origin.query.trim(),
    destination: destination.at ?? destination.query.trim(),
    travelMode: maps.TravelMode.DRIVING,
  })

  const legPath = result.routes[0]
  if (!legPath) return null

  const path: LatLng[] = (legPath.overview_path ?? []).map((p) => ({
    lat: p.lat(),
    lng: p.lng(),
  }))
  if (path.length < 2) return null

  return fromPath(maps, path, stopCount, labels, origin.query.trim(), destination.query.trim(), true)
}

function fromStraightLine(
  start: LatLng,
  end: LatLng,
  stopCount: number,
  labels: { start: string; end: string },
  originAddress: string,
  destAddress: string,
): PlannedDrive {
  const path = [start, end]
  const samples = sampleAlongPath(path, stopCount)
  const totalKm = samples[samples.length - 1]?.km ?? 0
  const gap = samples.length > 1 ? totalKm / (samples.length - 1) : totalKm

  const stops: PlannedStop[] = samples.map((sample, i) => {
    const isStart = i === 0
    const isEnd = i === samples.length - 1
    return {
      name: isStart ? labels.start : isEnd ? labels.end : `Stop ${i + 1}`,
      address: isStart ? originAddress : isEnd ? destAddress : '',
      latitude: sample.lat,
      longitude: sample.lng,
      distanceFromStartKm: roundKm(sample.km),
    }
  })

  return {
    plannedDistanceKm: roundKm(totalKm),
    pathPolyline: serializePath(path),
    stops,
    spacing: `a stop every ${formatKm(gap)}`,
    followedRoad: false,
  }
}

async function fromPath(
  maps: typeof google.maps,
  path: LatLng[],
  stopCount: number,
  labels: { start: string; end: string },
  originAddress: string,
  destAddress: string,
  followedRoad: boolean,
): Promise<PlannedDrive> {
  const samples = sampleAlongPath(path, stopCount)
  const totalKm = samples[samples.length - 1]?.km ?? 0
  const geocoder = new maps.Geocoder()

  const startAddress = await formattedAddress(geocoder, path[0], originAddress)
  const endAddress = await formattedAddress(geocoder, path[path.length - 1], destAddress)

  const stops: PlannedStop[] = []
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const isStart = i === 0
    const isEnd = i === samples.length - 1
    const address = isStart
      ? startAddress
      : isEnd
        ? endAddress
        : await formattedAddress(geocoder, sample, '')
    stops.push({
      name: isStart ? labels.start : isEnd ? labels.end : `Stop ${i + 1}`,
      address,
      latitude: sample.lat,
      longitude: sample.lng,
      distanceFromStartKm: roundKm(sample.km),
    })
  }

  const gap = samples.length > 1 ? totalKm / (samples.length - 1) : totalKm

  return {
    plannedDistanceKm: roundKm(totalKm),
    pathPolyline: serializePath(path),
    stops,
    spacing: `a stop every ${formatKm(gap)}`,
    followedRoad,
  }
}

async function resolvePoint(maps: typeof google.maps, end: RouteEnd): Promise<LatLng> {
  if (end.at) return end.at
  const parsed = parseLatLng(end.query)
  if (parsed) return parsed

  try {
    const res = await new maps.Geocoder().geocode({ address: end.query.trim() })
    const loc = res.results[0]?.geometry?.location
    if (loc) return { lat: loc.lat(), lng: loc.lng() }
  } catch {
    // Geocoding can be refused on the same key. The caller still has a label.
  }

  throw new Error(`Could not find ${end.label} on the map. Check the address in Settings.`)
}

export function parseLatLng(value: string): LatLng | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function canFallBack(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? '')
  return /REQUEST_DENIED|ZERO_RESULTS|OVER_QUERY_LIMIT|UNKNOWN_ERROR|not allowed to use the directions|DIRECTIONS_ROUTE|MAX_ROUTE_LENGTH/i.test(
    text,
  )
}

export function humanizeMapsError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? '')
  if (/REQUEST_DENIED|not allowed to use the directions/i.test(text)) {
    return 'The map key is not allowed to plot a drive. Enable Directions API on it, or save the depot addresses so a straight line can be drawn.'
  }
  if (/ZERO_RESULTS/i.test(text)) {
    return 'No drive could be found between those places.'
  }
  return text || 'That route could not be plotted.'
}

function roundKm(km: number): number {
  return Math.round(km * 10) / 10
}

async function formattedAddress(
  geocoder: google.maps.Geocoder,
  at: LatLng,
  fallback: string,
): Promise<string> {
  try {
    const res = await geocoder.geocode({ location: at })
    const best = res.results[0]?.formatted_address
    if (best) return best
  } catch {
    // The typed address is still the right thing to store when reverse
    // geocoding is off or the key cannot call it.
  }
  return fallback
}

/** Named stops with no coordinates, used when a map key is not configured. */
export function placeholderStops(
  origin: string,
  destination: string,
  stopCount: number,
  labels?: { start?: string; end?: string },
): PlannedStop[] {
  const n = Math.max(2, Math.min(30, Math.round(Number(stopCount) || 2)))
  return Array.from({ length: n }, (_, i) => {
    const isStart = i === 0
    const isEnd = i === n - 1
    return {
      name: isStart ? (labels?.start ?? 'Start') : isEnd ? (labels?.end ?? 'End') : `Stop ${i + 1}`,
      address: isStart ? origin.trim() : isEnd ? destination.trim() : '',
      latitude: null,
      longitude: null,
      distanceFromStartKm: null,
    }
  })
}
