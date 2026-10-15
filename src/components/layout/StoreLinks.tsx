import type { ReactNode } from 'react'
import { APP_STORE_URL, PLAY_STORE_URL, STRINGS } from '../../constants'

/*
 * The two store marks, and the two ways the console shows them.
 *
 * Drawn here rather than in components/ui: they are somebody else's brand, not
 * part of this console's icon set, and nothing but these will ever use them.
 */

function PlayMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 24 26" aria-hidden="true">
      <path fill="#00A0FF" d="M1.6 1.1A1.7 1.7 0 0 0 1 2.4v21.2c0 .56.2 1 .6 1.3l.1.07L13.6 13.1v-.2z" />
      <path fill="#FFEA00" d="m17.5 17-3.9-3.9v-.2l3.9-3.9.1.05 4.6 2.65c1.3.75 1.3 1.97 0 2.72l-4.6 2.63z" />
      <path fill="#FF3A44" d="M17.6 16.95 13.6 13 1.6 24.9c.44.46 1.15.52 1.95.06l14.05-8z" />
      <path fill="#00E676" d="M17.6 9.05 3.55 1.04C2.75.58 2.04.64 1.6 1.1L13.6 13z" />
    </svg>
  )
}

function AppleMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 24 26" fill="currentColor" aria-hidden="true">
      <path d="M17.1 13.6c-.03-2.7 2.2-4 2.3-4.07-1.25-1.83-3.2-2.08-3.9-2.1-1.66-.17-3.24.97-4.08.97-.84 0-2.14-.95-3.52-.92-1.8.03-3.47 1.05-4.4 2.66-1.88 3.26-.48 8.1 1.35 10.75.9 1.3 1.96 2.75 3.36 2.7 1.35-.06 1.86-.87 3.5-.87 1.63 0 2.1.87 3.52.84 1.46-.03 2.38-1.32 3.26-2.62 1.03-1.5 1.46-2.96 1.48-3.04-.03-.01-2.84-1.09-2.87-4.3zM14.5 5.8c.74-.9 1.24-2.15 1.1-3.4-1.07.05-2.36.72-3.12 1.6-.68.8-1.28 2.07-1.12 3.3 1.19.09 2.4-.6 3.14-1.5z" />
    </svg>
  )
}

const foot = STRINGS.authFooter

/** The full badge, for the signed-out card where there is room to explain. */
function StoreBadge({ href, mark, top, name }: {
  href: string
  mark: ReactNode
  top: string
  name: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      /* brand-ink on brand, so the pill is dark on the cream ground and light
         on the dark one, without a colour of its own in either. */
      className="flex flex-1 items-center justify-center gap-2.5 rounded-[10px] bg-brand-ink px-3 py-2.5 text-brand transition-opacity hover:opacity-85"
    >
      {mark}
      <span className="leading-none">
        <span className="block text-[8.5px] tracking-[0.08em] uppercase opacity-70">{top}</span>
        <span className="mt-[3px] block text-[13px] font-semibold tracking-[-0.01em]">{name}</span>
      </span>
    </a>
  )
}

/** Both badges, side by side. */
export function StoreBadges() {
  return (
    <div className="flex gap-2.5">
      <StoreBadge href={PLAY_STORE_URL} mark={<PlayMark />} top={foot.playTop} name={foot.playName} />
      <StoreBadge href={APP_STORE_URL} mark={<AppleMark />} top={foot.appleTop} name={foot.appleName} />
    </div>
  )
}

/**
 * The same two links as bare marks, for the header.
 *
 * No words: the header already carries search, a bell and an account menu, and
 * a fourth labelled control is the one that tips it into clutter. The marks are
 * recognised on their own, and the title says the rest on hover.
 */
export function StoreIconLinks() {
  const t = STRINGS.console
  return (
    <>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noreferrer"
        title={t.getAppAndroid}
        aria-label={t.getAppAndroid}
        className="flex size-8 items-center justify-center rounded-[8px] transition-colors hover:bg-surface-2"
      >
        <PlayMark size={15} />
      </a>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        title={t.getAppIos}
        aria-label={t.getAppIos}
        className="flex size-8 items-center justify-center rounded-[8px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <AppleMark size={15} />
      </a>
    </>
  )
}
