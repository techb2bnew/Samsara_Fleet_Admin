import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '../ui'

/**
 * Frame for a detail page reached from a list.
 *
 * The back link names the list it returns to rather than saying "Back", because
 * a detail page can be reached from a table, a search result or a dashboard
 * alert, and "Back" tells the reader nothing about where they will land.
 */
export function DetailShell({
  backTo,
  backLabel,
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  backTo: string
  backLabel: string
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-7">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
      >
        <ArrowRightIcon size={13} className="rotate-180" />
        {backLabel}
      </Link>

      <header className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-[13.5px] text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {children}
    </div>
  )
}

/** Label/value list used inside detail panels. */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-ink">{children}</dd>
    </div>
  )
}
