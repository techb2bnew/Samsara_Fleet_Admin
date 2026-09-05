import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { type DocumentRow } from '../types'
import { ConfirmDialog, useToast } from '../../../components/ui'
import { csvFilename, downloadCsv } from '../../../lib/csv'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.documents
type Tab = keyof typeof t.tabs

/*
  The tabs split by why you are looking, not by document type. Compliance is
  watched for expiry; trip paperwork is what came back from a job. The type is
  still a column on every row.
*/
const TAB_CATEGORY: Record<'compliance' | 'trip', DocumentRow['category']> = {
  compliance: 'compliance',
  trip: 'trip',
}

/** Expired or within thirty days — the two states the dashboard counts. */
function isExpiring(d: DocumentRow): boolean {
  return d.expiryState === 'expired' || d.expiryState === 'soon'
}

/** Module A13. */
export function DocumentsPage() {
  const { documents, opsStatus, opsError, reloadOps } = useFleetData()
  const { show } = useToast()
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  /*
   * The tab can arrive in the URL. The dashboard's "Documents expiring" tile
   * links to ?show=expiring, so the list opens on the rows it was counting
   * rather than on everything with the reader left to find them.
   */
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('show')
  const [tab, setTab] = useState<Tab>(
    fromUrl && fromUrl in t.tabs ? (fromUrl as Tab) : 'all',
  )

  /* Kept in the URL so the filter survives a reload and can be shared. */
  function chooseTab(next: Tab) {
    setTab(next)
    if (next === 'all') params.delete('show')
    else params.set('show', next)
    setParams(params, { replace: true })
  }
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => {
      if (tab === 'expiring' && !isExpiring(d)) return false
      if (tab === 'compliance' || tab === 'trip') {
        if (d.category !== TAB_CATEGORY[tab]) return false
      }
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
      /*
        The type sits under the name rather than in a badge of its own.

        It was a grey pill in its own column, next to a FILE column that
        usually said the same word — "Insurance" beside a badge reading
        Insurance, on every row. Two columns to say one thing, and six grey
        pills of decoration down a table nobody was scanning for type.
      */
      render: (d) => (
        <div className="min-w-0">
          <span className="font-mono text-[13px] text-ink">{d.name}</span>
          <p className="text-[12px] text-ink-4">{d.kind}</p>
        </div>
      ),
    },
    { key: 'driver', header: t.columns.driver, render: (d) => d.driver },
    { key: 'vehicle', header: t.columns.vehicle, secondary: true, render: (d) => d.vehicle },
    {
      key: 'expires',
      header: t.columns.expires,
      width: '150px',
      /*
        The colour on this table belongs here and nowhere else. An expiry is
        the only thing on the screen anybody acts on: a licence that ran out
        last week is a driver who should not be in a truck this morning.

        Trip paperwork does not expire and shows a dash.
      */
      render: (d) => {
        if (!d.expires) return <span className="text-ink-4">{t.noExpiry}</span>
        if (d.expiryState === 'expired') return <Badge tone="danger">{t.expired}</Badge>
        if (d.expiryState === 'soon') return <Badge tone="warning">{d.expires}</Badge>
        return <span className="text-ink">{d.expires}</span>
      },
    },
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
      render: (d) =>
        d.sizeKb === null ? (
          <span className="text-ink-4">—</span>
        ) : (
          <span className="font-mono text-ink-3">{d.sizeKb} KB</span>
        ),
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all'
      ? documents.length
      : key === 'expiring'
        ? documents.filter(isExpiring).length
        : documents.filter((d) => d.category === TAB_CATEGORY[key]).length

  return (
    <PageShell
      title={t.title}
      description={t.description}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setExporting(true)}>
          {t.exportAll}
        </Button>
      }
    >
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
            onChange={chooseTab}
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
                documents.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                documents.length > 0
                  ? STRINGS.empty.noMatchHint
                  : tab === 'trip'
                    ? t.emptyTripHint
                    : tab === 'compliance'
                      ? t.emptyComplianceHint
                      : t.emptyTripHint
              }
              onClear={
                documents.length === 0 ? undefined : () => { chooseTab('all'); setSearch('') }
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
          if (rows.length === 0) {
            show(t.nothingToExport)
            return
          }
          const filename = csvFilename('documents')
          downloadCsv(
            filename,
            ['File', 'Type', 'Driver', 'Vehicle', 'Uploaded', 'Size (KB)'],
            rows.map((d) => [d.name, d.kind, d.driver, d.vehicle, d.uploaded, d.sizeKb ?? '']),
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
