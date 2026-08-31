import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { TONE_SOLID, type Tone } from '../../constants'

/**
 * Brief confirmation after an action succeeds.
 *
 * A form that closes with no acknowledgement leaves the user unsure whether
 * anything happened, and a full dialog for "saved" is too much ceremony. This
 * is the middle: visible, non-blocking, gone in a few seconds.
 *
 * Announced politely to screen readers, so it is not only a visual signal.
 */

type Toast = { id: number; message: string; tone: Tone }

type ToastContextValue = {
  show: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-2.5 rounded-[9px] border border-line bg-surface px-4 py-2.5 shadow-xl shadow-black/20"
            >
              <span
                className={cn('size-2 shrink-0 rounded-full', TONE_SOLID[toast.tone])}
                aria-hidden="true"
              />
              <p className="text-[13.5px] font-medium text-ink">{toast.message}</p>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
