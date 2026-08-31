import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONE_SURFACE, type Tone } from '../../constants'

/**
 * State is encoded in shape and colour together, so a status reads at a glance
 * without having to be decoded from the text alone.
 *
 * The tone vocabulary is shared with Alert and every status dot in the console,
 * so "warning" looks the same everywhere.
 */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[11.5px] font-medium whitespace-nowrap',
        TONE_SURFACE[tone],
      )}
    >
      {children}
    </span>
  )
}
