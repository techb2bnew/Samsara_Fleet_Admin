/**
 * Stand-in for Supabase auth during the design phase.
 *
 * Every function here has the same shape the real one will have — async,
 * returns either a session or a typed error — so swapping this for
 * `supabase.auth` later is a change inside AuthProvider and nowhere else. No
 * screen imports this file directly.
 *
 * ---------------------------------------------------------------------------
 * How to demo each state
 * ---------------------------------------------------------------------------
 *   any valid email + 8 or more characters  -> signs in
 *   locked@example.com                      -> account locked error
 *   unknown@example.com                     -> wrong credentials error
 *
 * The deliberate failure addresses exist so the client can see the error
 * handling working, not only the happy path.
 */

import { STRINGS } from '../constants'

export const MIN_LOGIN_PASSWORD_LENGTH = 8

/** Latency, so loading states are visible instead of flashing past. */
const FAKE_LATENCY_MS = 550

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

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: string }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Turns "Priya Sharma" into "PS". Falls back to the email's first letter. */
function initialsFor(fullName: string, email: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 1).toUpperCase()
}

/** Builds a plausible display name out of whatever email was typed. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Fleet User'
  )
}

export function buildSession(email: string): Session {
  const fullName = nameFromEmail(email)
  return {
    user: {
      id: 'mock-user-1',
      email,
      fullName,
      initials: initialsFor(fullName, email),
      roleName: 'Fleet admin',
    },
    organization: {
      id: 'mock-org-1',
      name: 'Northline Haulage',
    },
  }
}

export async function mockSignIn(email: string, password: string): Promise<AuthResult> {
  await wait(FAKE_LATENCY_MS)

  const normalised = email.trim().toLowerCase()

  if (normalised === 'locked@example.com') {
    return { ok: false, error: STRINGS.auth.login.errors.accountLocked }
  }
  if (normalised === 'unknown@example.com') {
    return { ok: false, error: STRINGS.auth.login.errors.wrongCredentials }
  }
  if (password.length < MIN_LOGIN_PASSWORD_LENGTH) {
    return { ok: false, error: STRINGS.auth.login.errors.wrongCredentials }
  }

  return { ok: true, session: buildSession(normalised) }
}

export async function mockRequestPasswordReset(_email: string): Promise<{ ok: true }> {
  await wait(FAKE_LATENCY_MS)
  // Always reports success. Telling a stranger whether an address is registered
  // hands them a list of valid accounts, so the real one will behave the same.
  return { ok: true }
}

export async function mockSetPassword(_password: string): Promise<{ ok: true }> {
  await wait(FAKE_LATENCY_MS)
  return { ok: true }
}

export async function mockAcceptInvite(
  email: string,
  fullName: string,
  password: string,
): Promise<AuthResult> {
  await wait(FAKE_LATENCY_MS)
  if (password.length < MIN_LOGIN_PASSWORD_LENGTH) {
    return { ok: false, error: STRINGS.auth.login.errors.passwordTooShort(MIN_LOGIN_PASSWORD_LENGTH) }
  }
  const session = buildSession(email)
  return {
    ok: true,
    session: {
      ...session,
      user: {
        ...session.user,
        fullName,
        initials: initialsFor(fullName, email),
        roleName: 'Dispatcher',
      },
    },
  }
}

/** Placeholder invitation, until a real invite token is read from the link. */
export const MOCK_INVITATION = {
  orgName: 'Northline Haulage',
  roleName: 'Dispatcher',
  email: 'priya@northline.example',
} as const
