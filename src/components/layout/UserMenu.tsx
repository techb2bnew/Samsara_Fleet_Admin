import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { STRINGS } from '../../constants'
import { useDismissable } from '../../lib/useDismissable'
import { useAuth } from '../../features/auth/AuthProvider'
import { ChevronDownIcon, ConfirmDialog, HelpIcon, SettingsIcon, SignOutIcon, UserIcon } from '../ui'

const t = STRINGS.console

/**
 * Account menu for the console header.
 *
 * Sits top-right because that is the first place anyone looks for their own
 * account, and it is the only place in the console that can sign a user out.
 */
export function UserMenu() {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismissable<HTMLDivElement>(open, close)

  if (!session) return null
  const { user, organization } = session

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.accountMenu}
        className="flex shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-surface-2 aria-expanded:bg-surface-2 sm:gap-2 sm:rounded-[9px] sm:py-1 sm:pr-1.5 sm:pl-1"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12.5px] font-semibold text-on-accent">
          {user.initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] leading-tight font-medium text-ink">
            {user.fullName}
          </span>
          <span className="block text-[11.5px] leading-tight text-ink-3">{user.roleName}</span>
        </span>
        <ChevronDownIcon size={15} className="hidden text-ink-4 sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[3.75rem] z-40 overflow-hidden rounded-[12px] border border-line bg-surface shadow-xl shadow-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full sm:mt-1.5 sm:w-64"
        >
          {/* Identity first — a menu that signs you out should say who it is
              about, especially on a shared office computer. */}
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[13.5px] font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-[12.5px] text-ink-3">{user.email}</p>
            <p className="mt-1.5 truncate text-[11.5px] text-ink-4">
              {user.roleName} · {organization.name}
            </p>
          </div>

          <div className="py-1">
            <MenuLink to="/settings" icon={<UserIcon size={15} />} onClick={() => setOpen(false)}>
              {t.accountSettings}
            </MenuLink>
            <MenuLink
              to="/settings"
              icon={<SettingsIcon size={15} />}
              onClick={() => setOpen(false)}
            >
              {t.orgSettings}
            </MenuLink>
            <MenuLink to="/help" icon={<HelpIcon size={15} />} onClick={() => setOpen(false)}>
              {t.help}
            </MenuLink>
          </div>

          <div className="border-t border-line py-1">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setConfirming(true)
              }}
              className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-[13.5px] text-danger transition-colors hover:bg-danger-soft"
            >
              <SignOutIcon size={15} />
              {t.signOut}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={signOut}
        title={STRINGS.dialog.confirmSignOutTitle}
        message={STRINGS.dialog.confirmSignOutMessage}
        confirmLabel={STRINGS.dialog.confirmSignOut}
        tone="danger"
      />
    </div>
  )
}

function MenuLink({
  to,
  icon,
  onClick,
  children,
}: {
  to: string
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      role="menuitem"
      to={to}
      onClick={onClick}
      className="group mx-1 flex items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-accent-soft hover:text-accent"
    >
      <span className="text-ink-4 group-hover:text-accent">{icon}</span>
      {children}
    </Link>
  )
}
