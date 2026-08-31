import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface px-7 py-5">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-4 uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-0.012em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
