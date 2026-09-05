import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef } from 'react'
import { COLORS, STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { MAP_STATUS_LABEL, MAP_STATUS_TONE } from '../types'
import { fitToFleet } from './fitToFleet'
import type { MapVehicle } from '../types'
import { MapControls } from './MapControls'
import { formatKm, type LatLng } from '../../dispatch/geometry'

const t = STRINGS.map

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

/**
 * A Map ID is required for advanced markers. Google's DEMO_MAP_ID works out of
 * the box; supplying a real one from the Cloud console enables custom styling.
 */
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID'

export const HAS_MAPS_KEY = Boolean(API_KEY)

export type RouteMapOverlay = {
  id: string
  reference: string
  /** Stable per route, so two lines on the map are not the same blue. */
  color: string
  corridor: string
  path: LatLng[]
  stops: Array<{
    id: string
    name: string
    sequence: number
    lat: number
    lng: number
    kmFromStart: number | null
  }>
}

/**
 * Live fleet map.
 *
 * Renders Google Maps when an API key is configured. Without one the caller
 * falls back to the schematic view — the console must not break because a
 * third-party key is missing, and the rest of the module works either way.
 */
export function FleetMap({
  vehicles,
  selected,
  onSelect,
  overlays = [],
  focusedId = null,
  onSelectRoute,
}: {
  vehicles: MapVehicle[]
  /** Null until something is picked, which is the state an empty fleet is in. */
  selected: MapVehicle | null
  onSelect: (vehicle: MapVehicle) => void
  overlays?: RouteMapOverlay[]
  focusedId?: string | null
  onSelectRoute?: (routeId: string) => void
}) {
  if (!API_KEY) return null

  const focused = overlays.find((item) => item.id === focusedId) ?? null
  const hasRoutes = overlays.some((item) => item.path.length >= 2)

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId={MAP_ID}
        /*
         * A world view to start with, then FitToFleet moves it onto the
         * vehicles as soon as they load. The old default was hardcoded to
         * western India — a fleet anywhere else opened this screen looking at
         * the wrong country and had to go hunting for its own trucks.
         */
        defaultCenter={{ lat: 20, lng: 0 }}
        defaultZoom={2}
        gestureHandling="greedy"
        // Google's own controls are switched off entirely — MapControls below
        // draws zoom and map type in the console's palette instead, so they
        // follow the theme and match every other control on the page.
        disableDefaultUI
        className="h-full w-full"
      >
        {overlays.map((item, index) =>
          item.path.length >= 2 ? (
            <PlannedRoute
              key={item.id}
              overlay={item}
              focused={focused?.id === item.id}
              labelIndex={index}
              onSelect={onSelectRoute}
            />
          ) : null,
        )}

        {vehicles.map((vehicle) => (
          <AdvancedMarker
            key={vehicle.id}
            position={{ lat: vehicle.lat, lng: vehicle.lng }}
            title={`${vehicle.name} — ${MAP_STATUS_LABEL[vehicle.status]}`}
            onClick={() => onSelect(vehicle)}
          >
            <VehiclePin vehicle={vehicle} active={vehicle.id === selected?.id} />
          </AdvancedMarker>
        ))}

        {hasRoutes ? (
          <FitToOverlays overlays={overlays} focusedId={focused?.id ?? null} />
        ) : (
          <FitToFleet vehicles={vehicles} />
        )}
        {!hasRoutes && <RecentreOnSelection selected={selected} />}
        <MapControls vehicles={vehicles} />
      </Map>
    </APIProvider>
  )
}

function PlannedRoute({
  overlay,
  focused,
  labelIndex,
  onSelect,
}: {
  overlay: RouteMapOverlay
  focused: boolean
  labelIndex: number
  onSelect?: (routeId: string) => void
}) {
  const map = useMap()
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const pathKey = overlay.path.map((p) => `${p.lat},${p.lng}`).join('|')

  useEffect(() => {
    if (!map || overlay.path.length < 2) return
    const line = new google.maps.Polyline({
      path: overlay.path,
      map,
      strokeColor: overlay.color,
      strokeOpacity: focused ? 0.95 : 0.72,
      strokeWeight: focused ? 6 : 4,
      zIndex: focused ? 4 : 2,
      clickable: true,
    })
    const click = line.addListener('click', () => onSelectRef.current?.(overlay.id))
    return () => {
      click.remove()
      line.setMap(null)
    }
  }, [map, pathKey, focused, overlay.color, overlay.id, overlay.path])

  const pins = overlay.stops
  const along = 0.35 + (labelIndex % 4) * 0.12
  const labelAt =
    overlay.path[Math.min(overlay.path.length - 1, Math.floor(overlay.path.length * along))] ??
    overlay.path[0]
  const label = overlay.corridor
    ? `${overlay.reference} · ${overlay.corridor}`
    : overlay.reference

  return (
    <>
      {labelAt && (
        <AdvancedMarker
          position={labelAt}
          title={label}
          zIndex={focused ? 5 : 3}
          onClick={() => onSelect?.(overlay.id)}
        >
          <span className="flex flex-col items-center">
            <span
              className="max-w-[14rem] truncate rounded-full border border-white px-2 py-0.5 font-mono text-[10.5px] font-semibold text-white shadow-sm"
              style={{ background: overlay.color }}
            >
              {overlay.reference}
            </span>
            {focused && overlay.corridor && (
              <span className="mt-0.5 max-w-[16rem] truncate rounded-[4px] bg-surface px-1.5 py-px text-[10px] font-medium text-ink shadow-sm">
                {overlay.corridor}
              </span>
            )}
          </span>
        </AdvancedMarker>
      )}
      {pins.map((stop, index, all) => (
        <AdvancedMarker
          key={stop.id}
          position={{ lat: stop.lat, lng: stop.lng }}
          title={`${overlay.reference} · ${stop.name}`}
          zIndex={focused ? 4 : 2}
          onClick={() => onSelect?.(overlay.id)}
        >
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'grid place-items-center rounded-full border-2 font-semibold text-white',
                focused ? 'size-6 text-[10px]' : 'size-5 text-[9px]',
              )}
              style={{ background: overlay.color, borderColor: COLORS.surface }}
            >
              {index === 0 ? 'A' : index === all.length - 1 ? 'B' : String(stop.sequence)}
            </span>
            <span className="mt-0.5 max-w-[9rem] truncate rounded-[4px] bg-surface px-1 py-px text-[10px] font-medium text-ink shadow-sm">
              {stop.name}
              {focused && stop.kmFromStart != null ? ` · ${formatKm(stop.kmFromStart)}` : ''}
            </span>
          </span>
        </AdvancedMarker>
      ))}
    </>
  )
}

function FitToOverlays({
  overlays,
  focusedId,
}: {
  overlays: RouteMapOverlay[]
  focusedId: string | null
}) {
  const map = useMap()
  const focused = overlays.find((item) => item.id === focusedId)
  const points = (focused ? [focused] : overlays).flatMap((item) => item.path)
  const key = focusedId ?? overlays.map((item) => item.id).join(',')

  useEffect(() => {
    if (!map || points.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    for (const point of points) bounds.extend(point)
    map.fitBounds(bounds, 56)
  }, [map, key])

  return null
}

/**
 * Fits once, when the fleet first arrives.
 *
 * Refitting on every position update would fight the user: pan away to look at
 * one depot and the map would drag itself back a few seconds later.
 */
function FitToFleet({ vehicles }: { vehicles: MapVehicle[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (!map || fitted.current || vehicles.length === 0) return
    fitted.current = true
    fitToFleet(map, vehicles)
  }, [map, vehicles])

  return null
}

/**
 * Marker for one vehicle. Status is carried by colour, and the selected vehicle
 * additionally gets a ring — colour alone would be the only signal for a viewer
 * who cannot distinguish these hues.
 */
function VehiclePin({ vehicle, active }: { vehicle: MapVehicle; active: boolean }) {
  return (
    <span
      className={cn(
        'block size-3.5 rounded-full border-2 transition',
        TONE_SOLID[MAP_STATUS_TONE[vehicle.status]],
        active ? 'scale-125 ring-4' : 'hover:scale-110',
      )}
      style={{
        borderColor: COLORS.surface,
        ...(active ? { boxShadow: `0 0 0 4px color-mix(in srgb, ${COLORS.accent} 35%, transparent)` } : {}),
      }}
    />
  )
}

/** Pans to the vehicle chosen in the side list, so the two stay in step. */
function RecentreOnSelection({ selected }: { selected: MapVehicle | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !selected) return
    map.panTo({ lat: selected.lat, lng: selected.lng })
  }, [map, selected])

  return null
}

/** Shown in place of the map when no key is configured. */
export function MissingKeyNotice() {
  return (
    // Sits below the map rather than over it. Overlaid, it covered the bottom
    // row of markers — and on a phone, where the map is only a few hundred
    // pixels tall, it hid a good part of the fleet.
    <div className="border-t border-line bg-surface px-4 py-3">
      <p className="text-[12.5px] font-medium text-ink">{t.noKeyTitle}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{t.noKeyHint}</p>
    </div>
  )
}
