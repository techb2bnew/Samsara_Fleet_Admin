import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONE_SOLID, TONE_SURFACE, type Tone } from '../../constants'

export function Alert({
  tone = 'accent',
  title,
  children,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex gap-2.5 rounded-[6px] border px-3.5 py-3 text-sm', TONE_SURFACE[tone])}>
      <span
        className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', TONE_SOLID[tone])}
        aria-hidden="true"
      />
      <div className="min-w-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}
