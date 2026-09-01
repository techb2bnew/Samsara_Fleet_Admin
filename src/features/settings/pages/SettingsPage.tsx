import { useEffect, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, Field, useToast, type Column } from '../../../components/ui'
import { type AuditEntry } from '../../../mocks/admin'
import { useAuth } from '../../auth/AuthProvider'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.settings

/** Module A15. */
export function SettingsPage() {
  const { org, saveOrg, alertRules, toggleAlertRule, audit } = useFleetData()
  const { updateOrganization } = useAuth()
  const { show } = useToast()
  const [draft, setDraft] = useState(org)

  useEffect(() => {
    setDraft(org)
  }, [org])

  const auditColumns: Column<AuditEntry>[] = [
    {
      key: 'who',
      header: t.auditColumns.who,
      width: '190px',
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
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
        <Panel
          title={t.orgTitle}
          hint={t.orgHint}
          action={
            <Button
              size="sm"
              onClick={() => {
                saveOrg(draft)
                updateOrganization(draft.name.trim() || org.name)
                show(t.savedToast)
              }}
            >
              {t.saveOrg}
            </Button>
          }
        >
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field
              label={t.fields.name}
              value={draft.name}
              onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
            />
            <Field
              label={t.fields.country}
              value={draft.country}
              onChange={(e) => setDraft((current) => ({ ...current, country: e.target.value }))}
            />
            <Field
              label={t.fields.timezone}
              value={draft.timezone}
              onChange={(e) => setDraft((current) => ({ ...current, timezone: e.target.value }))}
            />
            <Field
              label={t.fields.dot}
              value={draft.regulator}
              onChange={(e) => setDraft((current) => ({ ...current, regulator: e.target.value }))}
              hint="Set once the operating country is confirmed."
            />
          </div>
        </Panel>

        <Panel title={t.alertsTitle} hint={t.alertsHint}>
          <ul className="divide-y divide-line">
            {alertRules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{rule.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{rule.detail}</p>
                </div>
                <span className="text-[12px] text-ink-4">
                  {t.channels}: {rule.channels}
                </span>
                <Badge tone={rule.on ? 'success' : 'neutral'}>{rule.on ? t.on : t.off}</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    toggleAlertRule(rule.id)
                    show(rule.on ? t.alertOffToast(rule.name) : t.alertOnToast(rule.name))
                  }}
                >
                  {rule.on ? t.turnOff : t.turnOn}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t.auditTitle} hint={t.auditHint}>
          <DataTable
            columns={auditColumns}
            rows={audit}
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
