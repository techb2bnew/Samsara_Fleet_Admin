import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  mockAcceptInvite,
  mockRequestPasswordReset,
  mockSetPassword,
  mockSignIn,
  type AuthResult,
  type Session,
} from '../../mocks/auth'

/**
 * Holds the signed-in session for the whole console.
 *
 * This is the single place that talks to the auth backend. Screens call
 * `useAuth()` and never import the mock, so replacing it with Supabase later
 * means editing this file alone.
 */

const STORAGE_KEY = 'samsarafleet.session'

type AuthState =
  /** Reading storage on first paint. Screens must not decide anything yet. */
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

/**
 * Reads a stored session.
 *
 * "Keep me signed in" decides which store is used: localStorage survives
 * closing the browser, sessionStorage does not. Both are read on start-up so a
 * driver-facing tablet and an office desktop can behave differently without any
 * extra flag.
 *
 * Every access is guarded — private windows and locked-down browsers throw
 * rather than returning null.
 */
function readStoredSession(): Session | null {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Session
    } catch {
      // Unavailable or unparseable. Treat as signed out.
    }
  }
  return null
}

function writeStoredSession(session: Session, remember: boolean) {
  try {
    const store = remember ? window.localStorage : window.sessionStorage
    store.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage refused. The session still works for this tab, it just will not
    // survive a reload — acceptable, and better than failing the sign-in.
  }
}

function clearStoredSession() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do.
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    const stored = readStoredSession()
    setState(
      stored ? { status: 'signedIn', session: stored } : { status: 'signedOut', session: null },
    )
  }, [])

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
      const result = await mockSignIn(email, password)
      if (result.ok) {
        writeStoredSession(result.session, remember)
        setState({ status: 'signedIn', session: result.session })
      }
      return result
    },
    [],
  )

  const acceptInvite = useCallback(
    async (email: string, fullName: string, password: string): Promise<AuthResult> => {
      const result = await mockAcceptInvite(email, fullName, password)
      if (result.ok) {
        writeStoredSession(result.session, true)
        setState({ status: 'signedIn', session: result.session })
      }
      return result
    },
    [],
  )

  const signOut = useCallback(() => {
    clearStoredSession()
    setState({ status: 'signedOut', session: null })
  }, [])

  const updateOrganization = useCallback((name: string) => {
    setState((current) => {
      if (current.status !== 'signedIn') return current
      const session = {
        ...current.session,
        organization: { ...current.session.organization, name },
      }
      writeStoredSession(session, true)
      return { status: 'signedIn', session }
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      acceptInvite,
      requestPasswordReset: mockRequestPasswordReset,
      setPassword: mockSetPassword,
      updateOrganization,
      signOut,
    }),
    [state, signIn, acceptInvite, updateOrganization, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
