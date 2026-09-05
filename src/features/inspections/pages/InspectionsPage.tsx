import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { INSPECTION_LABEL, INSPECTION_TONE, type Inspection } from '../types'
import { DefectRow } from '../components/DefectActions'
import { useFleetData } from '../../fleet-data'
import { COL } from '../../../components/ui/columnWidth'

const t = STRINGS.inspections
type Tab = keyof typeof t.tabs


/** Module A07. */
export function InspectionsPage() {
  const { inspections, reportedDefects, opsStatus, opsError, reloadOps } = useFleetData()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inspections.filter((i) => {
      if (tab !== 'all' && i.status !== tab) return false
      if (!q) return true
      return i.vehicle.toLowerCase().includes(q) || i.driver.toLowerCase().includes(q)
    })
  }, [tab, search])

  const columns: Column<Inspection>[] = [
    {
      key: 'vehicle',
      header: t.columns.vehicle,
      render: (i) => <span className="font-medium text-ink">{i.vehicle}</span>,
    },
    { key: 'driver', width: COL.person, header: t.columns.driver, render: (i) => i.driver },
    { key: 'type', width: COL.status, header: t.columns.type, render: (i) => i.type },
    {
      key: 'submitted',
      width: COL.date,
      header: t.columns.submitted,
      secondary: true,
      render: (i) => <span className="text-ink-3">{i.submitted}</span>,
    },
    {
      key: 'defects',
      width: COL.count,
      header: t.columns.defects,
      render: (i) =>
        i.defects === 0 ? (
          <span className="text-ink-4">{t.noDefects}</span>
        ) : (
          <div>
            <span className="font-semibold text-ink">{i.defects}</span>
            {i.worstDefect && (
              <p className="text-[12px] text-ink-3">{i.worstDefect}</p>
            )}
          </div>
        ),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: COL.status,
      render: (i) => <Badge tone={INSPECTION_TONE[i.status]}>{INSPECTION_LABEL[i.status]}</Badge>,
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? inspections.length : inspections.filter((i) => i.status === key).length

  return (
    <PageShell title={t.title} description={t.description}>
      {opsStatus === 'error' && (
        <div className="mb-5" role="alert">
          <Alert tone="danger" title={t.loadFailed}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{opsError}</span>
              <Button size="sm" variant="secondary" onClick={reloadOps}>
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
        <DataTable columns={columns} rows={rows} getRowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/inspections/${i.id}`)} empty={
            <EmptyState
              title={
                inspections.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                inspections.length === 0
                  ? 'Inspections filed by drivers will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                inspections.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
      </Panel>

      {/*
        Defects a driver raised on their own, with no inspection behind them —
        "AC not working", reported mid-route. The schema allows it (a defect's
        submission_id is nullable) and the app is meant to, so they need a home
        of their own: they have no inspection to sit under, and until this
        panel existed the office never saw them at all.

        Hidden when there are none rather than showing an empty box: this is a
        second list on a screen that is about the first one.
      */}
      {reportedDefects.length > 0 && (
        <div className="mt-5">
          <Panel title={t.reportedTitle} hint={t.reportedHint}>
            <ul className="divide-y divide-line">
              {reportedDefects.map((defect) => (
                <DefectRow key={defect.id} defect={defect} vehicleName={defect.vehicle} />
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </PageShell>
  )
}
