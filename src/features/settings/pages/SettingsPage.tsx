import { useEffect, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Picker,
  useToast,
  type Column,
} from '../../../components/ui'
import { type AuditEntry, type RuleBook } from '../types'
import type { OrgSettings } from '../../fleet-data/FleetDataProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useFleetData } from '../../fleet-data'
import { DepotDialog } from '../components/DepotDialog'
import { RuleBookDialog } from '../components/RuleBookDialog'
import { formatClock } from '../../hours/totals'
import { ruleBookValue } from '../../../supabase/api'
import type { PickerGroup } from '../../../components/ui'
import type { DepotRow } from '../../../supabase/api'
import { COL } from '../../../components/ui/columnWidth'

const t = STRINGS.settings

/** Module A15. */
export function SettingsPage() {
  const { org, saveOrg, audit, depots, removeDepot, ruleBooks, removeRuleBook } =
    useFleetData()
  const { updateOrganization } = useAuth()
  const { show } = useToast()
  const [draft, setDraft] = useState(org)

  /** Null while closed; a depot when editing; 'new' when adding. */
  const [editing, setEditing] = useState<DepotRow | 'new' | null>(null)
  const [archiving, setArchiving] = useState<DepotRow | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archivingNow, setArchivingNow] = useState(false)
  /** Null while closed; a book when editing; 'new' when adding. */
  const [editingBook, setEditingBook] = useState<RuleBook | 'new' | null>(null)
  const [deletingBook, setDeletingBook] = useState<RuleBook | null>(null)
  const [bookError, setBookError] = useState<string | null>(null)
  const [deletingNow, setDeletingNow] = useState(false)
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

  async function handleDeleteBook() {
    if (!deletingBook) return
    setDeletingNow(true)
    setBookError(null)
    try {
      await removeRuleBook(deletingBook.id)
      show(t.ruleBook.removed)
      setDeletingBook(null)
    } catch (error) {
      // Refused while the organisation is still on it, and that reason is the
      // entire value of the message.
      setBookError(error instanceof Error ? error.message : t.ruleBook.inUse)
    } finally {
      setDeletingNow(false)
    }
  }

  /*
   * Both kinds of rule book in one list.
   *
   * "Not chosen yet" sits in its own unnamed group rather than among the legal
   * ones — it is the absence of a rule book, not one of them. The fleet's own
   * books get their limits as a second line, because "Winter policy" tells
   * somebody choosing between two of them nothing at all.
   */
  const ruleBookGroups: PickerGroup[] = [
    { label: '', options: [{ value: '', label: t.regulatorOptions.none }] },
    {
      label: t.ruleBook.groupBuiltIn,
      options: [
        { value: 'FMCSA', label: t.regulatorOptions.FMCSA },
        { value: 'EU', label: t.regulatorOptions.EU },
      ],
    },
    ...(ruleBooks.length > 0
      ? [
          {
            label: t.ruleBook.groupCustom,
            options: ruleBooks.map((book) => ({
              value: ruleBookValue(book.id),
              label: book.name,
              hint: t.ruleBook.summary(
                formatClock(book.dailyDriving),
                formatClock(book.cycle),
                book.cycleDays,
              ),
            })),
          },
        ]
      : []),
  ]

  const auditColumns: Column<AuditEntry>[] = [
    {
      key: 'who',
      header: t.auditColumns.who,
      width: COL.person,
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
            {a.initials}
          </span>
          <span className="truncate font-medium text-ink">{a.who}</span>
        </div>
      ),
    },
    { key: 'action', width: COL.place, header: t.auditColumns.action, render: (a) => a.action },
    { key: 'target', header: t.auditColumns.target, render: (a) => <span className="text-ink-2">{a.target}</span> },
    {
      key: 'at',
      header: t.auditColumns.at,
      align: 'right',
      width: COL.date,
      render: (a) => <span className="text-ink-3">{a.at}</span>,
    },
  ]

  return (
    <PageShell title={t.title} description={t.description}>
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
            <Picker
              label={t.fields.dot}
              hint={t.regulatorHint}
              groups={ruleBookGroups}
              value={draft.regulator}
              onChange={(regulator) =>
                setDraft((current) => ({ ...current, regulator }) satisfies OrgSettings)
              }
              action={{ label: t.ruleBook.add, onSelect: () => setEditingBook('new') }}
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

        {/*
          A panel as well as the dropdown entry.

          The dropdown can add one and choose one, but not fix a typo in one or
          get rid of one — and a wrong number in here is the mistake this whole
          feature is most likely to produce. Editing has to be reachable
          without changing which rule book the fleet is on.
        */}
        <Panel
          title={t.ruleBook.groupCustom}
          hint={t.ruleBook.hint}
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditingBook('new')}>
              {t.ruleBook.add}
            </Button>
          }
        >
          {ruleBooks.length === 0 ? (
            <EmptyState title={t.ruleBook.none} hint={t.ruleBook.hint} />
          ) : (
            <ul className="divide-y divide-line">
              {ruleBooks.map((book) => {
                const inUse = draft.regulator === ruleBookValue(book.id)
                return (
                  <li
                    key={book.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-[180px] flex-1">
                      <p className="text-[13.5px] font-medium text-ink">
                        {book.name}
                        {/* Says which one the fleet is actually on, so deleting
                            the wrong one is not a guess. */}
                        {inUse && (
                          <span className="ml-2 text-[12px] font-normal text-accent">
                            {t.ruleBook.inUseTag}
                          </span>
                        )}
                      </p>
                      <p className="text-[12.5px] text-ink-3">
                        {t.ruleBook.summary(
                          formatClock(book.dailyDriving),
                          formatClock(book.cycle),
                          book.cycleDays,
                        )}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setEditingBook(book)}>
                      {STRINGS.common.edit}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingBook(book)}>
                      {t.ruleBook.remove}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        {/*
          Alert rules were a panel here. Switched off, like the form builder
          and safety.

          The table exists and the console could read a rule and toggle it, but
          nothing ever created one and — the part that matters — nothing SENDS
          anything. There is no job reading these rules, deciding who to tell,
          and emailing or pushing it; the only mail path in the whole system is
          the driver invitation function.

          So the panel said "None are set up, so nothing is being notified",
          which reads as a promise that setting one up would change that. It
          would not. The pages, the strings and the alert_rules table are all
          still here — bring this back with the sender, not before.
        */}

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

      <RuleBookDialog
        open={editingBook !== null}
        book={editingBook === 'new' ? null : editingBook}
        onClose={() => setEditingBook(null)}
        onSaved={(message) => show(message)}
      />

      <ConfirmDialog
        open={deletingBook !== null}
        onClose={() => {
          setDeletingBook(null)
          setBookError(null)
        }}
        onConfirm={() => void handleDeleteBook()}
        title={t.ruleBook.removeTitle}
        message={bookError ?? t.ruleBook.removeMessage}
        confirmLabel={t.ruleBook.remove}
        tone="danger"
        loading={deletingNow}
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
