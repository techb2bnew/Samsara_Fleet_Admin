import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { HAS_MAPS_KEY } from '../../live-map/components/FleetMap'
import { ROUTE_LABEL, ROUTE_TONE } from '../types'
import { formatKm, formatMetres } from '../geometry'
import { AssignRouteDialog } from '../components/AssignRouteDialog'
import { RoutePathMap } from '../components/RoutePathMap'
import { hrefForDriverName, hrefForDriverThread, hrefForRouteOnMap, hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.dispatch

/**
 * One route, with its stops in visiting order.
 *
 * A stop is in one of three states, and each is a different thing to a
 * dispatcher: done and timed, the one being driven to now, or not started. The
 * next stop is called out explicitly because "which one are they on" is the
 * question this page exists to answer.
 */
export function RouteDetailPage() {
  const { routeId } = useParams()
  const { routes, routeStops, drivers, vehicles } = useFleetData()
  const [assigning, setAssigning] = useState<'driver' | 'vehicle' | null>(null)

  const route = routes.find((r) => r.id === routeId)

  if (!route) {
    return (
      <DetailShell backTo="/dispatch" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const stops = routeStops[route.id] ?? []
  const nextIndex = stops.findIndex((stop) => stop.arrivedAt === null)
  const hasPath = route.path.length >= 2 || stops.some((stop) => stop.lat != null)

  return (
    <DetailShell
      backTo="/dispatch"
      backLabel={t.back}
      title={route.reference}
      subtitle={
        route.origin && route.destination
          ? `${route.origin.split(',')[0]} → ${route.destination.split(',')[0]}${
              route.distanceKm != null ? ` · ${formatKm(route.distanceKm)}` : ''
            }`
          : `${route.driver} · ${route.vehicle}`
      }
      badge={<Badge tone={ROUTE_TONE[route.status]}>{ROUTE_LABEL[route.status]}</Badge>}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={() => setAssigning('driver')}>
            {t.detail.assignDriver}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAssigning('vehicle')}>
            {t.detail.assignVehicle}
          </Button>
          <Link to={hrefForRouteOnMap(route.id)}>
            <Button size="sm" variant="secondary">
              {t.detail.viewOnMap}
            </Button>
          </Link>
          {route.driverId && (
            <Link to={hrefForDriverThread(route.driver)}>
              <Button size="sm" variant="secondary">
                {t.detail.messageDriver}
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title={t.detail.assignment}>
            <DetailList>
              <DetailRow label={t.detail.driver}>
                {route.driverId ? (
                  <Link to={hrefForDriverName(drivers, route.driver)} className="text-accent hover:underline">
                    {route.driver}
                  </Link>
                ) : (
                  <span className="text-ink-3">{route.driver}</span>
                )}
              </DetailRow>
              <DetailRow label={t.detail.vehicle}>
                {route.vehicleId ? (
                  <Link to={hrefForVehicleName(vehicles, route.vehicle)} className="text-accent hover:underline">
                    {route.vehicle}
                  </Link>
                ) : (
                  <span className="text-ink-3">{route.vehicle}</span>
                )}
              </DetailRow>
              <DetailRow label={t.detail.status}>
                <Badge tone={ROUTE_TONE[route.status]}>{ROUTE_LABEL[route.status]}</Badge>
              </DetailRow>
              <DetailRow label={t.detail.timing}>
                <span className={route.status === 'late' ? 'font-medium text-danger' : ''}>
                  {route.eta}
                </span>
              </DetailRow>
              {route.distanceKm != null && (
                <DetailRow label={t.detail.distance}>{formatKm(route.distanceKm)}</DetailRow>
              )}
            </DetailList>
          </Panel>

          <Panel title={t.detail.progress}>
            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[22px] font-semibold text-ink">
                  {route.stopsDone}
                </span>
                <span className="text-[12.5px] text-ink-3">
                  {t.stopsOf(route.stopsDone, route.stopsTotal)}
                </span>
              </div>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(route.stopsDone / Math.max(1, route.stopsTotal)) * 100}%` }}
                />
              </span>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={t.detail.mapTitle} hint={t.detail.mapHint}>
            {hasPath && HAS_MAPS_KEY ? (
              <div className="h-[min(320px,50dvh)] overflow-hidden">
                <RoutePathMap path={route.path} stops={stops} />
              </div>
            ) : (
              <div className="px-5 py-8">
                <p className="text-[13.5px] font-medium text-ink">{t.detail.mapEmpty}</p>
                {!HAS_MAPS_KEY && (
                  <p className="mt-1 text-[12.5px] text-ink-3">{STRINGS.map.noKeyHint}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title={t.detail.stopsTitle} hint={t.detail.stopsHint}>
            {stops.length === 0 ? (
              <EmptyState title={STRINGS.empty.noneYetTitle} />
            ) : (
              <ol className="divide-y divide-line">
                {stops.map((stop, index) => {
                  const done = stop.arrivedAt !== null
                  const isNext = index === nextIndex

                  return (
                    <li key={stop.id} className="flex items-start gap-3.5 px-5 py-3.5">
                      <span
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                          done
                            ? 'bg-ok text-on-accent'
                            : isNext
                              ? 'bg-accent text-on-accent'
                              : 'bg-surface-2 text-ink-3',
                        )}
                      >
                        {stop.sequence}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">{stop.name}</p>
                        {stop.address && (
                          <p className="mt-0.5 text-[12.5px] text-ink-3">{stop.address}</p>
                        )}
                        <p className="mt-1 text-[11.5px] text-ink-4">
                          {stop.kmFromStart != null && (
                            <span className="mr-2 font-medium text-ink-2">
                              {formatKm(stop.kmFromStart)}
                            </span>
                          )}
                          {stop.window
                            ? `${t.detail.window} ${stop.window}`
                            : t.detail.noWindow}
                          {done && ` · ${t.detail.arrived} ${stop.arrivedAt}`}
                          {/*
                            Amber when nothing measured it. A dispatcher
                            looking at a finished route needs the unverified
                            ones to stand out, not to go hunting for them.
                          */}
                          {done && (
                            <span
                              className={
                                stop.arrivedDistanceM === null
                                  ? 'ml-1 text-warn'
                                  : 'ml-1 text-ink-4'
                              }
                            >
                              {stop.arrivedDistanceM === null
                                ? t.detail.arrivedUnverified
                                : t.detail.arrivedWithin(formatMetres(stop.arrivedDistanceM))}
                            </span>
                          )}
                        </p>
                      </div>

                      <Badge tone={done ? 'success' : isNext ? 'accent' : 'neutral'}>
                        {done ? t.detail.stopDone : isNext ? t.detail.stopNext : t.detail.stopPending}
                      </Badge>
                    </li>
                  )
                })}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <AssignRouteDialog
        open={assigning !== null}
        route={route}
        kind={assigning ?? 'driver'}
        onClose={() => setAssigning(null)}
      />
    </DetailShell>
  )
}
