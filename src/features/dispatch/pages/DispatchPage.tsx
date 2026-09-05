import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { ROUTE_LABEL, ROUTE_TONE, type Route } from '../types'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { formatKm } from '../geometry'
import { PlanRouteDialog } from '../components/PlanRouteDialog'
import { AssignRouteDialog } from '../components/AssignRouteDialog'
import { RouteRowActions } from '../components/RouteRowActions'
import { COL } from '../../../components/ui/columnWidth'

const t = STRINGS.dispatch
type Tab = keyof typeof t.tabs

function shortPlace(value: string) {
  const first = value.split(',')[0]?.trim()
  return first || value
}

/** Module A08. */
export function DispatchPage() {
  const { routes } = useFleetData()
  const [planning, setPlanning] = useOpenOnQuery()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState<{ route: Route; kind: 'driver' | 'vehicle' } | null>(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return routes.filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false
      if (!q) return true
      return (
        r.reference.toLowerCase().includes(q) ||
        r.driver.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.origin.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
      )
    })
  }, [routes, tab, search])

  const columns: Column<Route>[] = [
    {
      key: 'route',
      header: t.columns.route,
      render: (r) => (
        <div className="min-w-0">
          <span className="font-mono font-medium text-ink">{r.reference}</span>
          {r.origin && r.destination && (
            <p className="mt-0.5 truncate text-[12px] text-ink-3">
              {t.via(shortPlace(r.origin), shortPlace(r.destination))}
              {r.distanceKm != null ? ` · ${formatKm(r.distanceKm)}` : ''}
            </p>
          )}
        </div>
      ),
    },
    { key: 'driver',
      width: COL.person, header: t.columns.driver, render: (r) => r.driver },
    { key: 'vehicle',
      width: COL.place, header: t.columns.vehicle, secondary: true, render: (r) => r.vehicle },
    {
      key: 'progress',
      header: t.columns.progress,
      width: COL.progress,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(r.stopsDone / r.stopsTotal) * 100}%` }}
            />
          </span>
          <span className="font-mono text-[12px] whitespace-nowrap text-ink-3">
            {t.stopsOf(r.stopsDone, r.stopsTotal)}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: COL.status,
      render: (r) => <Badge tone={ROUTE_TONE[r.status]}>{ROUTE_LABEL[r.status]}</Badge>,
    },
    {
      key: 'eta',
      width: COL.date,
      header: t.columns.eta,
      align: 'right',
      secondary: true,
      render: (r) => (
        <span className={r.status === 'late' ? 'font-medium text-danger' : 'text-ink-3'}>
          {r.eta}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: COL.actions,
      align: 'right',
      render: (r) => (
        <RouteRowActions
          route={r}
          onAssignDriver={() => setAssigning({ route: r, kind: 'driver' })}
          onAssignVehicle={() => setAssigning({ route: r, kind: 'vehicle' })}
        />
      ),
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? routes.length : routes.filter((r) => r.status === key).length

  return (
    <PageShell
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setPlanning(true)}>{t.newRoute}</Button>}
    >
      <Panel>
        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder={t.searchPlaceholder}>
          <FilterChips
            value={tab}
            onChange={setTab}
            options={(Object.keys(t.tabs) as Tab[]).map((key) => (
              {
                value: key,
                label: t.tabs[key],
                count: countFor(key),
              }
            ))}
          />
        </Toolbar>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/dispatch/${r.id}`)} empty={
            <EmptyState
              title={
                routes.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                routes.length === 0
                  ? 'Routes you plan will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                routes.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
      </Panel>

      <PlanRouteDialog
        open={planning}
        onClose={() => setPlanning(false)}
        onCreated={(route) => navigate(`/map?route=${route.id}`)}
      />
      <AssignRouteDialog
        open={assigning !== null}
        route={assigning?.route ?? null}
        kind={assigning?.kind ?? 'driver'}
        onClose={() => setAssigning(null)}
      />
    </PageShell>
  )
}
