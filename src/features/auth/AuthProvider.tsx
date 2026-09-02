import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../../supabase/api'
import type { AuthResult, Session } from './session'
import { STRINGS } from '../../constants'

/**
 * Holds the signed-in session for the whole console.
 *
 * The only place that talks to an auth backend. Screens call `useAuth()` and
 * never reach for Supabase themselves.
 *
 * Signing in is always real, and deliberately ignores USE_MOCK_DATA. There is
 * no fake sign-in path: the only way in is an account that exists in Supabase.
 * That flag decides where the *data* on each screen comes from — drivers,
 * vehicles, hours — and has no say over who may open the console.
 *
 * Supabase keeps the token itself, in localStorage or sessionStorage depending
 * on "Keep me signed in" (see supabase/client.ts). Nothing is stored here.
 */

type AuthState =
  /** Restoring a stored session. Screens must not decide anything yet. */
  | { status: 'loading'; session: null }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; session: null }

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>
  acceptInvite: (email: string, fullName: string, password: string) => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<{ ok: true }>
  setPassword: (password: string) => Promise<{ ok: true }>
  updateOrganization: (name: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const errors = STRINGS.auth.login.errors

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  /**
   * Restore on start-up, then follow onAuthChange for the rest of the session,
   * so a sign-out in another tab, or an expired refresh token, is noticed here
   * rather than leaving a dead console on screen.
   */
  useEffect(() => {
    let cancelled = false

    const settle = (session: Session | null) => {
      if (cancelled) return
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null })
    }

    void api.restoreSession().then(settle)
    const unsubscribe = api.onAuthChange(settle)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
      const result = await api.signIn(email, password, remember, {
        wrongCredentials: errors.wrongCredentials,
        noAccess: errors.noAccess,
      })
      if (result.ok) setState({ status: 'signedIn', session: result.session })
      return result
    },
    [],
  )

  const acceptInvite = useCallback(
    async (email: string, fullName: string, password: string): Promise<AuthResult> => {
      const result = await api.acceptInvite(email, fullName, password, {
        inviteFailed: errors.inviteFailed,
        noAccess: errors.noAccess,
      })
      if (result.ok) setState({ status: 'signedIn', session: result.session })
      return result
    },
    [],
  )

  const requestPasswordReset = useCallback(async (email: string) => {
    await api.requestPasswordReset(email)
    return { ok: true } as const
  }, [])

  const setPassword = useCallback(async (password: string) => {
    await api.setPassword(password)
    return { ok: true } as const
  }, [])

  const signOut = useCallback(() => {
    void api.signOut()
    setState({ status: 'signedOut', session: null })
  }, [])

  /** Keeps the header in step after the organisation is renamed in settings. */
  const updateOrganization = useCallback((name: string) => {
    setState((current) => {
      if (current.status !== 'signedIn') return current
      const session = {
        ...current.session,
        organization: { ...current.session.organization, name },
      }
      void api.updateOrganizationName(session.organization.id, name)
      return { status: 'signedIn', session }
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      acceptInvite,
      requestPasswordReset,
      setPassword,
      updateOrganization,
      signOut,
    }),
    [state, signIn, acceptInvite, requestPasswordReset, setPassword, updateOrganization, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
