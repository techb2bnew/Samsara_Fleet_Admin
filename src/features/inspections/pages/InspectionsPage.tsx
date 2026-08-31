import { useMemo, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import {
  INSPECTION_LABEL,
  INSPECTION_TONE,
  MOCK_INSPECTIONS,
  type Inspection,
} from '../../../mocks/compliance'

const t = STRINGS.inspections
type Tab = keyof typeof t.tabs

/** Module A07. */
export function InspectionsPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_INSPECTIONS.filter((i) => {
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
    { key: 'driver', header: t.columns.driver, render: (i) => i.driver },
    { key: 'type', header: t.columns.type, width: '110px', render: (i) => i.type },
    {
      key: 'submitted',
      header: t.columns.submitted,
      secondary: true,
      render: (i) => <span className="text-ink-3">{i.submitted}</span>,
    },
    {
      key: 'defects',
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
      width: '150px',
      render: (i) => <Badge tone={INSPECTION_TONE[i.status]}>{INSPECTION_LABEL[i.status]}</Badge>,
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? MOCK_INSPECTIONS.length : MOCK_INSPECTIONS.filter((i) => i.status === key).length

  return (
    <PageShell eyebrow="Module A07" title={t.title} description={t.description}>
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
        <DataTable columns={columns} rows={rows} getRowKey={(i) => i.id} empty={
            <EmptyState
              title={
                MOCK_INSPECTIONS.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                MOCK_INSPECTIONS.length === 0
                  ? 'Inspections filed by drivers will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                MOCK_INSPECTIONS.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
      </Panel>
    </PageShell>
  )
}
