import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullPageSpinner } from '../../components/layout/FullPageSpinner'

/**
 * Keeps a signed-in user off the sign-in screens, and decides where they land.
 *
 * This guard owns the redirect rather than the login page doing its own
 * `navigate()`. The moment a session appears this component re-renders and
 * redirects immediately — faster than any navigate call inside a submit
 * handler, which would be overridden and silently send the user to the
 * dashboard instead of the page they originally asked for.
 *
 * RequireAuth stores that page in location state on its way here, so it is read
 * back below.
 */
export function RedirectIfSignedIn() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />

  if (status === 'signedIn') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    return <Navigate to={from ?? '/'} replace />
  }

  return <Outlet />
}
