import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { MOCK_ROUTE_STOPS, ROUTE_LABEL, ROUTE_TONE } from '../../../mocks/operations'
import { hrefForDriverName, hrefForDriverThread, hrefForVehicleName, hrefForVehicleOnMap } from '../../../lib/entityLinks'

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

  const stops = routeStops[route.id] ?? MOCK_ROUTE_STOPS[route.id] ?? []
  const nextIndex = stops.findIndex((stop) => stop.arrivedAt === null)

  return (
    <DetailShell
      backTo="/dispatch"
      backLabel={t.back}
      title={route.reference}
      subtitle={`${route.driver} · ${route.vehicle}`}
      badge={<Badge tone={ROUTE_TONE[route.status]}>{ROUTE_LABEL[route.status]}</Badge>}
      actions={
        <>
          <Link to={hrefForVehicleOnMap(route.vehicle)}>
            <Button size="sm" variant="secondary">
              {t.detail.viewOnMap}
            </Button>
          </Link>
          <Link to={hrefForDriverThread(route.driver)}>
            <Button size="sm" variant="secondary">
              {t.detail.messageDriver}
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title={t.detail.assignment}>
            <DetailList>
              <DetailRow label={t.detail.driver}>
                <Link to={hrefForDriverName(drivers, route.driver)} className="text-accent hover:underline">
                  {route.driver}
                </Link>
              </DetailRow>
              <DetailRow label={t.detail.vehicle}>
                <Link to={hrefForVehicleName(vehicles, route.vehicle)} className="text-accent hover:underline">
                  {route.vehicle}
                </Link>
              </DetailRow>
              <DetailRow label={t.detail.status}>
                <Badge tone={ROUTE_TONE[route.status]}>{ROUTE_LABEL[route.status]}</Badge>
              </DetailRow>
              <DetailRow label={t.detail.timing}>
                <span className={route.status === 'late' ? 'font-medium text-danger' : ''}>
                  {route.eta}
                </span>
              </DetailRow>
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
                  style={{ width: `${(route.stopsDone / route.stopsTotal) * 100}%` }}
                />
              </span>
            </div>
          </Panel>
        </div>

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
                      <p className="mt-0.5 text-[12.5px] text-ink-3">{stop.address}</p>
                      <p className="mt-1 text-[11.5px] text-ink-4">
                        {t.detail.window} {stop.window}
                        {done && ` · ${t.detail.arrived} ${stop.arrivedAt}`}
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
    </DetailShell>
  )
}
