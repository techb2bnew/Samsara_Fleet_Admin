import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Standard page frame: title block, then content. Used by every module. */
export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  width = 'wide',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  width?: 'wide' | 'narrow'
}) {
  return (
    <div className="relative">
      <div className="page-wash" aria-hidden="true" />
      <div
        className={cn(
          'relative px-4 py-6 sm:px-6 sm:py-8',
          width === 'narrow' ? 'mx-auto max-w-[820px]' : 'mx-auto max-w-[1280px]',
        )}
      >
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[12.5px] font-medium text-ink-3">{eyebrow}</p>}
            <h1 className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.035em] text-ink sm:text-[26px]">
              {title}
            </h1>
            {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}

/** A bordered panel with an optional header row. */
export function Panel({
  title,
  hint,
  action,
  children,
  className,
}: {
  title?: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[14px] border border-line bg-surface panel-shadow',
        className,
      )}
    >
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-2/45 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
            {hint && <p className="mt-0.5 text-[12.5px] text-ink-3">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
