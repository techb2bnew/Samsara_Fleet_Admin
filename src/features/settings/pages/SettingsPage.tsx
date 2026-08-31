import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, DataTable, EmptyState, Field, type Column } from '../../../components/ui'
import { MOCK_ALERT_RULES, MOCK_AUDIT, type AuditEntry } from '../../../mocks/admin'
import { useAuth } from '../../auth/AuthProvider'

const t = STRINGS.settings

/** Module A15. */
export function SettingsPage() {
  const { session } = useAuth()

  const auditColumns: Column<AuditEntry>[] = [
    {
      key: 'who',
      header: t.auditColumns.who,
      width: '190px',
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2">
            {a.initials}
          </span>
          <span className="truncate font-medium text-ink">{a.who}</span>
        </div>
      ),
    },
    { key: 'action', header: t.auditColumns.action, width: '190px', render: (a) => a.action },
    { key: 'target', header: t.auditColumns.target, render: (a) => <span className="text-ink-2">{a.target}</span> },
    {
      key: 'at',
      header: t.auditColumns.at,
      align: 'right',
      width: '150px',
      render: (a) => <span className="text-ink-3">{a.at}</span>,
    },
  ]

  return (
    <PageShell eyebrow="Module A15" title={t.title} description={t.description}>
      <div className="flex flex-col gap-5">
        <Panel title={t.orgTitle} hint={t.orgHint}>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label={t.fields.name} defaultValue={session?.organization.name} />
            <Field label={t.fields.country} defaultValue="India" />
            <Field label={t.fields.timezone} defaultValue="Asia/Kolkata" />
            <Field label={t.fields.dot} defaultValue="—" hint="Set once the operating country is confirmed." />
          </div>
        </Panel>

        <Panel title={t.alertsTitle} hint={t.alertsHint}>
          <ul className="divide-y divide-line">
            {MOCK_ALERT_RULES.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{rule.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{rule.detail}</p>
                </div>
                <span className="text-[12px] text-ink-4">
                  {t.channels}: {rule.channels}
                </span>
                <Badge tone={rule.on ? 'success' : 'neutral'}>{rule.on ? t.on : t.off}</Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t.auditTitle} hint={t.auditHint}>
          <DataTable
            columns={auditColumns}
            rows={MOCK_AUDIT}
            getRowKey={(a) => a.id}
            empty={
              <EmptyState
                title={STRINGS.empty.noneYetTitle}
                hint="Changes made in this console will be recorded here."
              />
            }
          />
        </Panel>
      </div>
    </PageShell>
  )
}
