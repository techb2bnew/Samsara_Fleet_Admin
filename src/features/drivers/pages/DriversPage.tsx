import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS, TONE_TEXT } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { DRIVER_STATUS_LABEL, DRIVER_STATUS_TONE, type Driver } from '../../../mocks/people'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { AddDriverDialog } from '../components/AddDriverDialog'

const t = STRINGS.drivers
type Tab = keyof typeof t.tabs

/** Module A04. */
export function DriversPage() {
  const { drivers } = useFleetData()
  // Opened directly by the dashboard quick action, which links to ?new=1.
  const [adding, setAdding] = useOpenOnQuery()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return drivers.filter((d) => {
      if (tab !== 'all' && d.status !== tab) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) || d.employeeNumber.toLowerCase().includes(q)
      )
    })
  }, [drivers, tab, search])

  const columns: Column<Driver>[] = [
    {
      key: 'driver',
      header: t.columns.driver,
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
            {d.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{d.name}</p>
            <p className="truncate font-mono text-[11.5px] text-ink-4">{d.employeeNumber}</p>
          </div>
        </div>
      ),
    },
    { key: 'terminal', header: t.columns.terminal, secondary: true, render: (d) => d.terminal },
    {
      key: 'status',
      header: t.columns.status,
      width: '130px',
      render: (d) => (
        <Badge tone={DRIVER_STATUS_TONE[d.status]}>{DRIVER_STATUS_LABEL[d.status]}</Badge>
      ),
    },
    {
      key: 'vehicle',
      header: t.columns.vehicle,
      render: (d) =>
        d.vehicle ?? <span className="text-ink-4">{t.noVehicle}</span>,
    },
    {
      key: 'hoursLeft',
      header: t.columns.hoursLeft,
      align: 'right',
      width: '100px',
      render: (d) => (
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
      header: t.columns.licence,
      secondary: true,
      render: (d) => (
        <div>
          <p className={d.licenceWarning ? 'font-medium text-warn' : ''}>{d.licenceExpires}</p>
          {d.licenceWarning && (
            <p className="text-[11.5px] text-warn">{t.licenceWarning}</p>
          )}
        </div>
      ),
    },
    {
      key: 'score',
      header: t.columns.score,
      align: 'right',
      width: '90px',
      render: (d) => (
        <span
          className={cn(
            'font-mono font-semibold',
            d.safetyScore >= 90
              ? TONE_TEXT.success
              : d.safetyScore >= 75
                ? 'text-ink'
                : TONE_TEXT.warning,
          )}
        >
          {d.safetyScore}
        </span>
      ),
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? drivers.length : drivers.filter((d) => d.status === key).length

  return (
    <PageShell
      eyebrow="Module A04"
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setAdding(true)}>{t.add}</Button>}
    >
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
            <EmptyState
              title={
                drivers.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                drivers.length === 0
                  ? 'Drivers added to the fleet will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                drivers.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
      </Panel>

      <AddDriverDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  )
}
