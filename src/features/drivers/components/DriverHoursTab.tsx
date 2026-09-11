import { useMemo, useState, type ReactNode } from 'react'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { Panel } from '../../../components/layout/PageShell'
import { ArrowRightIcon, Button, EmptyState, RingGauge, type Arc } from '../../../components/ui'
import { HosLogGrid } from '../../hours/components/HosLogGrid'
import { dayRecap, drivingMinutes, onDutyMinutes, formatClock } from '../../hours/totals'
import { datesForPeriod, formatLogColumn, fromIsoDate, isSameDay, shiftAnchor, toIsoDate } from '../../hours/dates'
import {
  logStateOn,
  LOG_STATE_LABEL,
  LOG_STATE_TONE,
  type DailyLog,
} from '../../hours/types'
import type { Driver } from '../types'
import { useFleetData } from '../../fleet-data'
import { recapFor } from '../../hours/rules'

const t = STRINGS.drivers

/** The last half hour. Mirrors the driver app's HosRecap. */
const WARN_AT = 30

export function DriverHoursTab({ driver, logs }: { driver: Driver; logs: DailyLog | undefined }) {
  const { dutySegmentsFor, cycleWindowFor, limits } = useFleetData()
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [day, setDay] = useState(today)
  const segments = dutySegmentsFor(driver.id, day)

  /*
   * All four recap figures are measured from the duty events — hours used, not
   * hours left. Remaining time needs a limit, the limit depends on the
   * regulator, and mixing the two is how a recap ends up reading backwards.
   *
   * Null on a day with nothing recorded: that is not a day of zeroes, and the
   * grid shows dashes for it.
   */
  const clocks = useMemo(
    () => dayRecap(segments, cycleWindowFor(driver.id, day)),
    [segments, cycleWindowFor, driver.id, day],
  )

  /** The week's totals, from the same events the graph draws. */
  const week = useMemo(() => {
    const days = datesForPeriod('week', day).map((date) => dutySegmentsFor(driver.id, date))
    return {
      driving: days.reduce((sum, segs) => sum + drivingMinutes(segs), 0),
      onDuty: days.reduce((sum, segs) => sum + onDutyMinutes(segs), 0),
      worked: days.filter((segs) => onDutyMinutes(segs) > 0).length,
    }
  }, [dutySegmentsFor, driver.id, day])
  const label = day.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  /*
   * What is LEFT, next to the graph that shows what was used.
   *
   * The office had neither: dayRecap answers "how long did they work", and the
   * question a dispatcher actually asks before sending one more load is "how
   * much have they got". The driver reads exactly these four figures on their
   * phone, so an argument about whether there is time for another drop is now
   * two people reading the same numbers.
   */
  const remaining = useMemo(
    () => recapFor(limits, segments, cycleWindowFor(driver.id, day)),
    [limits, segments, cycleWindowFor, driver.id, day],
  )

  /*
   * Label, what is left, what it is left out of, and the colour of the status
   * it belongs to — the same four the driver's buttons use.
   *
   * Cycle has none of its own: it spans eight days and belongs to no single
   * status, so it takes plain ink rather than borrowing one it is not.
   */
  const remainingCells: Array<[string, number | null, number | null, string, number]> = [
    [t.detail.leftOnDuty, remaining.onDuty, limits?.dutyWindow ?? null, 'var(--color-duty-onduty)', remaining.over.onDuty ?? 0],
    [t.detail.leftDriving, remaining.driving, limits?.dailyDriving ?? null, 'var(--color-duty-driving)', remaining.over.driving ?? 0],
    [t.detail.leftBreak, remaining.breakIn, limits?.drivingBeforeBreak ?? null, 'var(--color-duty-off)', remaining.over.breakIn ?? 0],
    [t.detail.leftRest, remaining.restOwed, limits?.dailyRest ?? null, 'var(--color-duty-sleeper)', 0],
    [t.detail.leftLoad, remaining.loadLeft, limits?.maxOnDuty ?? null, 'var(--color-duty-onduty)', remaining.over.loadLeft ?? 0],
    [t.detail.leftCycle, remaining.cycle, limits?.cycle ?? null, 'var(--color-ink)', remaining.over.cycle ?? 0],
  ]
  /* A clock the rule book has no rule for is dropped, not shown as a dash —
     the EU has no on-duty window at all. */
  const shownCells = remainingCells.filter(([, value]) => value !== null)

  return (
    <div className="flex flex-col gap-5">
      <Panel title={t.detail.leftTitle} hint={t.detail.leftHint}>
        {shownCells.length === 0 ? (
          <EmptyState title={t.detail.leftNoRules} hint={t.detail.leftNoRulesHint} />
        ) : (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5 px-4 py-5 sm:px-5">
            {shownCells.map(([label, value, limit, status, over]) => {
              const left = value ?? 0

              /*
               * What the ring is a picture OF changes once a limit is passed.
               *
               * Inside the limit it is the allowance, draining. Past it the
               * ring becomes the time actually spent: the limit's share in the
               * status colour and the rest in red, which says WHERE the line
               * was crossed rather than only that it was.
               */
              const arcs: Arc[] =
                over > 0 && limit
                  ? [
                      { portion: limit / (limit + over), color: status },
                      { portion: over / (limit + over), color: 'var(--color-danger)' },
                    ]
                  : [
                      {
                        portion: value !== null && limit && limit > 0 ? value / limit : 0,
                        color: status,
                      },
                    ]

              const figure =
                over > 0 || left <= 0
                  ? 'text-danger'
                  : left <= WARN_AT
                    ? 'text-warn'
                    : 'text-ink'

              return (
                <div key={label} className="flex flex-col items-center gap-2">
                  <span className="text-[11.5px] font-medium uppercase tracking-wide text-ink-4">
                    {label}
                  </span>
                  <RingGauge size={78} stroke={7} arcs={arcs}>
                    {/* Past the limit the figure counts UP and wears a plus:
                        "0:00 left" is the same thing a second before a clock
                        runs out and an hour after. */}
                    <span className={cn('font-mono text-[13.5px] font-medium', figure)}>
                      {over > 0 ? `+${formatClock(over)}` : formatClock(left)}
                    </span>
                  </RingGauge>
                  {/* What the ring is a fraction of. Without it the arc is a
                      decoration and the figure has no scale. */}
                  <span className="font-mono text-[11.5px] text-ink-4">
                    {limit === null ? '' : t.detail.leftOfTotal(formatClock(limit))}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

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

      {/* The week beside the day. A single day answers "was yesterday legal";
          the week answers "is this driver being worked too hard", which is the
          question that turns up in a roster review. */}
      <Panel title={t.detail.weekTitle} hint={t.detail.weekHint}>
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {(
            [
              [t.detail.weekDriving, formatClock(week.driving)],
              [t.detail.weekOnDuty, formatClock(week.onDuty)],
              [t.detail.weekDays, String(week.worked)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface px-5 py-3.5">
              <p className="text-[11px] font-medium tracking-[0.05em] text-ink-4 uppercase">
                {label}
              </p>
              <p className="mt-0.5 font-mono text-[19px] font-semibold tabular-nums text-ink">
                {value}
              </p>
            </div>
          ))}
        </div>
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
