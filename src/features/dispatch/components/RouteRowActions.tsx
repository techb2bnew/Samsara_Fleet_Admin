import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { hrefForDriverThread } from '../../../lib/entityLinks'
import type { Route } from '../types'

const t = STRINGS.dispatch.actions

/**
 * The four things a dispatcher does from the board without opening the route.
 *
 * Row click still opens the detail; these sit in a menu so four buttons do not
 * blow the table out. Clicks are stopped from reaching the row.
 */
export function RouteRowActions({
  route,
  onAssignDriver,
  onAssignVehicle,
}: {
  route: Route
  onAssignDriver: () => void
  onAssignVehicle: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; right: number } | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open) {
      setBox(null)
      return
    }
    function place() {
      const node = triggerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      setBox({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
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

  const hasMap = route.path.length >= 2 || Boolean(route.origin)
  const hasDriver = Boolean(route.driverId)

  const items = [
    { label: t.assignDriver, onClick: onAssignDriver },
    { label: t.assignVehicle, onClick: onAssignVehicle },
    {
      label: t.viewOnMap,
      onClick: () => navigate(hasMap ? `/map?route=${route.id}` : `/dispatch/${route.id}`),
    },
    ...(hasDriver
      ? [{ label: t.messageDriver, onClick: () => navigate(hrefForDriverThread(route.driver)) }]
      : []),
    { label: t.open, onClick: () => navigate(`/dispatch/${route.id}`) },
  ]

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={STRINGS.common.actions}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-3',
          'hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
        )}
      >
        <span className="text-[18px] leading-none">⋯</span>
      </button>
      {open &&
        box &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: box.top, right: box.right }}
            className="fixed z-[70] min-w-[11.5rem] overflow-hidden rounded-[8px] border border-line bg-surface py-1 shadow-xl shadow-black/10"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  item.onClick()
                }}
                className="flex w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-2"
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
