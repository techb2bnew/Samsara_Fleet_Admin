import { useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.forms

export function FormDetailPage() {
  const { formId } = useParams()
  const { forms, formFields } = useFleetData()
  const form = forms.find((f) => f.id === formId)

  if (!form) {
    return (
      <DetailShell backTo="/forms" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const fields = formFields[form.id] ?? []

  return (
    <DetailShell
      backTo="/forms"
      backLabel={t.back}
      title={form.name}
      subtitle={`v${form.version} · ${form.updated}`}
      badge={
        <Badge tone={form.status === 'published' ? 'success' : 'neutral'}>
          {form.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Panel title={t.detail.about}>
          <DetailList>
            <DetailRow label={t.detail.name}>{form.name}</DetailRow>
            <DetailRow label={t.detail.version}>
              <span className="font-mono">v{form.version}</span>
            </DetailRow>
            <DetailRow label={t.detail.status}>
              <Badge tone={form.status === 'published' ? 'success' : 'neutral'}>
                {form.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </DetailRow>
            <DetailRow label={t.detail.assigned}>{form.assignedTo}</DetailRow>
            <DetailRow label={t.detail.submissions}>
              <span className="font-mono">{form.submissions.toLocaleString()}</span>
            </DetailRow>
            <DetailRow label={t.detail.updated}>{form.updated}</DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.fieldsTitle} hint={t.detail.fieldsHint}>
          {fields.length === 0 ? (
            <EmptyState title={STRINGS.empty.noneYetTitle} />
          ) : (
            <ol className="divide-y divide-line">
              {fields.map((field, index) => (
                <li key={field.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 font-mono text-[12px] text-ink-4">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{field.label}</p>
                    <p className="text-[12px] text-ink-3">{field.type}</p>
                  </div>
                  <span className="text-[12px] text-ink-4">
                    {field.required ? t.detail.required : t.detail.optional}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </DetailShell>
  )
}
