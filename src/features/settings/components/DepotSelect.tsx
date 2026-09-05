import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { ChevronDownIcon, PlusIcon } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { DepotDialog } from './DepotDialog'

/**
 * Depot picker with a way to make one without leaving the form.
 *
 * A native <select> cannot run an action from a row — choosing "Add a depot"
 * either did nothing or snapped back to the placeholder. This list is a real
 * menu: depots to pick, then a separate row that opens the create dialog.
 * The new depot is selected as soon as it is saved.
 */
export function DepotSelect({
  label,
  value,
  onChange,
  emptyLabel,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (depotId: string) => void
  emptyLabel: string
  required?: boolean
  error?: string
}) {
  const { depots } = useFleetData()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null)

  const close = useCallback(() => setOpen(false), [])

  const selected = depots.find((depot) => depot.id === value)
  const shown = selected?.name ?? (depots.length === 0 ? STRINGS.dialog.noDepots : emptyLabel)

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null)
      return
    }
    function place() {
      const node = triggerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      close()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, close])

  function pick(id: string) {
    onChange(id)
    close()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9.5 w-full items-center justify-between gap-2 rounded-[6px] border bg-surface px-3 text-left text-sm',
          open ? 'border-accent' : error ? 'border-danger' : 'border-line-strong focus:border-accent',
          selected ? 'text-ink' : 'text-ink-3',
        )}
      >
        <span className="min-w-0 truncate">{shown}</span>
        <ChevronDownIcon size={14} className={cn('shrink-0 text-ink-4', open && 'rotate-180')} />
      </button>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {open &&
        menuBox &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
            className="fixed z-[70] overflow-hidden rounded-[8px] border border-line bg-surface py-1 shadow-xl shadow-black/10"
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => pick('')}
              className={cn(
                'flex w-full px-3 py-2 text-left text-[13px]',
                !value ? 'bg-accent-soft font-medium text-accent' : 'text-ink-3 hover:bg-surface-2',
              )}
            >
              {depots.length === 0 ? STRINGS.dialog.noDepots : emptyLabel}
            </button>
            {depots.map((depot) => (
              <button
                key={depot.id}
                type="button"
                role="option"
                aria-selected={value === depot.id}
                onClick={() => pick(depot.id)}
                className={cn(
                  'flex w-full px-3 py-2 text-left text-[13px]',
                  value === depot.id
                    ? 'bg-accent-soft font-medium text-accent'
                    : 'text-ink hover:bg-surface-2',
                )}
              >
                {depot.name}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              onClick={() => {
                close()
                setAdding(true)
              }}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12.5px] font-medium text-accent hover:bg-accent-soft"
            >
              <PlusIcon size={13} />
              {STRINGS.dialog.addDepot}
            </button>
          </div>,
          document.body,
        )}

      <DepotDialog
        open={adding}
        depot={null}
        stacked
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          onChange(id)
          setAdding(false)
        }}
      />
    </div>
  )
}
