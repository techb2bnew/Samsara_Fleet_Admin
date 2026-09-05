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
    'group flex items-center gap-2.5 rounded-[10px] py-2 pr-3 pl-2 text-[13.5px] leading-snug outline-none transition-colors',
    isActive
      ? 'bg-white font-semibold text-ink'
      : 'font-medium text-rail-muted hover:bg-white/6 hover:text-rail-ink',
  )
}

function iconWrapClass(isActive: boolean) {
  return cn(
    'flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors',
    isActive
      ? 'bg-accent text-on-accent'
      : 'text-rail-muted group-hover:text-rail-ink',
  )
}

/**
 * Flat sidebar: one list, grouped only by a label.
 *
 * Trays, capsules and the route spine were tried and set aside. The current
 * page is a white box so it still reads on the dark rail.
 *
 * `onNavigate` closes the drawer after a tap so the page is not left sitting
 * behind an open menu.
 */
export function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="console-nav flex-1 overflow-y-auto px-3 py-3.5">
        {GROUPS.map((group) => {
          const items = MODULES.filter((m) => m.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-5 last:mb-2">
              <p className="px-2 pb-2 text-[10.5px] font-semibold tracking-[0.14em] text-rail-muted/70 uppercase">
                {STRINGS.moduleGroups[group]}
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((m) => {
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
          )
        })}
      </nav>

      <div className="border-t border-rail-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
