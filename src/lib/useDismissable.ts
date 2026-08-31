import { useEffect, useRef, type RefObject } from 'react'

/**
 * Closes a popup on an outside click or Escape.
 *
 * Attach the returned ref to the element that contains both the trigger and the
 * panel, so clicking the trigger to close does not fight the outside-click
 * handler.
 *
 * Listeners are only attached while the popup is open — a console with several
 * closed menus should not have a document listener for each of them.
 */
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onDismiss])

  return ref
}
