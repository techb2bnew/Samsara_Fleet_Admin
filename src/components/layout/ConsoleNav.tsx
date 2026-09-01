import { NavLink } from 'react-router-dom'
import { GROUPS, MODULES, type Module } from '../../modules'
import { STRINGS } from '../../constants'
import {
  BookIcon,
  ChartIcon,
  ClipboardIcon,
  ClockIcon,
  FileIcon,
  FormIcon,
  GridIcon,
  HelpIcon,
  MapIcon,
  MessageIcon,
  RouteIcon,
  SettingsIcon,
  ShieldIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from '../ui'
import { cn } from '../../lib/cn'

const NAV_ICON: Record<Module['id'], typeof GridIcon> = {
  A02: GridIcon,
  A03: MapIcon,
  A04: UserIcon,
  A05: TruckIcon,
  A06: ClockIcon,
  A07: ClipboardIcon,
  A08: RouteIcon,
  A09: FormIcon,
  A10: MessageIcon,
  A13: FileIcon,
  A11: ShieldIcon,
  A12: BookIcon,
  A14: ChartIcon,
  A01: UsersIcon,
  A15: SettingsIcon,
}

function itemClass(isActive: boolean) {
  return cn(
    'group flex items-center gap-2 rounded-[10px] py-[5px] pr-2.5 pl-[5px] text-[13.5px] leading-snug outline-none transition-colors',
    isActive
      ? 'bg-accent-soft font-semibold text-accent'
      : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
  )
}

function iconWrapClass(isActive: boolean) {
  return cn(
    'flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors',
    isActive
      ? 'bg-surface text-accent shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
      : 'text-ink-4 group-hover:text-ink-2',
  )
}

/**
 * Sidebar links shared by the desktop rail and the mobile drawer.
 *
 * `onNavigate` closes the drawer after a tap so the page is not left sitting
 * behind an open menu.
 */
export function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="console-nav flex-1 overflow-y-auto px-2.5 py-3">
        {GROUPS.map((group) => (
          <div key={group} className="mb-4">
            <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase">
              {STRINGS.moduleGroups[group]}
            </p>
            <div className="flex flex-col gap-px">
              {MODULES.filter((m) => m.group === group).map((m) => {
                const Icon = NAV_ICON[m.id]
                return (
                  <NavLink
                    key={m.id}
                    to={m.path}
                    end={m.path === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) => itemClass(isActive)}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={iconWrapClass(isActive)}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 truncate">{m.name}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <NavLink
          to="/help"
          onClick={onNavigate}
          className={({ isActive }) => itemClass(isActive)}
        >
          {({ isActive }) => (
            <>
              <span className={iconWrapClass(isActive)}>
                <HelpIcon size={15} />
              </span>
              <span className="min-w-0 truncate">{STRINGS.console.help}</span>
            </>
          )}
        </NavLink>
      </div>
    </>
  )
}
