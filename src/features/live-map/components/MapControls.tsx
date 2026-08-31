import { useEffect, useState } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'

const t = STRINGS.map

type MapTypeId = keyof typeof t.mapTypes

const MAP_TYPES = Object.keys(t.mapTypes) as MapTypeId[]

/**
 * Zoom and map-type controls, drawn in the console's own style.
 *
 * Google's built-in controls are switched off because they ignore the app
 * palette, do not follow the dark theme, and sit at sizes that clash with
 * everything else on the page. Driving the map through `useMap()` gives the
 * same behaviour with controls that belong to this product.
 */
export function MapControls() {
  const map = useMap()
  const [mapType, setMapType] = useState<MapTypeId>('roadmap')

  // The map can be changed by gestures too, so mirror its state rather than
  // assuming this component is the only thing that sets it.
  useEffect(() => {
    if (!map) return
    const listener = map.addListener('maptypeid_changed', () => {
      const current = map.getMapTypeId()
      if (current && MAP_TYPES.includes(current as MapTypeId)) {
        setMapType(current as MapTypeId)
      }
    })
    return () => listener.remove()
  }, [map])

  if (!map) return null

  const zoomBy = (delta: number) => {
    const zoom = map.getZoom()
    if (zoom !== undefined) map.setZoom(zoom + delta)
  }

  return (
    <>
      {/* map type — top left, away from the vehicle markers on the right */}
      <div
        role="group"
        aria-label={t.mapTypeLabel}
        className="absolute top-3 left-3 flex overflow-hidden rounded-[8px] border border-line bg-surface shadow-lg shadow-black/10"
      >
        {MAP_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              map.setMapTypeId(type)
              setMapType(type)
            }}
            aria-pressed={mapType === type}
            className={cn(
              'px-3 py-1.5 text-[12.5px] font-medium transition-colors',
              mapType === type
                ? 'bg-accent text-on-accent'
                : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {t.mapTypes[type]}
          </button>
        ))}
      </div>

      {/* zoom — bottom right, where a hand on a trackpad expects it */}
      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-[8px] border border-line bg-surface shadow-lg shadow-black/10">
        <ControlButton label={t.zoomIn} onClick={() => zoomBy(1)}>
          <path d="M12 5v14M5 12h14" />
        </ControlButton>
        <span className="h-px bg-line" aria-hidden="true" />
        <ControlButton label={t.zoomOut} onClick={() => zoomBy(-1)}>
          <path d="M5 12h14" />
        </ControlButton>
      </div>
    </>
  )
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}
