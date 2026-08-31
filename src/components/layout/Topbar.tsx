import { NotificationsBell } from '../../features/notifications'
import { GlobalSearch } from './GlobalSearch'
import { UserMenu } from './UserMenu'

/**
 * The console header: search on the left, notifications and the account menu
 * on the right.
 *
 * Sticky, because a dispatcher scrolling a long driver list should never have
 * to scroll back up to reach search or their own account.
 */
export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationsBell />
        <div className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  )
}
