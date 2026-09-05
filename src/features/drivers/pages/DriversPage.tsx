import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { EMPLOYMENT_LABEL, EMPLOYMENT_TONE, type Driver } from '../types'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { AddDriverDialog } from '../components/AddDriverDialog'
import { COL } from '../../../components/ui/columnWidth'

const t = STRINGS.drivers
type Tab = keyof typeof t.tabs

/** Module A04. */
export function DriversPage() {
  const { drivers, driversStatus, driversError, reloadDrivers } = useFleetData()
  // Opened directly by the dashboard quick action, which links to ?new=1.
  const [adding, setAdding] = useOpenOnQuery()
  const [editing, setEditing] = useState<Driver | null>(null)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return drivers.filter((d) => {
      if (tab !== 'all' && d.employment !== tab) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.employeeNumber.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.vehicle ? d.vehicle.toLowerCase().includes(q) : false)
      )
    })
  }, [drivers, tab, search])

  const columns: Column<Driver>[] = [
    {
      key: 'driver',
      header: t.columns.driver,
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
            {d.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{d.name}</p>
            <p className="truncate font-mono text-[11.5px] text-ink-4">{d.employeeNumber || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'depot',
      width: COL.place, header: t.columns.depot, secondary: true, render: (d) => d.depot?.name ?? '—' },
    {
      key: 'status',
      header: t.columns.status,
      width: COL.status,
      render: (d) => (
        <Badge tone={EMPLOYMENT_TONE[d.employment]}>{EMPLOYMENT_LABEL[d.employment]}</Badge>
      ),
    },
    {
      key: 'vehicle',
      width: COL.place,
      header: t.columns.vehicle,
      render: (d) =>
        d.vehicle ?? <span className="text-ink-4">{t.noVehicle}</span>,
    },
    {
      key: 'hoursLeft',
      header: t.columns.hoursLeft,
      align: 'right',
      width: COL.figure,
      render: (d) =>
        d.hoursLeft === null ? (
          <span className="text-ink-4">—</span>
        ) : (
          <span
            className={cn(
              'font-mono',
              d.hoursLeft === '0:00' ? 'font-semibold text-danger' : 'text-ink-2',
            )}
          >
            {d.hoursLeft}
          </span>
        ),
    },
    {
      key: 'licence',
      width: COL.date,
      header: t.columns.licence,
      secondary: true,
      render: (d) =>
        d.licenceExpires === null ? (
          <span className="text-ink-4">—</span>
        ) : (
          <div>
            <p
              className={cn(
                d.licenceExpired && 'font-semibold text-danger',
                d.licenceWarning && 'font-medium text-warn',
              )}
            >
              {d.licenceExpires}
            </p>
            {d.licenceExpired && (
              <p className="text-[11.5px] font-medium text-danger">{t.licenceExpired}</p>
            )}
            {d.licenceWarning && <p className="text-[11.5px] text-warn">{t.licenceWarning}</p>}
          </div>
        ),
    },
    /*
      The safety score column was here. It is computed from safety_events,
      which nothing fills — the module is switched off, see modules.ts — so it
      showed a dash on every row, on a table the office reads every day.

      The score itself still exists on the driver record and on their profile,
      where "Not scored yet" is an answer rather than a column of dashes.
    */
    {
      key: 'actions',
      header: t.columns.actions,
      width: COL.actions,
      align: 'right',
      render: (d) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            setEditing(d)
          }}
        >
          {STRINGS.common.edit}
        </Button>
      ),
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? drivers.length : drivers.filter((d) => d.employment === key).length

  return (
    <PageShell
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setAdding(true)}>{t.add}</Button>}
    >
      {driversStatus === 'error' && (
        <div className="mb-5" role="alert">
          <Alert tone="danger" title={t.loadFailed}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{driversError}</span>
              <Button size="sm" variant="secondary" onClick={reloadDrivers}>
                {STRINGS.common.retry}
              </Button>
            </div>
          </Alert>
        </div>
      )}

      <Panel>
        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder={t.searchPlaceholder}>
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
        <DataTable columns={columns} rows={rows} getRowKey={(d) => d.id}
          onRowClick={(d) => navigate(`/drivers/${d.id}`)} empty={
            driversStatus === 'loading' ? (
              <EmptyState title={t.loading} />
            ) : (
              <EmptyState
                title={
                  drivers.length === 0
                    ? STRINGS.empty.noneYetTitle
                    : STRINGS.empty.noMatchTitle
                }
                hint={
                  drivers.length === 0 ? t.emptyHint : STRINGS.empty.noMatchHint
                }
                onClear={
                  drivers.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
                }
                clearLabel={STRINGS.empty.clearFilters}
              />
            )
          } />
      </Panel>

      <AddDriverDialog
        open={adding || editing !== null}
        driver={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
      />
    </PageShell>
  )
}
