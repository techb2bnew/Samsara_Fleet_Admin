import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../../components/layout/Logo'
import { ConsoleNav } from '../../components/layout/ConsoleNav'
import { Topbar } from '../../components/layout/Topbar'
import { STRINGS } from '../../constants'
import { useAuth } from '../../features/auth/AuthProvider'

/**
 * The signed-in shell: sidebar for navigation, sticky header for search
 * and account, scrolling content between them.
 *
 * Below `lg` the rail becomes a drawer opened from the header, so a phone
 * is not stuck with a 248px sidebar and no room for the page.
 *
 * The account menu lives in the header rather than the sidebar. Two sign-out
 * buttons on one screen is one too many, and the top right is where people
 * look for their own account.
 */
export function ConsoleLayout() {
  const { session } = useAuth()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [navOpen])

  if (!session) return null

  return (
    <div className="flex h-full bg-ground">
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-rail-line bg-rail lg:flex">
        <Brand name={session.organization.name} />
        <ConsoleNav />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-rail/50 backdrop-blur-[2px]"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-[min(280px,86vw)] flex-col border-r border-rail-line bg-rail shadow-2xl shadow-black/30">
            <Brand name={session.organization.name} />
            <ConsoleNav onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-rail-line px-4">
      <Logo size={28} />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] leading-tight font-semibold tracking-[-0.01em] text-rail-ink">
          {name}
        </p>
        <p className="text-[11px] leading-tight text-rail-muted">{STRINGS.console.subtitle}</p>
      </div>
    </div>
  )
}
