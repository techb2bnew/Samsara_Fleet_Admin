import { useEffect, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Select,
  useToast,
  type Column,
} from '../../../components/ui'
import { type AuditEntry, type OrgSettings } from '../types'
import { useAuth } from '../../auth/AuthProvider'
import { useFleetData } from '../../fleet-data'
import { DepotDialog } from '../components/DepotDialog'
import type { DepotRow } from '../../../supabase/api'

const t = STRINGS.settings

/** Module A15. */
export function SettingsPage() {
  const { org, saveOrg, alertRules, toggleAlertRule, audit, depots, removeDepot } = useFleetData()
  const { updateOrganization } = useAuth()
  const { show } = useToast()
  const [draft, setDraft] = useState(org)

  /** Null while closed; a depot when editing; 'new' when adding. */
  const [editing, setEditing] = useState<DepotRow | 'new' | null>(null)
  const [archiving, setArchiving] = useState<DepotRow | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archivingNow, setArchivingNow] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(org)
  }, [org])

  async function handleSaveOrg() {
    setSavingOrg(true)
    setOrgSaveError(null)
    try {
      await saveOrg(draft)
      updateOrganization(draft.name.trim() || org.name)
      show(t.savedToast)
    } catch (error) {
      setOrgSaveError(error instanceof Error ? error.message : t.saveFailed)
    } finally {
      setSavingOrg(false)
    }
  }

  async function handleArchive() {
    if (!archiving) return
    setArchivingNow(true)
    setArchiveError(null)
    try {
      await removeDepot(archiving.id)
      show(t.depots.archivedToast(archiving.name))
      setArchiving(null)
    } catch (error) {
      // Refused while drivers or vehicles are still based there, and the
      // reason is the whole point of the message.
      setArchiveError(error instanceof Error ? error.message : t.depots.archiveFailed)
    } finally {
      setArchivingNow(false)
    }
  }

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
            <Button size="sm" onClick={() => void handleSaveOrg()} loading={savingOrg}>
              {t.saveOrg}
            </Button>
          }
        >
          {orgSaveError && (
            <div className="px-5 pt-4" role="alert">
              <Alert tone="danger">{orgSaveError}</Alert>
            </div>
          )}
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
            {/*
              A picker, not a text box. The driver app matches this string
              against a fixed list, so "FMCSA (US)" or "India" parsed to
              nothing and every hours clock in the app went to a dash with no
              explanation anywhere. Two spellings that had to agree, and only
              one of them was written down.
            */}
            <Select
              label={t.fields.dot}
              hint={t.regulatorHint}
              options={[
                { value: '', label: t.regulatorOptions.none },
                { value: 'FMCSA', label: t.regulatorOptions.FMCSA },
                { value: 'EU', label: t.regulatorOptions.EU },
              ]}
              value={draft.regulator}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  regulator: e.target.value as OrgSettings['regulator'],
                }))
              }
            />
          </div>
        </Panel>

        <Panel
          title={t.depots.title}
          hint={t.depots.hint}
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              {t.depots.add}
            </Button>
          }
        >
          {depots.length === 0 ? (
            <EmptyState title={t.depots.emptyTitle} hint={t.depots.emptyHint} />
          ) : (
            <ul className="divide-y divide-line">
              {depots.map((depot) => (
                <li
                  key={depot.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {depot.name}
                      {depot.code && <span className="ml-2 text-[12px] text-ink-4">{depot.code}</span>}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-ink-3">
                      {t.depots.based(depot.drivers, depot.vehicles)}
                      {depot.address ? ` · ${depot.address}` : ''}
                    </p>
                  </div>
                  {/* The timezone is here rather than hidden in the dialog
                      because it decides where each driver's legal day starts,
                      and a wrong one is invisible until an audit. */}
                  <span className="text-[12px] text-ink-4">{depot.timezone}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(depot)}>
                      {t.depots.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setArchiveError(null)
                        setArchiving(depot)
                      }}
                    >
                      {t.depots.archive}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.alertsTitle} hint={t.alertsHint}>
          {alertRules.length === 0 ? (
            <EmptyState title={t.noAlertRules} hint={t.noAlertRulesHint} />
          ) : (
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
          )}
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

      <DepotDialog
        open={editing !== null}
        depot={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={() => void handleArchive()}
        title={t.depots.archiveTitle}
        message={archiveError ?? t.depots.archiveMessage(archiving?.name ?? '')}
        confirmLabel={t.depots.archive}
        tone="danger"
        loading={archivingNow}
      />
    </PageShell>
  )
}
