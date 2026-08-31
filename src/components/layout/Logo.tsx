import { COLORS } from '../../constants'

/**
 * A tractor unit in profile. The product is about trucks, so the mark says so
 * rather than being an abstract shape.
 *
 * The strokes use COLORS.brandInk rather than a literal "white", so the mark
 * follows the palette if the brand colours are ever changed.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill={COLORS.accent} />
      <path
        d="M6 20.5V13a1 1 0 0 1 1-1h9.5a1 1 0 0 1 1 1v7.5M17.5 15.5h4.2a1 1 0 0 1 .82.43l2.3 3.3a1 1 0 0 1 .18.57v.7"
        stroke={COLORS.brandInk}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 20.5h21" stroke={COLORS.brandInk} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="22" r="2.2" fill={COLORS.brandInk} />
      <circle cx="22" cy="22" r="2.2" fill={COLORS.brandInk} />
    </svg>
  )
}
