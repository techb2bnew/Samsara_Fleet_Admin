import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, EmptyState } from '../../../components/ui'
import { FleetMap, HAS_MAPS_KEY, MissingKeyNotice, type RouteMapOverlay } from '../components/FleetMap'
import { MAP_STATUS_LABEL, MAP_STATUS_TONE } from '../types'
import type { MapVehicle } from '../types'
import { useLiveMap } from '../useLiveMap'
import { useFleetData } from '../../fleet-data'
import { hrefForDriverName, hrefForVehicleName } from '../../../lib/entityLinks'
import { formatKm, cumulativeKm, pointAtKm, sampleAlongPath, type LatLng } from '../../dispatch/geometry'
import type { Route, RouteStop } from '../../dispatch/types'
import { colorsForRoutes } from '../routeColor'

const t = STRINGS.map
const LIVE_ROUTE = new Set(['planned', 'in_progress', 'late'])

function shortPlace(value: string) {
  const first = value.split(',')[0]?.trim()
  return first || value
}

function overlayFor(route: Route, stops: RouteStop[] | undefined): RouteMapOverlay | null {
  const listed = stops ?? []
  const fromStops = listed
    .filter((stop) => stop.lat != null && stop.lng != null)
    .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number }))
  const path = route.path.length >= 2 ? route.path : fromStops
  if (path.length < 2) return null
  const corridor =
    route.origin && route.destination
      ? STRINGS.dispatch.via(shortPlace(route.origin), shortPlace(route.destination))
      : ''
  return {
    id: route.id,
    reference: route.reference,
    color: '',
    corridor,
    path,
    stops: stopsAlongRoute(route, listed, path),
  }
}

/**
 * Pins on the live map. Each one belongs to this route — same colour as the
 * line — so two corridors sharing a depot are still readable.
 *
 * Coordinates come from the stop row when they were saved. If a stop has no
 * lat/lng, it is placed on the planned path at its kilometre (or evenly
 * between the ends), so a route never draws as a line with nothing on it.
 */
function stopsAlongRoute(
  route: Route,
  listed: RouteStop[],
  path: LatLng[],
): RouteMapOverlay['stops'] {
  const running = cumulativeKm(path)
  const total = running[running.length - 1] ?? 0

  const placed = listed.flatMap((stop, index, all) => {
    let lat = stop.lat
    let lng = stop.lng
    if ((lat == null || lng == null) && path.length >= 2) {
      const km =
        stop.kmFromStart ?? (all.length <= 1 ? 0 : (total * index) / (all.length - 1))
      const at = pointAtKm(path, running, km)
      lat = at.lat
      lng = at.lng
    }
    if (lat == null || lng == null) return []
    return [
      {
        id: stop.id,
        name: stop.name,
        sequence: stop.sequence,
        lat,
        lng,
        kmFromStart: stop.kmFromStart,
      },
    ]
  })

  if (placed.length >= 2) return placed

  const count = Math.max(2, listed.length || route.stopsTotal || 2)
  return sampleAlongPath(path, count).map((at, index, all) => {
    const row = listed[index]
    const isStart = index === 0
    const isEnd = index === all.length - 1
    return {
      id: row?.id ?? `${route.id}-along-${index}`,
      name:
        row?.name ||
        (isStart
          ? shortPlace(route.origin) || STRINGS.map.stopStart
          : isEnd
            ? shortPlace(route.destination) || STRINGS.map.stopEnd
            : STRINGS.map.stopNumber(index + 1)),
      sequence: row?.sequence ?? index + 1,
      lat: at.lat,
      lng: at.lng,
      kmFromStart: Math.round(at.km * 10) / 10,
    }
  })
}

/**
 * Module A03.
 *
 * Renders Google Maps when VITE_GOOGLE_MAPS_API_KEY is set, and a schematic
 * ground otherwise. The markers, the selection and the side panels are the same
 * in both cases — only what sits behind the markers changes, so the module is
 * fully reviewable before anyone buys a map key.
 */
export function LiveMapPage() {
  const [params, setParams] = useSearchParams()
  const { status, vehicles: fleet, error, reload } = useLiveMap()
  const { vehicles, drivers, routes, routeStops } = useFleetData()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  /**
   * The id is held rather than the vehicle itself, so a reload that brings back
   * fresh positions keeps the same truck selected instead of pinning the panel
   * to a stale copy of it.
   */
  const onMap = fleet ?? []
  /** Anything not offline means the feed is arriving. */
  const anyReporting = onMap.some((vehicle) => vehicle.status !== 'offline')
  const selected = onMap.find((v) => v.id === selectedId) ?? onMap[0] ?? null

  const overlayRoute = routes.find((r) => r.id === params.get('route')) ?? null
  const overlays = useMemo(() => {
    const live = routes.filter((route) => LIVE_ROUTE.has(route.status))
    const listed = new Map(live.map((route) => [route.id, route]))
    if (overlayRoute) listed.set(overlayRoute.id, overlayRoute)
    const items = [...listed.values()]
      .map((route) => overlayFor(route, routeStops[route.id]))
      .filter((item): item is RouteMapOverlay => item !== null)
    const colors = colorsForRoutes(items.map((item) => item.id))
    return items.map((item) => ({ ...item, color: colors[item.id] }))
  }, [routes, routeStops, overlayRoute])

  function focusRoute(id: string) {
    const next = new URLSearchParams(params)
    next.set('route', id)
    next.delete('vehicle')
    setParams(next, { replace: true })
  }

  /**
   * Arriving from a link like /map?vehicle=Truck%20214.
   *
   * Depends on `fleet`, not on the `onMap` fallback: that fallback builds a new
   * array on every render, which would re-run this effect on every render.
   * The parameter is cleared only once the fleet has actually loaded, or a link
   * opened before the first query lands would be thrown away unread.
   */
  useEffect(() => {
    const name = params.get('vehicle')
    if (!name || !fleet) return

    const match = fleet.find((vehicle) => vehicle.name === name)
    if (match) setSelectedId(match.id)

    const next = new URLSearchParams(params)
    next.delete('vehicle')
    setParams(next, { replace: true })
  }, [params, setParams, fleet])

  return (
    <PageShell
      eyebrow="Module A03"
      title={t.title}
      description={t.description}
      actions={
        <div className="flex items-center gap-2">
          {/* Same judgement as the dashboard, from the data this screen
              already has: something has to be reporting to say "Live". */}
          {status === 'ready' && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium',
                anyReporting
                  ? 'border-ok-line bg-ok-soft text-ok'
                  : 'border-line bg-surface-2 text-ink-3',
              )}
            >
              <span
                className={cn('size-1.5 rounded-full', anyReporting ? 'bg-ok' : 'bg-ink-4')}
                aria-hidden="true"
              />
              {anyReporting ? STRINGS.dashboard.feed.live : STRINGS.dashboard.feed.stale}
            </span>
          )}
          <Badge tone="neutral">{t.vehiclesOnMap(onMap.length)}</Badge>
          {overlays.length > 0 && (
            <Badge tone="accent">{t.routesOnMap(overlays.length)}</Badge>
          )}
          {overlayRoute && (
            <Badge tone="accent">
              {overlayRoute.distanceKm != null
                ? `${overlayRoute.reference} · ${formatKm(overlayRoute.distanceKm)}`
                : t.routeOverlay(overlayRoute.reference)}
            </Badge>
          )}
        </div>
      }
    >
      {status === 'error' && (
        <div className="mb-5" role="alert">
          <Alert tone="danger" title={t.live.loadFailed}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={reload}>
                {STRINGS.common.retry}
              </Button>
            </div>
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel>
          <div className="relative h-[min(420px,calc(100dvh-14rem))] overflow-hidden bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-surface-2))] sm:h-[520px]">
            {/* The map is always drawn, even with nothing on it. An empty fleet
                is a reason to say so over the map, not to replace the map with
                a message — the ground is half of what this screen is for. */}
            {HAS_MAPS_KEY ? (
              <FleetMap
                vehicles={onMap}
                selected={selected}
                onSelect={(v) => setSelectedId(v.id)}
                overlays={overlays}
                focusedId={overlayRoute?.id ?? null}
                onSelectRoute={focusRoute}
              />
            ) : (
              <SchematicMap
                vehicles={onMap}
                selected={selected}
                onSelect={(v) => setSelectedId(v.id)}
              />
            )}

            {/* pointer-events-none on the backdrop so panning and zooming still
                work underneath; the card itself takes no clicks either. */}
            {(status === 'loading' || (onMap.length === 0 && overlays.length === 0)) && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface/55 backdrop-blur-[1px]">
                <div className="pointer-events-none max-w-[19rem] rounded-[12px] border border-line bg-surface/95 px-5 py-4 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]">
                  <p className="text-[13.5px] font-semibold text-ink">
                    {status === 'loading' ? t.live.loading : t.live.noVehicles}
                  </p>
                  {status !== 'loading' && (
                    <p className="mt-1 text-[12.5px] text-ink-3">{t.live.noVehiclesHint}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Outside the map box, so it never covers a marker. */}
          {!HAS_MAPS_KEY && <MissingKeyNotice />}
        </Panel>

        <div className="flex flex-col gap-5">
          {overlays.length > 0 && (
            <Panel title={t.routesTitle}>
              <ul className="divide-y divide-line">
                {overlays.map((item) => {
                  const active = overlayRoute?.id === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => focusRoute(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                          active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                        )}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full ring-2 ring-surface"
                          style={{ background: item.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[13px] font-medium text-ink">
                            {item.reference}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {item.corridor
                              ? `${item.corridor} · ${t.routeStopsCount(item.stops.length)}`
                              : t.routeStopsCount(item.stops.length)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
          {selected === null ? (
            <Panel>
              <EmptyState title={t.live.noVehicles} hint={t.live.noVehiclesHint} />
            </Panel>
          ) : (
          <>
          <Panel title={selected.name} hint={selected.driver ?? t.live.noDriver} action={
            <div className="flex items-center gap-1">
              {selected.driver && (
                <Link to={hrefForDriverName(drivers, selected.driver)}>
                  <Button size="sm" variant="ghost">{t.openDriver}</Button>
                </Link>
              )}
              <Link to={hrefForVehicleName(vehicles, selected.name)}>
                <Button size="sm" variant="ghost">{t.openVehicle}</Button>
              </Link>
            </div>
          }>
            <dl className="divide-y divide-line">
              <Row label={STRINGS.drivers.columns.status}>
                <Badge tone={MAP_STATUS_TONE[selected.status]}>
                  {MAP_STATUS_LABEL[selected.status]}
                </Badge>
              </Row>
              <Row label={t.speed}>
                {selected.speedKmh > 0 ? (
                  <span className="font-mono text-ink">{selected.speedKmh} km/h</span>
                ) : (
                  <span className="text-ink-3">{t.stationary}</span>
                )}
              </Row>
              <Row label={t.lastPing}>
                <span className="text-ink-2">{selected.lastPing}</span>
              </Row>
              <Row label="Location">
                <span className="text-right text-ink-2">{selected.place}</span>
              </Row>
            </dl>
          </Panel>

          <Panel>
            <ul className="divide-y divide-line">
              {onMap.map((vehicle) => (
                <li key={vehicle.id}>
                  <button
                    onClick={() => setSelectedId(vehicle.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                      selected.id === vehicle.id ? 'bg-accent-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        TONE_SOLID[MAP_STATUS_TONE[vehicle.status]],
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {vehicle.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {vehicle.place}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-ink-4">
                      {vehicle.speedKmh > 0 ? vehicle.speedKmh : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          </>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="text-[13px]">{children}</dd>
    </div>
  )
}

/**
 * Stand-in ground used until a Google Maps key exists.
 *
 * The grid keeps a fixed 40px cell, so it is drawn without a viewBox. The roads
 * use percentage-like coordinates, which a path `d` attribute does not accept —
 * they get their own 0–100 viewBox with non-uniform scaling instead.
 */
function SchematicMap({
  vehicles,
  selected,
  onSelect,
}: {
  vehicles: MapVehicle[]
  selected: MapVehicle | null
  onSelect: (vehicle: MapVehicle) => void
}) {
  return (
    <>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M40 0H0V40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-line"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapgrid)" />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="currentColor"
          className="text-line-strong"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        >
          <path d="M0 62 Q 30 48, 55 55 T 100 40" />
          <path d="M22 0 Q 30 40, 48 62 T 70 100" />
          <path d="M100 82 Q 70 78, 52 66 T 12 44" />
        </g>
      </svg>

      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          onClick={() => onSelect(vehicle)}
          style={{ left: `${vehicle.x}%`, top: `${vehicle.y}%` }}
          aria-label={`${vehicle.name}, ${MAP_STATUS_LABEL[vehicle.status]}`}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition',
            selected?.id === vehicle.id ? 'z-10 scale-110' : 'hover:scale-110',
          )}
        >
          <span
            className={cn(
              'flex size-3.5 rounded-full ring-4',
              TONE_SOLID[MAP_STATUS_TONE[vehicle.status]],
              selected?.id === vehicle.id ? 'ring-accent/30' : 'ring-surface/60',
            )}
          />
        </button>
      ))}

      <p className="absolute top-3 right-3 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11.5px] text-ink-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        {t.schematicNote}
      </p>
    </>
  )
}
