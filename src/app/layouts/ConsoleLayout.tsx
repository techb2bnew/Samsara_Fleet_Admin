import { NavLink, Outlet } from 'react-router-dom'
import { GROUPS, MODULES } from '../../modules'
import { Logo } from '../../components/layout/Logo'
import { Topbar } from '../../components/layout/Topbar'
import { STRINGS } from '../../constants'
import { HelpIcon } from '../../components/ui'
import { useAuth } from '../../features/auth/AuthProvider'

/**
 * The signed-in shell: fixed sidebar for navigation, sticky header for search
 * and account, scrolling content between them.
 *
 * The account menu lives in the header rather than the sidebar. Two sign-out
 * buttons on one screen is one too many, and the top right is where people
 * look for their own account.
 */
export function ConsoleLayout() {
  const { session } = useAuth()
  if (!session) return null

  return (
    <div className="flex h-full bg-ground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
          <Logo size={26} />
          <div className="min-w-0">
            <p className="truncate text-[13.5px] leading-tight font-semibold text-ink">
              {session.organization.name}
            </p>
            <p className="text-[11px] leading-tight text-ink-3">{STRINGS.console.subtitle}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {GROUPS.map((group) => (
            <div key={group} className="mb-4">
              <p className="px-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.12em] text-ink-4 uppercase">
                {STRINGS.moduleGroups[group]}
              </p>
              {MODULES.filter((m) => m.group === group).map((m) => (
                <NavLink
                  key={m.id}
                  to={m.path}
                  end={m.path === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center rounded-[6px] px-2.5 py-1.5 text-[13.5px] transition-colors',
                      isActive
                        ? 'bg-accent-soft font-semibold text-accent'
                        : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    ].join(' ')
                  }
                >
                  {m.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <a
            href="#"
            className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <HelpIcon size={15} />
            {STRINGS.console.help}
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
