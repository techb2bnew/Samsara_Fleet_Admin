import { STRINGS } from '../../constants'

/** Shown while the stored session is read, before any routing decision. */
export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center bg-ground">
      <div className="flex flex-col items-center gap-3">
        <svg className="size-6 animate-spin text-ink-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p className="text-[13px] text-ink-3">{STRINGS.common.loading}</p>
      </div>
    </div>
  )
}
