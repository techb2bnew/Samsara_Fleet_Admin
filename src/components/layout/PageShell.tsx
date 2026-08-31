import type { ReactNode } from 'react'

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
    <div
      className={
        width === 'narrow' ? 'mx-auto max-w-[820px] px-6 py-7' : 'mx-auto max-w-[1280px] px-6 py-7'
      }
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10.5px] tracking-[0.12em] text-ink-4 uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-0.5 text-[21px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
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
    <section className={`overflow-hidden rounded-[10px] border border-line bg-surface ${className ?? ''}`}>
      {title && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[14.5px] font-semibold text-ink">{title}</h2>
            {hint && <p className="mt-0.5 text-[12.5px] text-ink-3">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
