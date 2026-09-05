/**
 * Colour tokens.
 *
 * ---------------------------------------------------------------------------
 * One source of truth, in two forms
 * ---------------------------------------------------------------------------
 * The actual hex values live in `src/index.css` under `@theme`, because that is
 * where Tailwind reads them from to build classes like `bg-accent`.
 *
 * This file does NOT repeat those hex values. Every entry below points at the
 * same CSS variable, so a colour can only ever be changed in one place and both
 * forms move together. Duplicating hex here would guarantee they drift apart the
 * first time someone tweaks a shade.
 *
 * ---------------------------------------------------------------------------
 * Which form to use
 * ---------------------------------------------------------------------------
 * In JSX, prefer Tailwind classes — `className="bg-accent text-ink"`. They are
 * shorter, and they already resolve to these tokens.
 *
 * Use `COLORS` when a value has to be passed as a string rather than a class:
 * map markers, chart libraries, canvas drawing, inline SVG attributes.
 *
 *     <circle fill={COLORS.brandInk} />
 *     new mapboxgl.Marker({ color: COLORS.accent })
 *
 * Both themes are handled automatically — the variables are redefined for dark
 * mode, so a `var()` reference resolves correctly without any check here.
 */

const v = (name: string) => `var(--color-${name})`

export const COLORS = {
  // surfaces
  ground: v('ground'),
  surface: v('surface'),
  surface2: v('surface-2'),
  line: v('line'),
  lineStrong: v('line-strong'),

  // text
  ink: v('ink'),
  ink2: v('ink-2'),
  ink3: v('ink-3'),
  ink4: v('ink-4'),

  // brand panel — deliberately dark in both themes
  brand: v('brand'),
  brandInk: v('brand-ink'),
  accentOnBrand: v('accent-on-brand'),
  authCard: v('auth-card'),
  authCardEdge: v('auth-card-edge'),

  // primary action
  accent: v('accent'),
  accentHover: v('accent-hover'),
  accentSoft: v('accent-soft'),
  accentLine: v('accent-line'),

  // sidebar rail
  rail: v('rail'),
  railInk: v('rail-ink'),
  railMuted: v('rail-muted'),
  railLine: v('rail-line'),
  railHover: v('rail-hover'),
  railActive: v('rail-active'),

  // Text sitting on a solid accent or danger fill. Flips between white and a
  // dark ink by theme, because the fills themselves change lightness.
  onAccent: v('on-accent'),
  onDanger: v('on-danger'),

  // semantic — never reuse the accent for these
  ok: v('ok'),
  okSoft: v('ok-soft'),
  okLine: v('ok-line'),

  warn: v('warn'),
  warnSoft: v('warn-soft'),
  warnLine: v('warn-line'),

  danger: v('danger'),
  dangerHover: v('danger-hover'),
  dangerSoft: v('danger-soft'),
  dangerLine: v('danger-line'),

  neutralSoft: v('neutral-soft'),
  neutralLine: v('neutral-line'),
} as const

export type ColorToken = keyof typeof COLORS

/**
 * Tone is the vocabulary the whole console uses for state. A badge, an alert
 * and a status dot all take the same tone name, so "warning" looks like
 * "warning" everywhere without each component inventing its own mapping.
 */
export const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'] as const
export type Tone = (typeof TONES)[number]

/** Tailwind classes per tone, for surfaces that carry a border. */
export const TONE_SURFACE: Record<Tone, string> = {
  neutral: 'bg-neutral-soft border-neutral-line text-ink-2',
  accent: 'bg-accent-soft border-accent-line text-accent',
  success: 'bg-ok-soft border-ok-line text-ok',
  warning: 'bg-warn-soft border-warn-line text-warn',
  danger: 'bg-danger-soft border-danger-line text-danger',
}

/** Tailwind classes per tone, for a solid dot or bar. */
export const TONE_SOLID: Record<Tone, string> = {
  neutral: 'bg-ink-4',
  accent: 'bg-accent',
  success: 'bg-ok',
  warning: 'bg-warn',
  danger: 'bg-danger',
}

/** Tailwind text colour per tone. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-3',
  accent: 'text-accent',
  success: 'text-ok',
  warning: 'text-warn',
  danger: 'text-danger',
}

/**
 * Reads a token as a real hex value from the running document.
 *
 * Only needed by APIs that cannot accept a `var()` string — some canvas and
 * charting libraries parse colours themselves. Returns an empty string during
 * server rendering or before styles have loaded, so callers should have a
 * fallback.
 */
export function resolveColor(token: ColorToken): string {
  if (typeof window === 'undefined') return ''
  const name = COLORS[token].slice(4, -1) // strip var( )
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
