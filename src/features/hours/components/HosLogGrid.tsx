import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import {
  DUTY_STATUSES,
  dutyTotals,
  formatDutyHours,
  type DutyClocks,
  type DutySegment,
  type DutyStatus,
} from '../../../mocks/compliance'

const t = STRINGS.drivers.detail

const WIDTH = 840
const HEIGHT = 208
const PAD_L = 92
const PAD_R = 56
const PAD_T = 28
const PAD_B = 26
const INNER_W = WIDTH - PAD_L - PAD_R
const INNER_H = HEIGHT - PAD_T - PAD_B

function xOf(minutes: number) {
  return PAD_L + (Math.min(1440, Math.max(0, minutes)) / 1440) * INNER_W
}

function yOf(status: DutyStatus) {
  const row = DUTY_STATUSES.indexOf(status)
  return PAD_T + (row / (DUTY_STATUSES.length - 1)) * INNER_H
}

function hourLabel(tick: number) {
  const hour = tick % 12
  return hour === 0 ? '12' : String(hour)
}

function linePath(segments: DutySegment[]) {
  if (segments.length === 0) return ''
  const parts: string[] = []
  segments.forEach((segment, index) => {
    const y = yOf(segment.status)
    const x0 = xOf(segment.from)
    const x1 = xOf(segment.to)
    if (index === 0) parts.push(`M ${x0} ${y}`)
    else parts.push(`L ${x0} ${y}`)
    parts.push(`L ${x1} ${y}`)
  })
  return parts.join(' ')
}

/** 24-hour ELD graph: off / sleeper / driving / on duty. */
export function HosLogGrid({
  segments,
  clocks,
}: {
  segments: DutySegment[]
  clocks: DutyClocks
}) {
  const totals = dutyTotals(segments)
  const path = linePath(segments)
  const ticks = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div>
      <div className="overflow-x-auto px-3 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[640px] text-ink"
          role="img"
          aria-label={t.logGraphHint}
        >
          {ticks.map((tick) => {
            const x = xOf(tick * 60)
            const noon = tick === 12
            return (
              <g key={tick}>
                <line
                  x1={x}
                  y1={PAD_T}
                  x2={x}
                  y2={PAD_T + INNER_H}
                  stroke="currentColor"
                  className={noon ? 'text-line-strong' : 'text-line'}
                  strokeWidth={noon ? 1.25 : 1}
                />
                <text
                  x={x}
                  y={16}
                  textAnchor="middle"
                  className="fill-ink-3"
                  fontSize={10}
                >
                  {hourLabel(tick)}
                </text>
              </g>
            )
          })}

          {DUTY_STATUSES.map((status) => {
            const y = yOf(status)
            return (
              <g key={status}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={PAD_L + INNER_W}
                  y2={y}
                  stroke="currentColor"
                  className="text-line"
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-ink-2"
                  fontSize={11}
                  fontWeight={500}
                >
                  {t.logStatuses[status]}
                </text>
                <text
                  x={PAD_L + INNER_W + 10}
                  y={y + 4}
                  className="fill-ink font-mono"
                  fontSize={11}
                >
                  {formatDutyHours(totals[status])}
                </text>
              </g>
            )
          })}

          {path && (
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              className="text-ink"
              strokeWidth={2.25}
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          )}

          {segments.map((segment, index) => {
            const minutes = segment.to - segment.from
            if (minutes < 10) return null
            const x = (xOf(segment.from) + xOf(segment.to)) / 2
            const y = yOf(segment.status) - 8
            return (
              <text
                key={`${segment.from}-${index}`}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-ink"
                fontSize={11}
                fontWeight={600}
              >
                {formatDutyHours(minutes)}
              </text>
            )
          })}
        </svg>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-px bg-ink sm:grid-cols-4">
        {(
          [
            ['onDuty', clocks.onDuty],
            ['driving', clocks.driving],
            ['break', clocks.break],
            ['cycle', clocks.cycle],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className={cn('bg-ink px-4 py-2.5 text-ground')}>
            <p className="text-[10.5px] font-medium tracking-[0.04em] text-ground/70 uppercase">
              {t.recap[key]}
            </p>
            <p className="font-mono text-[15px] font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
