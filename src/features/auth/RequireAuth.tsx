import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullPageSpinner } from '../../components/layout/FullPageSpinner'

/**
 * Gate for every console route.
 *
 * While the stored session is being read the guard renders a spinner rather
 * than redirecting. Without that, a signed-in user reloading a deep page would
 * be bounced to the login screen for a frame and lose their place.
 *
 * The attempted path is passed along, so signing in returns the user to where
 * they were going instead of dumping them on the dashboard.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
