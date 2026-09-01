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
    <div className="relative">
      <div className="page-wash" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
        >
          <ArrowRightIcon size={13} className="rotate-180" />
          {backLabel}
        </Link>

        <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[24px]">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && <p className="mt-1.5 text-[13.5px] text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </header>

        {children}
      </div>
    </div>
  )
}

/** Label/value list used inside detail panels. */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-[12.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[13px] text-ink sm:text-right">{children}</dd>
    </div>
  )
}
