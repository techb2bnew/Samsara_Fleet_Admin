import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { MOCK_DOCUMENTS, type DocumentRow } from '../../../mocks/operations'
import { ConfirmDialog, useToast } from '../../../components/ui'
import { csvFilename, downloadCsv } from '../../../lib/csv'

const t = STRINGS.documents
type Tab = keyof typeof t.tabs

const TAB_KIND: Record<Exclude<Tab, 'all'>, DocumentRow['kind']> = {
  bol: 'Bill of lading',
  pod: 'Proof of delivery',
  receipt: 'Receipt',
  fuel: 'Fuel docket',
}

/** Module A13. */
export function DocumentsPage() {
  const { show } = useToast()
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_DOCUMENTS.filter((d) => {
      if (tab !== 'all' && d.kind !== TAB_KIND[tab]) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.driver.toLowerCase().includes(q) ||
        d.vehicle.toLowerCase().includes(q)
      )
    })
  }, [tab, search])

  const columns: Column<DocumentRow>[] = [
    {
      key: 'file',
      header: t.columns.file,
      render: (d) => <span className="font-mono text-[13px] text-ink">{d.name}</span>,
    },
    {
      key: 'kind',
      header: t.columns.kind,
      width: '170px',
      render: (d) => <Badge tone="neutral">{d.kind}</Badge>,
    },
    { key: 'driver', header: t.columns.driver, render: (d) => d.driver },
    { key: 'vehicle', header: t.columns.vehicle, secondary: true, render: (d) => d.vehicle },
    {
      key: 'uploaded',
      header: t.columns.uploaded,
      secondary: true,
      render: (d) => <span className="text-ink-3">{d.uploaded}</span>,
    },
    {
      key: 'size',
      header: t.columns.size,
      align: 'right',
      width: '90px',
      render: (d) => <span className="font-mono text-ink-3">{d.sizeKb} KB</span>,
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all'
      ? MOCK_DOCUMENTS.length
      : MOCK_DOCUMENTS.filter((d) => d.kind === TAB_KIND[key]).length

  return (
    <PageShell
      eyebrow="Module A13"
      title={t.title}
      description={t.description}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setExporting(true)}>
          {t.exportAll}
        </Button>
      }
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
          onRowClick={(d) => navigate(`/documents/${d.id}`)} empty={
            <EmptyState
              title={
                MOCK_DOCUMENTS.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                MOCK_DOCUMENTS.length === 0
                  ? 'Paperwork uploaded from the cab will appear here.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                MOCK_DOCUMENTS.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
      </Panel>

      <ConfirmDialog
        open={exporting}
        onClose={() => setExporting(false)}
        onConfirm={() => {
          setExporting(false)
          const filename = csvFilename('documents')
          downloadCsv(
            filename,
            ['File', 'Type', 'Driver', 'Vehicle', 'Uploaded', 'Size (KB)'],
            rows.map((d) => [d.name, d.kind, d.driver, d.vehicle, d.uploaded, d.sizeKb]),
          )
          show(STRINGS.export.started(filename))
        }}
        title={t.confirmExportTitle}
        message={t.confirmExportMessage(rows.length)}
        confirmLabel={t.confirmExport}
      />
    </PageShell>
  )
}
