import type { MapVehicle } from '../types'

export type { MapVehicle }

/**
 * Moves and zooms the map so every vehicle with a position is on screen.
 *
 * A single vehicle has no bounds to fit — fitBounds on a zero-size box zooms
 * to street level — so that case pans and picks a sensible zoom instead.
 *
 * Vehicles that have never reported sit at 0,0. Fitting to those would drag
 * the map into the Atlantic, so they are left out.
 */
export function fitToFleet(map: google.maps.Map | null, vehicles: MapVehicle[]) {
  if (!map) return
  const located = vehicles.filter((v) => v.lat !== 0 || v.lng !== 0)
  if (located.length === 0) return

  if (located.length === 1) {
    map.panTo({ lat: located[0].lat, lng: located[0].lng })
    map.setZoom(12)
    return
  }

  const bounds = new google.maps.LatLngBounds()
  for (const vehicle of located) bounds.extend({ lat: vehicle.lat, lng: vehicle.lng })
  // Padding, so a truck on the edge is not hidden under the controls.
  map.fitBounds(bounds, 64)
}
