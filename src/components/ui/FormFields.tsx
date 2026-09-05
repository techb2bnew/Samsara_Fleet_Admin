import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Two-column form grid. Fields span one column, or both when `wide`. */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export function Select({ label, hint, error, options, className, id, ...rest }: SelectProps) {
  const generated = useId()
  const selectId = id ?? generated

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-[13px] font-medium text-ink">
        {label}
        {rest.required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <select
        {...rest}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-9.5 w-full appearance-none rounded-[6px] border bg-surface bg-no-repeat px-3 pr-8 text-sm text-ink',
          error ? 'border-danger' : 'border-line-strong focus:border-accent',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7482' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 10px center',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string
}

export function Textarea({ label, hint, error, className, id, ...rest }: TextareaProps) {
  const generated = useId()
  const areaId = id ?? generated

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <textarea
        {...rest}
        id={areaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'min-h-[84px] w-full rounded-[6px] border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4',
          error ? 'border-danger' : 'border-line-strong focus:border-accent',
          className,
        )}
      />
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

type FileFieldProps = {
  label: string
  hint?: string
  error?: string
  /** Comma-joined MIME types, straight from the bucket's own allow-list. */
  accept?: string
  id?: string
  onChange: (file: File | null) => void
}

/**
 * A file picker that looks like the other fields.
 *
 * Uncontrolled on purpose: a file input's value cannot be set from code, so
 * holding it in state would only give two sources of truth for one thing. The
 * chosen file is handed up through onChange instead.
 */
export function FileField({ label, hint, error, accept, id, onChange }: FileFieldProps) {
  const generated = useId()
  const inputId = id ?? generated

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className={cn(
          'rounded-[6px] border bg-surface px-3 py-2 text-[13px] text-ink',
          'file:mr-3 file:rounded-[5px] file:border-0 file:bg-surface-2 file:px-2.5 file:py-1 file:text-[12.5px] file:text-ink-2',
          error ? 'border-danger' : 'border-line-strong focus:border-accent',
        )}
      />
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}
