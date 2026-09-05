import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { STRINGS } from '../../constants'

/**
 * Dialog used by every form and confirmation in the console.
 *
 * Rendered through a portal so it escapes any parent with `overflow: hidden`
 * or a stacking context — a modal clipped by the panel it was opened from is
 * the classic version of this bug.
 *
 * Focus moves into the dialog on open and returns to whatever opened it on
 * close, and Tab is kept inside while it is open. Without that, a keyboard user
 * tabs straight out of the dialog into the page behind it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  stacked = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /**
   * Sit above an already-open dialog. Capture Escape/Tab so the page behind
   * does not close, and raise the overlay so this one is the one you see.
   */
  stacked?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  /**
   * Callers almost always pass an inline arrow for onClose, which is a new
   * function on every render. Depending on it directly would tear down and
   * re-run the effect below on every keystroke — restoring focus to whatever
   * opened the dialog and then moving it to the first control, so typing a
   * single character kicked focus out of the field and onto the close button.
   *
   * Holding it in a ref keeps the handler current while the effect depends only
   * on `open`, which is the thing that should actually drive it.
   */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    returnFocusTo.current = document.activeElement as HTMLElement | null

    /**
     * Focus the first *field*, not simply the first focusable node. The close
     * button sits earlier in the DOM, and landing there means a keyboard user
     * arrives on "dismiss" rather than on the form they came to fill in.
     */
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    ;(firstField ?? panelRef.current)?.focus()

    // The page behind must not scroll while a dialog is over it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (stacked) event.stopImmediatePropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      if (stacked) event.stopImmediatePropagation()

      const items = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!items || items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, stacked)
    return () => {
      document.removeEventListener('keydown', onKeyDown, stacked)
      document.body.style.overflow = previousOverflow
      returnFocusTo.current?.focus()
    }
  }, [open, stacked])

  if (!open) return null

  return createPortal(
    <div className={cn(
      'fixed inset-0 flex items-end justify-center overflow-y-auto p-0 sm:items-start sm:p-8',
      stacked ? 'z-[60]' : 'z-50',
    )}>
      <div
        className="fixed inset-0 bg-brand/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-h-[min(92dvh,100%)] flex-col overflow-hidden rounded-t-[16px] border border-line bg-surface shadow-2xl shadow-black/25 outline-none sm:my-auto sm:max-h-[calc(100dvh-4rem)] sm:rounded-[12px]',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={STRINGS.common.close}
            className="-mt-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-[7px] text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-line px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6 [&_button]:w-full sm:[&_button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
