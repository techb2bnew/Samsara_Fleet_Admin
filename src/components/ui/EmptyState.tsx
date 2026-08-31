import type { ReactNode } from 'react'

/**
 * Shown wherever a list has nothing in it.
 *
 * Two different situations need two different messages, and conflating them is
 * the usual mistake: a list that is empty because nothing exists yet should
 * explain what will appear here, while a list emptied by a filter should say so
 * and offer a way back. The caller decides which by passing `onClear`.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  onClear,
  clearLabel,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  onClear?: () => void
  clearLabel?: string
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-4">
          {icon}
        </span>
      )}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{hint}</p>}

      {(action || onClear) && (
        <div className="mt-4 flex items-center gap-2">
          {action}
          {onClear && clearLabel && (
            <button
              onClick={onClear}
              className="rounded-[6px] border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
