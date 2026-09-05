import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useMemo } from 'react'
import { COLORS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { formatKm, type LatLng } from '../geometry'
import type { RouteStop } from '../types'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID'

export function RoutePathMap({
  path,
  stops,
}: {
  path: LatLng[]
  stops: RouteStop[]
}) {
  if (!API_KEY) return null

  const markers = stops.filter((stop) => stop.lat != null && stop.lng != null) as Array<
    RouteStop & { lat: number; lng: number }
  >
  const line = path.length >= 2 ? path : markers.map((s) => ({ lat: s.lat, lng: s.lng }))
  const center = line[0] ?? { lat: 20, lng: 78 }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={6}
        gestureHandling="greedy"
        disableDefaultUI
        className="h-full w-full"
      >
        <RouteLine path={line} />
        {markers.map((stop, index) => (
          <AdvancedMarker
            key={stop.id}
            position={{ lat: stop.lat, lng: stop.lng }}
            title={stop.name}
          >
            <StopPin
              label={index === 0 ? 'A' : index === markers.length - 1 ? 'B' : String(stop.sequence)}
              end={index === markers.length - 1}
              start={index === 0}
              km={stop.kmFromStart}
            />
          </AdvancedMarker>
        ))}
        <FitToPath path={line} />
      </Map>
    </APIProvider>
  )
}

function RouteLine({ path }: { path: LatLng[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || path.length < 2) return
    const stroke =
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
      '#D96B2B'
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: stroke,
      strokeOpacity: 0.9,
      strokeWeight: 4,
    })
    return () => line.setMap(null)
  }, [map, path])

  return null
}

function FitToPath({ path }: { path: LatLng[] }) {
  const map = useMap()
  const key = useMemo(() => path.map((p) => `${p.lat},${p.lng}`).join('|'), [path])

  useEffect(() => {
    if (!map || path.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    for (const point of path) bounds.extend(point)
    map.fitBounds(bounds, 48)
  }, [map, key, path])

  return null
}

function StopPin({
  label,
  start,
  end,
  km,
}: {
  label: string
  start: boolean
  end: boolean
  km: number | null
}) {
  return (
    <span className="flex flex-col items-center">
      <span
        className={cn(
          'grid size-6 place-items-center rounded-full border-2 text-[10px] font-semibold',
          start && 'bg-ok text-on-accent',
          end && 'bg-danger text-on-danger',
          !start && !end && 'bg-accent text-on-accent',
        )}
        style={{ borderColor: COLORS.surface }}
      >
        {label}
      </span>
      {km != null && (
        <span className="mt-0.5 rounded-[4px] bg-surface px-1 py-px text-[10px] font-medium text-ink shadow-sm">
          {formatKm(km)}
        </span>
      )}
    </span>
  )
}
