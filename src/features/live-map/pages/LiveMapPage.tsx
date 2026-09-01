import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button } from '../../../components/ui'
import { FleetMap, HAS_MAPS_KEY, MissingKeyNotice } from '../components/FleetMap'
import {
  MAP_STATUS_LABEL,
  MAP_STATUS_TONE,
  MOCK_MAP_VEHICLES,
  type MapVehicle,
} from '../../../mocks/admin'
import { useFleetData } from '../../fleet-data'
import { hrefForDriverName, hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.map

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
  const [selected, setSelected] = useState<MapVehicle>(MOCK_MAP_VEHICLES[0])
  const { vehicles, drivers } = useFleetData()

  useEffect(() => {
    const name = params.get('vehicle')
    if (!name) return
    const match = MOCK_MAP_VEHICLES.find((vehicle) => vehicle.name === name)
    if (match) setSelected(match)
    const next = new URLSearchParams(params)
    next.delete('vehicle')
    setParams(next, { replace: true })
  }, [params, setParams])

  return (
    <PageShell
      eyebrow="Module A03"
      title={t.title}
      description={t.description}
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-soft px-2.5 py-1 text-[12px] font-medium text-ok">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
            {STRINGS.dashboard.liveNow}
          </span>
          <Badge tone="neutral">{t.vehiclesOnMap(MOCK_MAP_VEHICLES.length)}</Badge>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel>
          <div className="relative h-[min(420px,calc(100dvh-14rem))] overflow-hidden bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-surface-2))] sm:h-[520px]">
            {HAS_MAPS_KEY ? (
              <FleetMap vehicles={MOCK_MAP_VEHICLES} selected={selected} onSelect={setSelected} />
            ) : (
              <SchematicMap selected={selected} onSelect={setSelected} />
            )}
          </div>
          {/* Outside the map box, so it never covers a marker. */}
          {!HAS_MAPS_KEY && <MissingKeyNotice />}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title={selected.name} hint={selected.driver ?? undefined} action={
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
              {MOCK_MAP_VEHICLES.map((vehicle) => (
                <li key={vehicle.id}>
                  <button
                    onClick={() => setSelected(vehicle)}
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
  selected,
  onSelect,
}: {
  selected: MapVehicle
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

      {MOCK_MAP_VEHICLES.map((vehicle) => (
        <button
          key={vehicle.id}
          onClick={() => onSelect(vehicle)}
          style={{ left: `${vehicle.x}%`, top: `${vehicle.y}%` }}
          aria-label={`${vehicle.name}, ${MAP_STATUS_LABEL[vehicle.status]}`}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition',
            selected.id === vehicle.id ? 'z-10 scale-110' : 'hover:scale-110',
          )}
        >
          <span
            className={cn(
              'flex size-3.5 rounded-full ring-4',
              TONE_SOLID[MAP_STATUS_TONE[vehicle.status]],
              selected.id === vehicle.id ? 'ring-accent/30' : 'ring-surface/60',
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
