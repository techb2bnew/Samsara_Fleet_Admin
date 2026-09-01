import { NotificationsBell } from '../../features/notifications'
import { GlobalSearch } from './GlobalSearch'
import { UserMenu } from './UserMenu'
import { MenuIcon } from '../ui'
import { STRINGS } from '../../constants'

/**
 * The console header: search on the left, notifications and the account menu
 * on the right.
 *
 * Sticky, because a dispatcher scrolling a long driver list should never have
 * to scroll back up to reach search or their own account.
 *
 * On a phone the sidebar is hidden, so the header also carries the button that
 * opens it.
 */
export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={STRINGS.console.openMenu}
        className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
      >
        <MenuIcon size={18} />
      </button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell />
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  )
}
