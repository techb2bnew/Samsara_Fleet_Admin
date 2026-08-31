import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'
import { RouteNetwork } from '../../features/auth/components/RouteNetwork'
import { STRINGS } from '../../constants'

const { brand } = STRINGS.auth
const foot = STRINGS.authFooter

/**
 * Layout for every signed-out screen.
 *
 * The whole viewport is the brand surface with the route network running behind
 * it, and the form sits on top as a raised card. That puts the product's own
 * world behind the sign-in rather than beside it.
 *
 * Vertically the page is a header, a centred body and a pinned footer. Without
 * the top and bottom anchors the card reads as adrift in empty space on a tall
 * monitor — the three bands give it something to sit between.
 *
 * Ground and card both come from tokens that follow the theme, so the sign-in
 * page matches the console the user is about to enter rather than being a dark
 * page in front of a light product.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-full flex-col bg-brand">
      {/*
        Every decorative layer lives inside this wrapper, and the wrapper is
        exactly the size of the page.

        The glows deliberately extend past the edges, and `overflow-hidden`
        only clips what is painted — an overflowing child still counts towards
        the parent's scrollWidth, which quietly turns the parent into a
        scrollable box. The email field carries autoFocus, the browser scrolls
        a newly focused element into view, and the whole page slid sideways far
        enough to push the logo and footer off the left edge.

        Containing the decoration here keeps the page's own scrollWidth equal to
        its width, so there is nothing to scroll.
      */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <RouteNetwork />

        {/* Soft accent washes so the ground is not a flat rectangle. Kept away
            from the card so they never cut its contrast. */}
        <div
          className="absolute -top-56 -left-48 size-[660px] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
        />
        <div
          className="absolute -right-56 -bottom-64 size-[720px] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
        />
        {/* Fades the network out at the very bottom so the footer row always
            sits on a clean ground. */}
        <div
          className="absolute inset-x-0 bottom-0 h-56"
          style={{ background: 'linear-gradient(to top, var(--color-brand), transparent)' }}
        />
      </div>

      {/* ---- header ---- */}
      <header className="relative z-10 flex items-center gap-2.5 px-7 py-7 sm:px-12">
        <Logo size={30} />
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-brand-ink">
          {STRINGS.common.appName}
        </span>
      </header>

      {/* ---- body ---- */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-7 py-6 sm:px-12">
        <div className="grid w-full max-w-[1120px] items-center gap-16 lg:grid-cols-[1fr_440px] lg:gap-20">
          {/* Copy. Hidden below lg, where there is only room for the card. */}
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent-on-brand uppercase">
              {brand.eyebrow}
            </p>
            <h2 className="mt-4 max-w-[17ch] text-[clamp(34px,3.3vw,46px)] leading-[1.08] font-semibold tracking-[-0.028em] text-brand-ink text-balance">
              {brand.headline}
            </h2>
            <p className="mt-5 max-w-[42ch] text-[16px] leading-relaxed text-brand-ink/65">
              {brand.body}
            </p>

            <dl className="mt-12 grid max-w-[30rem] grid-cols-3 gap-6">
              {brand.stats.map((stat) => (
                <div key={stat.label} className="border-t border-brand-ink/12 pt-4">
                  <dt className="text-[13.5px] font-semibold text-brand-ink">{stat.label}</dt>
                  <dd className="mt-1 text-[12.5px] leading-snug text-brand-ink/60">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The form. */}
          <div className="mx-auto w-full max-w-[440px] lg:mx-0">
            <div
              className="rounded-[14px] border border-auth-card-edge bg-auth-card p-8 sm:p-9"
              // Softer than a dark ground needs: a heavy shadow under a white
              // card on a light ground reads as dirt rather than depth.
              style={{ boxShadow: '0 20px 48px -20px rgba(18,22,28,0.22), 0 2px 6px -2px rgba(18,22,28,0.10)' }}
            >
              <h1 className="text-[23px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-3">{subtitle}</p>}

              <div className="mt-7">{children}</div>
            </div>

            {footer && (
              <div className="mt-5 text-center text-[13px] text-brand-ink/60">{footer}</div>
            )}
          </div>
        </div>
      </div>

      {/* ---- footer ---- */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-7 py-6 text-[12.5px] text-brand-ink/60 sm:px-12">
        <span>{foot.copyright(new Date().getFullYear())}</span>

        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
            {foot.status}
          </span>
          <a href="#" className="hover:text-brand-ink/75">
            {foot.privacy}
          </a>
          <a href="#" className="hover:text-brand-ink/75">
            {foot.terms}
          </a>
        </div>
      </footer>
    </div>
  )
}
