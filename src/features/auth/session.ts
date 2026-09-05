/**
 * What a signed-in session looks like to the rest of the console.
 *
 * There is no fake sign-in anywhere: the only way into the console is an
 * account that exists in Supabase.
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
