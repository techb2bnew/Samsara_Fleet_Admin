import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leading?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent border-accent hover:bg-accent-hover disabled:bg-ink-4 disabled:border-ink-4',
  secondary:
    'bg-surface text-ink border-line-strong hover:bg-surface-2 disabled:text-ink-4',
  ghost:
    'bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink disabled:text-ink-4',
  danger:
    'bg-danger text-on-danger border-danger hover:bg-danger-hover disabled:bg-ink-4 disabled:border-ink-4',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9.5 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leading,
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-[6px] border font-medium',
        // A button label that wraps breaks the control's height and the row it
        // sits in. If it does not fit, the column is too narrow — fix that
        // rather than letting the label fold.
        'whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : leading}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
