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
