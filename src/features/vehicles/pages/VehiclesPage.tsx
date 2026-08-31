import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import {
  MOCK_WORK_ORDERS,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_TONE,
  WORK_ORDER_LABEL,
  WORK_ORDER_TONE,
  type Vehicle,
  type WorkOrder,
} from '../../../mocks/vehicles'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { AddVehicleDialog } from '../components/AddVehicleDialog'

const t = STRINGS.vehicles
type Tab = keyof typeof t.tabs

/** Module A05. */
export function VehiclesPage() {
  const { vehicles } = useFleetData()
  const [adding, setAdding] = useOpenOnQuery()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (tab !== 'all' && v.status !== tab) return false
      if (!q) return true
      return v.name.toLowerCase().includes(q) || v.plate.toLowerCase().includes(q)
    })
  }, [vehicles, tab, search])

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: t.columns.vehicle,
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{v.name}</p>
          <p className="truncate font-mono text-[11.5px] text-ink-4">{v.plate}</p>
        </div>
      ),
    },
    {
      key: 'makeModel',
      header: t.columns.makeModel,
      secondary: true,
      render: (v) => `${v.makeModel} · ${v.year}`,
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '150px',
      render: (v) => (
        <Badge tone={VEHICLE_STATUS_TONE[v.status]}>{VEHICLE_STATUS_LABEL[v.status]}</Badge>
      ),
    },
    {
      key: 'driver',
      header: t.columns.driver,
      render: (v) => v.driver ?? <span className="text-ink-4">{t.unassigned}</span>,
    },
    {
      key: 'odometer',
      header: t.columns.odometer,
      align: 'right',
      width: '120px',
      render: (v) =>
        v.odometerKm > 0 ? (
          <span className="font-mono">{v.odometerKm.toLocaleString()} km</span>
        ) : (
          <span className="text-ink-4">—</span>
        ),
    },
    {
      key: 'service',
      header: t.columns.service,
      align: 'right',
      render: (v) => {
        if (v.nextServiceKm === 0) return <span className="text-ink-4">—</span>
        if (v.serviceOverdueKm > 0) {
          return (
            <span className="font-medium text-warn">{t.overdueBy(v.serviceOverdueKm)}</span>
          )
        }
        return <span className="text-ink-3">{t.dueIn(v.nextServiceKm - v.odometerKm)}</span>
      },
    },
  ]

  const woColumns: Column<WorkOrder>[] = [
    {
      key: 'reference',
      header: t.woColumns.reference,
      width: '110px',
      render: (w) => <span className="font-mono text-ink">{w.reference}</span>,
    },
    { key: 'vehicle', header: t.woColumns.vehicle, width: '120px', render: (w) => w.vehicle },
    { key: 'job', header: t.woColumns.job, render: (w) => <span className="text-ink">{w.title}</span> },
    {
      key: 'status',
      header: t.woColumns.status,
      width: '130px',
      render: (w) => <Badge tone={WORK_ORDER_TONE[w.status]}>{WORK_ORDER_LABEL[w.status]}</Badge>,
    },
    {
      key: 'mechanic',
      header: t.woColumns.mechanic,
      secondary: true,
      render: (w) => w.mechanic ?? <span className="text-ink-4">{t.unassigned}</span>,
    },
    {
      key: 'opened',
      header: t.woColumns.opened,
      secondary: true,
      render: (w) => <span className="text-ink-3">{w.opened}</span>,
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? vehicles.length : vehicles.filter((v) => v.status === key).length

  return (
    <PageShell
      eyebrow="Module A05"
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setAdding(true)}>{t.add}</Button>}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.searchPlaceholder}
          >
            <FilterChips
              value={tab}
              onChange={setTab}
              options={(Object.keys(t.tabs) as Tab[]).map((key) => ({
                value: key,
                label: t.tabs[key],
                count: countFor(key),
              }))}
            />
          </Toolbar>
          <DataTable columns={columns} rows={rows} getRowKey={(v) => v.id}
          onRowClick={(v) => navigate(`/vehicles/${v.id}`)} empty={
            <EmptyState
              title={
                vehicles.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                vehicles.length === 0
                  ? 'Trucks and trailers added to the fleet will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                vehicles.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
        </Panel>

        <Panel title={t.workOrders} hint={t.workOrdersHint}>
          <DataTable
            columns={woColumns}
            rows={MOCK_WORK_ORDERS}
            getRowKey={(w) => w.id}
            empty={
            <EmptyState
              title={
                vehicles.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                vehicles.length === 0
                  ? 'Trucks and trailers added to the fleet will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                vehicles.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          }
          />
        </Panel>
      </div>

      <AddVehicleDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  )
}
