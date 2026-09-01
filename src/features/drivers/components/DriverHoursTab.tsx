import { useMemo, useState, type ReactNode } from 'react'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { Panel } from '../../../components/layout/PageShell'
import { ArrowRightIcon, Button, EmptyState } from '../../../components/ui'
import { HosLogGrid } from '../../hours/components/HosLogGrid'
import {
  datesForPeriod,
  dutyClocksFor,
  dutyLogFor,
  formatLogColumn,
  fromIsoDate,
  isSameDay,
  logStateOn,
  LOG_STATE_LABEL,
  LOG_STATE_TONE,
  shiftAnchor,
  toIsoDate,
  type DailyLog,
} from '../../../mocks/compliance'
import type { Driver } from '../../../mocks/people'

const t = STRINGS.drivers

export function DriverHoursTab({ driver, logs }: { driver: Driver; logs: DailyLog | undefined }) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [day, setDay] = useState(today)
  const segments = dutyLogFor(driver.id, day)
  const clocks = dutyClocksFor(driver.hoursLeft)
  const label = day.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex flex-col gap-5">
      <Panel title={t.detail.logGraph} hint={t.detail.logGraphHint}>
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-line px-4 py-3 sm:px-5">
          <DayButton
            label={t.detail.previousDay}
            onClick={() => setDay((current) => shiftAnchor(current, 'day', -1))}
          >
            <ArrowRightIcon size={15} className="rotate-180" />
          </DayButton>
          <label className="relative">
            <span className="inline-flex h-8 cursor-pointer items-center rounded-[7px] border border-line bg-ground px-3 text-[13px] font-medium text-ink hover:bg-surface-2">
              {label}
            </span>
            <input
              type="date"
              value={toIsoDate(day)}
              onChange={(event) => {
                if (!event.target.value) return
                setDay(fromIsoDate(event.target.value))
              }}
              aria-label={t.detail.pickLogDate}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <DayButton
            label={t.detail.nextDay}
            onClick={() => setDay((current) => shiftAnchor(current, 'day', 1))}
          >
            <ArrowRightIcon size={15} />
          </DayButton>
          <Button size="sm" variant="ghost" disabled={isSameDay(day, today)} onClick={() => setDay(today)}>
            {t.detail.today}
          </Button>
        </div>
        <HosLogGrid segments={segments} clocks={clocks} />
      </Panel>

      <Panel title={t.detail.recentLogs}>
        {logs ? (
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {datesForPeriod('week').map((date) => {
              const state = logStateOn(logs, date)
              const tone = LOG_STATE_TONE[state]
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => setDay(date)}
                  className="flex min-w-[84px] flex-col items-center gap-1.5 rounded-[8px] px-1 py-1 hover:bg-surface-2"
                >
                  <span className="text-[11.5px] text-ink-3">{formatLogColumn(date, 'week')}</span>
                  <span
                    className={cn(
                      'h-7 w-full rounded-[4px]',
                      tone ? TONE_SOLID[tone] : 'bg-surface-2',
                      tone === 'success' && 'opacity-45',
                      isSameDay(date, day) && 'ring-1 ring-accent/50 ring-offset-1 ring-offset-surface',
                    )}
                  />
                  <span className="text-[11px] text-ink-4">{LOG_STATE_LABEL[state]}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState title={STRINGS.empty.noneYetTitle} />
        )}
      </Panel>
    </div>
  )
}

function DayButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  )
}
