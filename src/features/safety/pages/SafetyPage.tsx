import { useMemo, useState } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import {
  MOCK_SCOREBOARD,
  SAFETY_STATUS_LABEL,
  SEVERITY_TONE,
  type SafetyEvent,
} from '../../../mocks/admin'
import { useFleetData } from '../../fleet-data'
import { ConfirmDialog, useToast } from '../../../components/ui'

const t = STRINGS.safety
type Tab = keyof typeof t.tabs

/** Module A11. */
export function SafetyPage() {
  const { safetyEvents, setSafetyEventStatus } = useFleetData()
  const { show } = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const [pending, setPending] = useState<{
    event: SafetyEvent
    action: 'coachable' | 'dismissed'
  } | null>(null)

  const rows = useMemo(
    () => safetyEvents.filter((e) => tab === 'all' || e.status === tab),
    [safetyEvents, tab],
  )

  const columns: Column<SafetyEvent>[] = [
    {
      key: 'driver',
      header: t.columns.driver,
      width: '190px',
      render: (e) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
            {e.initials}
          </span>
          <span className="truncate font-medium whitespace-nowrap text-ink">{e.driver}</span>
        </div>
      ),
    },
    { key: 'event', header: t.columns.event, render: (e) => e.kind },
    {
      key: 'severity',
      header: t.columns.severity,
      width: '110px',
      render: (e) => <Badge tone={SEVERITY_TONE[e.severity]}>{e.severity}</Badge>,
    },
    { key: 'location', header: t.columns.location, secondary: true, render: (e) => e.location },
    {
      key: 'at',
      header: t.columns.at,
      secondary: true,
      render: (e) => <span className="whitespace-nowrap text-ink-3">{e.at}</span>,
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'right',
      width: '230px',
      render: (e) =>
        e.status === 'new' ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setPending({ event: e, action: 'coachable' })}>
              {t.assignCoaching}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPending({ event: e, action: 'dismissed' })}
            >
              {t.dismiss}
            </Button>
          </div>
        ) : (
          <span className="text-[12.5px] text-ink-3">{SAFETY_STATUS_LABEL[e.status]}</span>
        ),
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? safetyEvents.length : safetyEvents.filter((e) => e.status === key).length

  return (
    <PageShell eyebrow="Module A11" title={t.title} description={t.description}>
      {/* Side by side only above 1536px. Below that the table needs the full
          width — six columns squeezed into 830px wraps names and places. */}
      <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
        <Panel>
          <Toolbar>
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
          <DataTable columns={columns} rows={rows} getRowKey={(e) => e.id} empty={
            <EmptyState
              title={STRINGS.empty.noMatchTitle}
              hint={STRINGS.empty.noMatchHint}
              onClear={() => setTab('all')}
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
        </Panel>

        <Panel title={t.scoreboardTitle} hint={t.scoreboardHint}>
          <ul className="divide-y divide-line">
            {MOCK_SCOREBOARD.map((row) => (
              <li key={row.rank} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-4 font-mono text-[12px] text-ink-4">{row.rank}</span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
                  {row.initials}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {row.driver}
                </span>
                <span className="font-mono text-[14px] font-semibold text-ink">{row.score}</span>
                <span
                  className={cn(
                    'w-7 text-right font-mono text-[11.5px]',
                    row.change > 0 ? 'text-ok' : row.change < 0 ? 'text-danger' : 'text-ink-4',
                  )}
                >
                  {row.change > 0 ? `+${row.change}` : row.change === 0 ? '—' : row.change}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            setSafetyEventStatus(pending.event.id, pending.action)
            show(
              pending.action === 'coachable'
                ? t.coachedToast(pending.event.driver)
                : t.dismissedToast,
            )
          }
          setPending(null)
        }}
        title={pending?.action === 'dismissed' ? t.confirmDismissTitle : t.confirmCoachTitle}
        message={
          pending
            ? pending.action === 'dismissed'
              ? t.confirmDismissMessage
              : t.confirmCoachMessage(pending.event.driver, pending.event.kind)
            : ''
        }
        confirmLabel={pending?.action === 'dismissed' ? t.confirmDismiss : t.confirmCoach}
        tone={pending?.action === 'dismissed' ? 'danger' : 'primary'}
      />
    </PageShell>
  )
}
