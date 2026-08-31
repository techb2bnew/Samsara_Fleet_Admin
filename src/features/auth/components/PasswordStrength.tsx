import { cn } from '../../../lib/cn'
import { STRINGS, TONE_SOLID, TONE_TEXT, type Tone } from '../../../constants'

const { minLength, strengthLabels, problems } = STRINGS.auth.password

/**
 * Returns the reason a password is unacceptable, or undefined if it is fine.
 *
 * Kept beside the meter so the rule shown to the user and the rule enforced on
 * submit cannot drift apart.
 */
export function passwordProblem(value: string): string | undefined {
  if (value.length === 0) return problems.empty
  if (value.length < minLength) return problems.tooShort(minLength)
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) return problems.needsMixedCase
  if (!/[0-9]/.test(value)) return problems.needsNumber
  return undefined
}

function score(value: string): number {
  if (!value) return 0
  let s = 0
  if (value.length >= minLength) s++
  if (value.length >= 14) s++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s++
  if (/[0-9]/.test(value)) s++
  if (/[^A-Za-z0-9]/.test(value)) s++
  return Math.min(s, 4)
}

/** Weak reads as danger, strong as success — the same tones used everywhere else. */
const SCORE_TONE: Record<number, Tone> = {
  0: 'neutral',
  1: 'danger',
  2: 'warning',
  3: 'accent',
  4: 'success',
}

export function PasswordStrength({ value }: { value: string }) {
  const s = score(value)
  const tone = SCORE_TONE[s]

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              step <= s ? TONE_SOLID[tone] : 'bg-line',
            )}
          />
        ))}
      </div>
      <span className={cn('w-12 text-right text-[12px] font-medium', TONE_TEXT[tone])}>
        {strengthLabels[s]}
      </span>
    </div>
  )
}
