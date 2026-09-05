import type { ReactNode } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { ArrowRightIcon, Button, ChevronDownIcon, FilterChips } from '../../../components/ui'
import { fromIsoDate, fromIsoMonth, isCurrentPeriod, shiftAnchor, toIsoDate, toIsoMonth, type HoursPeriod } from '../dates'

const t = STRINGS.hours

export function LogPeriodControls({
  period,
  onPeriodChange,
  anchor,
  onAnchorChange,
  today,
  label,
}: {
  period: HoursPeriod
  onPeriodChange: (period: HoursPeriod) => void
  anchor: Date
  onAnchorChange: (date: Date) => void
  today: Date
  label: string
}) {
  const onCurrent = isCurrentPeriod(period, anchor, today)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div role="group" aria-label={t.periodAria}>
        <FilterChips
          options={[
            { value: 'day', label: t.period.day },
            { value: 'week', label: t.period.week },
            { value: 'month', label: t.period.month },
          ]}
          value={period}
          onChange={onPeriodChange}
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <IconButton
          label={t.previousPeriod[period]}
          onClick={() => onAnchorChange(shiftAnchor(anchor, period, -1))}
        >
          <ArrowRightIcon size={15} className="rotate-180" />
        </IconButton>

        <label className="relative min-w-0">
          <span className="inline-flex h-8 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-line bg-ground px-3 text-[13px] font-medium whitespace-nowrap text-ink hover:bg-surface-2">
            {label}
            <ChevronDownIcon size={13} className="text-ink-4" />
          </span>
          {period === 'month' ? (
            <input
              type="month"
              value={toIsoMonth(anchor)}
              onChange={(event) => {
                if (!event.target.value) return
                onAnchorChange(fromIsoMonth(event.target.value))
              }}
              aria-label={t.pickMonth}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          ) : (
            <input
              type="date"
              value={toIsoDate(anchor)}
              onChange={(event) => {
                if (!event.target.value) return
                onAnchorChange(fromIsoDate(event.target.value))
              }}
              aria-label={t.pickDate}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          )}
        </label>

        <IconButton
          label={t.nextPeriod[period]}
          onClick={() => onAnchorChange(shiftAnchor(anchor, period, 1))}
        >
          <ArrowRightIcon size={15} />
        </IconButton>

        <Button
          size="sm"
          variant="ghost"
          disabled={onCurrent}
          onClick={() => onAnchorChange(today)}
        >
          {t.jumpToToday}
        </Button>
      </div>
    </div>
  )
}

function IconButton({
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
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2',
        'transition-colors hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
