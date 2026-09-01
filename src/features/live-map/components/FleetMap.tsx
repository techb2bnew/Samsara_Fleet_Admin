import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import { COLORS, STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { MAP_STATUS_LABEL, MAP_STATUS_TONE, type MapVehicle } from '../../../mocks/admin'
import { MapControls } from './MapControls'

const t = STRINGS.map

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

/**
 * A Map ID is required for advanced markers. Google's DEMO_MAP_ID works out of
 * the box; supplying a real one from the Cloud console enables custom styling.
 */
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID'

export const HAS_MAPS_KEY = Boolean(API_KEY)

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
}: {
  vehicles: MapVehicle[]
  selected: MapVehicle
  onSelect: (vehicle: MapVehicle) => void
}) {
  if (!API_KEY) return null

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId={MAP_ID}
        defaultCenter={{ lat: 19.1, lng: 73.85 }}
        defaultZoom={8}
        gestureHandling="greedy"
        // Google's own controls are switched off entirely — MapControls below
        // draws zoom and map type in the console's palette instead, so they
        // follow the theme and match every other control on the page.
        disableDefaultUI
        className="h-full w-full"
      >
        {vehicles.map((vehicle) => (
          <AdvancedMarker
            key={vehicle.id}
            position={{ lat: vehicle.lat, lng: vehicle.lng }}
            title={`${vehicle.name} — ${MAP_STATUS_LABEL[vehicle.status]}`}
            onClick={() => onSelect(vehicle)}
          >
            <VehiclePin vehicle={vehicle} active={vehicle.id === selected.id} />
          </AdvancedMarker>
        ))}

        <RecentreOnSelection selected={selected} />
        <MapControls />
      </Map>
    </APIProvider>
  )
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
function RecentreOnSelection({ selected }: { selected: MapVehicle }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
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
