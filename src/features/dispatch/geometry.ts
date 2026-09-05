/**
 * Points along a planned drive.
 *
 * Stops are placed by distance along the road, not by equal hops in the
 * coordinate list — a winding stretch of highway has more points than a
 * straight one, and spacing by index would bunch them there.
 */

export type LatLng = { lat: number; lng: number }

const EARTH_KM = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

/** Running distance from the first point to every point on the path. */
export function cumulativeKm(path: LatLng[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversineKm(path[i - 1], path[i]))
  }
  return out
}

/** The point `targetKm` along the path, interpolating between vertices. */
export function pointAtKm(path: LatLng[], running: number[], targetKm: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 }
  if (path.length === 1 || targetKm <= 0) return path[0]

  const total = running[running.length - 1]
  if (targetKm >= total) return path[path.length - 1]

  for (let i = 1; i < running.length; i++) {
    if (targetKm <= running[i]) {
      const span = running[i] - running[i - 1]
      const t = span === 0 ? 0 : (targetKm - running[i - 1]) / span
      return lerp(path[i - 1], path[i], t)
    }
  }

  return path[path.length - 1]
}

/**
 * `count` visits including the start and the end, spaced evenly by distance.
 *
 * Two stops is just origin and destination. More than that fills the drive
 * between them, which is how "6 stops" becomes a stop every so many km.
 */
export function sampleAlongPath(path: LatLng[], count: number): Array<LatLng & { km: number }> {
  const n = Math.max(2, Math.min(30, Math.round(count)))
  if (path.length === 0) return []

  const running = cumulativeKm(path)
  const total = running[running.length - 1]

  return Array.from({ length: n }, (_, i) => {
    const km = n === 1 ? 0 : (total * i) / (n - 1)
    const point = pointAtKm(path, running, km)
    return { ...point, km }
  })
}

export function serializePath(path: LatLng[]): string {
  return path.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
}

export function parsePath(value: string | null | undefined): LatLng[] {
  if (!value) return []
  return value
    .split('|')
    .map((part) => {
      const [lat, lng] = part.split(',').map(Number)
      return { lat, lng }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
}

export function formatKm(km: number): string {
  if (km < 0.05) return '0 km'
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/**
 * "850 m", "4.2 km" — a distance the way somebody says it out loud.
 *
 * Separate from formatKm because the inputs are different: planned route
 * distances are kilometres from the map provider, and an arrival check is
 * metres between two coordinates, where a figure under a kilometre is the
 * normal and interesting case.
 */
export function formatMetres(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  return `${(metres / 1000).toFixed(1)} km`
}
