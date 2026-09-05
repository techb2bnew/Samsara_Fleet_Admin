import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import {
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_TONE,
  WORK_ORDER_LABEL,
  WORK_ORDER_TONE,
  type Vehicle,
  type WorkOrder,
} from '../types'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { AddVehicleDialog } from '../components/AddVehicleDialog'

const t = STRINGS.vehicles
type Tab = keyof typeof t.tabs

/** Module A05. */
export function VehiclesPage() {
  const { vehicles, workOrders, fleetStatus, fleetError, reloadFleet } = useFleetData()
  const [adding, setAdding] = useOpenOnQuery()
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (tab !== 'all' && v.status !== tab) return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        (v.vin ? v.vin.toLowerCase().includes(q) : false) ||
        (v.driver ? v.driver.toLowerCase().includes(q) : false)
      )
    })
  }, [vehicles, tab, search])

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: t.columns.vehicle,
      render: (v) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-ink">{v.name}
            {v.kind === 'trailer' && (
              <span className="shrink-0 rounded-[4px] border border-line bg-surface-2 px-1.5 py-px text-[10.5px] font-medium text-ink-3">
                {t.kindTrailer}
              </span>
            )}</p>
          <p className="truncate font-mono text-[11.5px] text-ink-4">{v.plate}</p>
          {v.vin && <p className="truncate font-mono text-[11px] text-ink-4">{v.vin}</p>}
        </div>
      ),
    },
    {
      key: 'makeModel',
      header: t.columns.makeModel,
      secondary: true,
      // A year nobody recorded must not read as "Tata Signa · null".
      render: (v) => (v.year === null ? v.makeModel : `${v.makeModel} · ${v.year}`),
    },
    {
      key: 'depot',
      header: t.columns.depot,
      secondary: true,
      render: (v) => v.depot?.name ?? <span className="text-ink-4">—</span>,
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
        if (v.nextServiceKm === null) return <span className="text-ink-4">{t.noSchedule}</span>
        if (v.serviceOverdueKm > 0) {
          return (
            <span className="font-medium text-warn">{t.overdueBy(v.serviceOverdueKm)}</span>
          )
        }
        return <span className="text-ink-3">{t.dueIn(v.nextServiceKm - v.odometerKm)}</span>
      },
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: '72px',
      align: 'right',
      render: (v) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            setEditing(v)
          }}
        >
          {STRINGS.common.edit}
        </Button>
      ),
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
    {
      key: 'job',
      header: t.woColumns.job,
      render: (w) => (
        <div className="min-w-0">
          <span className="text-ink">{w.title}</span>
          {/* A driver asked for this one. The workshop triages it differently
              from a scheduled service, so it cannot be left looking the same. */}
          {w.requestedByDriverName && (
            <p className="truncate text-[12px] text-accent">
              {t.raisedByDriver(w.requestedByDriverName)}
            </p>
          )}
        </div>
      ),
    },
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
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setAdding(true)}>{t.add}</Button>}
    >
      <div className="flex flex-col gap-5">
        {fleetStatus === 'error' && (
        <div className="mb-5" role="alert">
          <Alert tone="danger" title={t.loadFailed}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{fleetError}</span>
              <Button size="sm" variant="secondary" onClick={reloadFleet}>
                {STRINGS.common.retry}
              </Button>
            </div>
          </Alert>
        </div>
      )}

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
            fleetStatus === 'loading' ? (
              <EmptyState title={t.loading} />
            ) : (
              <EmptyState
                title={
                  vehicles.length === 0
                    ? STRINGS.empty.noneYetTitle
                    : STRINGS.empty.noMatchTitle
                }
                hint={vehicles.length === 0 ? t.emptyHint : STRINGS.empty.noMatchHint}
                onClear={
                  vehicles.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
                }
                clearLabel={STRINGS.empty.clearFilters}
              />
            )
          } />
        </Panel>

        <Panel title={t.workOrders} hint={t.workOrdersHint}>
          <DataTable
            columns={woColumns}
            rows={workOrders}
            getRowKey={(w) => w.id}
            onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
            empty={
              fleetStatus === 'loading' ? (
                <EmptyState title={t.loading} />
              ) : (
                <EmptyState title={t.noWorkOrders} hint={t.noWorkOrdersHint} />
              )
            }
          />
        </Panel>
      </div>

      <AddVehicleDialog
        open={adding || editing !== null}
        vehicle={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
      />
    </PageShell>
  )
}
