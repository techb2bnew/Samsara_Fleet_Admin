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
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/35 px-4 py-3.5">
      {onSearchChange && (
        <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
          <SearchIcon
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-[7px] border border-line bg-ground pr-3 pl-8 text-[13px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
          />
        </div>
      )}
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * A single-choice filter rendered as a row of chips.
 *
 * `layout` decides what happens when the chips do not fit. Filters above a
 * table wrap onto a second line, which is fine there. Tabs on a detail page
 * must not: a tab strip that folds stops reading as one control, so those
 * scroll sideways instead and keep their single row.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  layout = 'wrap',
}: {
  options: Array<{ value: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
  layout?: 'wrap' | 'scroll'
}) {
  return (
    <div
      className={cn(
        'flex gap-1',
        layout === 'wrap'
          ? 'flex-wrap'
          : // -mx/px pair lets the first and last chip sit flush with the page
            // edge while still having room to scroll past it.
            '-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-full px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
            value === option.value
              ? 'bg-accent text-on-accent'
              : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={cn('ml-1.5', value === option.value ? 'text-on-accent/70' : 'text-ink-4')}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
