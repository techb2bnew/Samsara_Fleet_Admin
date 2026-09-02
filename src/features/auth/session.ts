/**
 * What a signed-in session looks like to the rest of the console.
 *
 * Auth is always real. There is no mock sign-in — the only way into the console
 * is an account that exists in Supabase, whatever USE_MOCK_DATA is set to. The
 * flag decides where *screen data* comes from, never who may sign in.
 *
 * These types live here rather than in src/mocks so nothing about signing in
 * depends on a mock file.
 */

/** Shortest password the sign-in form will bother sending. */
export const MIN_LOGIN_PASSWORD_LENGTH = 8

export type Session = {
  user: {
    id: string
    email: string
    fullName: string
    initials: string
    roleName: string
  }
  organization: {
    id: string
    name: string
  }
}

export type AuthResult = { ok: true; session: Session } | { ok: false; error: string }
