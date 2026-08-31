import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { STRINGS } from '../../constants'

/**
 * The table used by most console modules.
 *
 * Deliberately small: sorting and column resizing are not here because no
 * screen needs them yet, and a table primitive that guesses at requirements
 * ends up fought rather than used.
 *
 * `render` returns a node rather than the table formatting a value itself, so
 * a cell can hold a badge, a link or a stack of two lines without the table
 * needing to know about any of them.
 */

const t = STRINGS.table

export type Column<T> = {
  key: string
  header: string
  /** Any CSS width. Columns without one share the remaining space. */
  width?: string
  align?: 'left' | 'right'
  /** Hidden below `lg`, for detail that is useful but not essential. */
  secondary?: boolean
  render: (row: T) => ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty,
  pageSize = 10,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Rendered in place of the table when there is nothing to show. */
  empty: ReactNode
  /** Set to 0 to disable paging entirely. */
  pageSize?: number
}) {
  const [page, setPage] = useState(1)

  const paged = pageSize > 0
  const totalPages = paged ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1

  /**
   * Filtering usually shortens the list, and staying on page 4 of a list that
   * now has one page shows an empty table with rows that clearly exist. Clamp
   * back into range whenever the row count changes.
   */
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const visible = useMemo(() => {
    if (!paged) return rows
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize, paged])

  if (rows.length === 0) return <>{empty}</>

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, rows.length)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.secondary && 'hidden lg:table-cell',
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line last:border-b-0',
                  onRowClick && 'cursor-pointer transition-colors hover:bg-surface-2',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 align-middle text-ink-2',
                      col.align === 'right' && 'text-right',
                      col.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paged && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          first={first}
          last={last}
          total={rows.length}
          onChange={setPage}
        />
      )}
    </>
  )
}

function Pagination({
  page,
  totalPages,
  first,
  last,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  first: number
  last: number
  total: number
  onChange: (page: number) => void
}) {
  return (
    <nav
      aria-label={t.pagination}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5"
    >
      <p className="text-[12.5px] text-ink-3">{t.showing(first, last, total)}</p>

      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          label={t.previous}
        >
          {t.previous}
        </PageButton>

        {pageNumbers(page, totalPages).map((entry, i) =>
          entry === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-[12.5px] text-ink-4">
              &hellip;
            </span>
          ) : (
            <button
              key={entry}
              onClick={() => onChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'min-w-[28px] rounded-[6px] px-2 py-1 font-mono text-[12.5px] transition-colors',
                entry === page
                  ? 'bg-accent-soft font-semibold text-accent'
                  : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {entry}
            </button>
          ),
        )}

        <PageButton
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          label={t.next}
        >
          {t.next}
        </PageButton>
      </div>
    </nav>
  )
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-[6px] px-2 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

/**
 * Page numbers with the current page always visible and its neighbours around
 * it: 1 … 4 [5] 6 … 20. A long list must not render a hundred buttons.
 */
function pageNumbers(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const out: Array<number | 'gap'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) out.push('gap')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < totalPages - 1) out.push('gap')

  out.push(totalPages)
  return out
}
