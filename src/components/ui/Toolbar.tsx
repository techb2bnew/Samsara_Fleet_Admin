import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SearchIcon } from './Icon'

/** Search box plus filter chips, sitting above a table. */
export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  actions,
}: {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      {onSearchChange && (
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8.5 w-full rounded-[6px] border border-line bg-ground pr-3 pl-8 text-[13px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
          />
        </div>
      )}
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A single-choice filter rendered as a row of chips. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
            value === option.value
              ? 'bg-accent-soft text-accent'
              : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={cn('ml-1.5', value === option.value ? 'text-accent/60' : 'text-ink-4')}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
