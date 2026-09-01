import type { SVGProps } from 'react'

/**
 * The small icon set the console needs.
 *
 * Inline rather than an icon package: this is a dozen shapes, and a dependency
 * would ship thousands. Every path uses `currentColor`, so an icon takes its
 * colour from the text around it and needs no theme handling of its own.
 */

type Props = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: Props) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

export const SearchIcon = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const BellIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </svg>
)

export const ChevronDownIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const SettingsIcon = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1" />
  </svg>
)

export const SignOutIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

export const UserIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export const ArrowRightIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

export const HelpIcon = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2.5-2.5 2.5" />
    <path d="M12 17h.01" />
  </svg>
)

export const MenuIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
)

export const PlusIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

export const TruckIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M3 7h11v10H3z" />
    <path d="M14 11h4.2a1 1 0 0 1 .82.43L21 14.2V17h-7" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="17.5" cy="17" r="1.6" />
  </svg>
)

export const RouteIcon = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8 7.2C12 7 12 17 16 16.8" />
  </svg>
)

export const MessageIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H8l-4 3.5V6.5Z" />
  </svg>
)

export const MapIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="m9 4 6 2 5-2v16l-5 2-6-2-5 2V6l5-2z" />
    <path d="M9 4v16" />
    <path d="M15 6v16" />
  </svg>
)

export const GridIcon = (p: Props) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.4" />
    <rect x="13" y="4" width="7" height="7" rx="1.4" />
    <rect x="4" y="13" width="7" height="7" rx="1.4" />
    <rect x="13" y="13" width="7" height="7" rx="1.4" />
  </svg>
)

export const ClockIcon = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.5l3 1.5" />
  </svg>
)

export const ClipboardIcon = (p: Props) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="12" height="15" rx="2" />
    <path d="M9 5.2V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v.7" />
    <path d="M9 11h6M9 15h4" />
  </svg>
)

export const FileIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M14 4v5h5" />
  </svg>
)

export const ShieldIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 3.5 5 6.5v5.2c0 4.2 2.9 7.2 7 8.8 4.1-1.6 7-4.6 7-8.8V6.5L12 3.5Z" />
    <path d="m9.2 12.2 1.9 1.9 3.7-3.8" />
  </svg>
)

export const BookIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" />
    <path d="M5 5.5v16" />
    <path d="M9 8h6" />
  </svg>
)

export const ChartIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 19h16" />
    <path d="M7 16v-4" />
    <path d="M12 16V8" />
    <path d="M17 16v-7" />
  </svg>
)

export const UsersIcon = (p: Props) => (
  <svg {...base(p)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9.5" cy="7" r="3.2" />
    <path d="M20 21v-2a3.5 3.5 0 0 0-2.6-3.4" />
    <path d="M16.2 4.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
)

export const FormIcon = (p: Props) => (
  <svg {...base(p)}>
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
)
