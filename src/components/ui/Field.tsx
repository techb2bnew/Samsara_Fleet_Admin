import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { EyeIcon, EyeOffIcon } from './Icon'
import { STRINGS } from '../../constants'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  trailing?: ReactNode
}

export function Field({ label, hint, error, trailing, className, id, type, ...rest }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  /**
   * Every password field gets a reveal button, decided here rather than by each
   * caller — one field without it is the one where someone mistypes a long
   * password three times and never sees why.
   *
   * `type` is swapped rather than the input replaced, so the value, caret and
   * autofill survive the toggle.
   */
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)

  function toggleReveal() {
    // Remember where the caret was. Clicking the button takes focus off the
    // input, and changing an input's type resets its caret to the start, so
    // both have to be put back after the re-render.
    caretRef.current = inputRef.current?.selectionStart ?? null
    setRevealed((on) => !on)
  }

  useLayoutEffect(() => {
    const caret = caretRef.current
    caretRef.current = null
    const input = inputRef.current
    if (caret === null || !input) return
    input.focus()
    input.setSelectionRange(caret, caret)
  }, [revealed])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {trailing}
      </div>

      <div className="relative">
        <input
          {...rest}
          ref={inputRef}
          type={isPassword && revealed ? 'text' : type}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-9.5 w-full rounded-[6px] border bg-surface px-3 text-sm text-ink',
            'placeholder:text-ink-4',
            'transition-colors',
            error ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-accent',
            'disabled:bg-surface-2 disabled:text-ink-3',
            // Room for the reveal button, so a long password never runs under it.
            isPassword && 'pr-10',
            className,
          )}
        />

        {isPassword && (
          <button
            type="button"
            onClick={toggleReveal}
            // Skipped by Tab: between a password box and the submit button, a
            // keyboard user wants the button, not this.
            tabIndex={-1}
            disabled={rest.disabled}
            aria-label={revealed ? STRINGS.common.hidePassword : STRINGS.common.showPassword}
            aria-pressed={revealed}
            className={cn(
              'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[6px]',
              'text-ink-3 transition-colors hover:text-ink',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
              'disabled:pointer-events-none disabled:text-ink-4',
            )}
          >
            {revealed ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
