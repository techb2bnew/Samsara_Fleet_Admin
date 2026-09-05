import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, type Column } from '../../../components/ui'
import { FIELD_TYPES, type FormDef } from '../types'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { NewFormDialog } from '../components/NewFormDialog'

const t = STRINGS.forms

/** Module A09. */
export function FormsPage() {
  const { forms } = useFleetData()
  const navigate = useNavigate()
  const [creating, setCreating] = useOpenOnQuery()

  const columns: Column<FormDef>[] = [
    {
      key: 'form',
      header: t.columns.form,
      render: (f) => <span className="font-medium text-ink">{f.name}</span>,
    },
    { key: 'fields', header: t.columns.fields, align: 'right', width: '80px', render: (f) => f.fields },
    {
      key: 'version',
      header: t.columns.version,
      align: 'right',
      width: '90px',
      render: (f) => <span className="font-mono">v{f.version}</span>,
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '120px',
      render: (f) => (
        <Badge tone={f.status === 'published' ? 'success' : 'neutral'}>
          {f.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    { key: 'assigned', header: t.columns.assigned, secondary: true, render: (f) => f.assignedTo },
    {
      key: 'submissions',
      header: t.columns.submissions,
      align: 'right',
      render: (f) => <span className="font-mono">{f.submissions.toLocaleString()}</span>,
    },
    {
      key: 'updated',
      header: t.columns.updated,
      secondary: true,
      render: (f) => <span className="text-ink-3">{f.updated}</span>,
    },
  ]

  return (
    <PageShell
      eyebrow="Module A09"
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setCreating(true)}>{t.newForm}</Button>}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <DataTable columns={columns} rows={forms} getRowKey={(f) => f.id}
          onRowClick={(f) => navigate(`/forms/${f.id}`)} empty={
            <EmptyState title={STRINGS.empty.noneYetTitle} hint="Forms you build will appear here." />
          } />
        </Panel>

        <Panel title={t.fieldTypesTitle} hint={t.fieldTypesHint}>
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {FIELD_TYPES.map((type) => (
              <span
                key={type}
                className="rounded-[7px] border border-line bg-ground px-3 py-2 text-[13px] text-ink-2"
              >
                {type}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <NewFormDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  )
}
