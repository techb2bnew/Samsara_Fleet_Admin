import { createClient } from '@supabase/supabase-js'
import type { Database } from './database'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Supabase config missing. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

/**
 * Where the sign-in token is kept, decided by "Keep me signed in on this
 * computer".
 *
 * Supabase takes one storage object for the life of the client, so honouring
 * that checkbox means routing each write as it happens rather than choosing a
 * store up front. Reads check both, because a token written before the
 * preference changed still has to be found.
 *
 * On a shared office machine this is the difference between the next person
 * finding the previous one still signed in and not.
 */
const REMEMBER_KEY = 'samsarafleet.remember'

export function setRememberMe(remember: boolean) {
  try {
    if (remember) window.localStorage.setItem(REMEMBER_KEY, '1')
    else window.localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // Private windows and locked-down browsers throw. The session still works
    // for this tab; it simply will not outlive it.
  }
}

function shouldRemember(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === '1'
  } catch {
    return false
  }
}

const splitStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      if (shouldRemember()) {
        window.localStorage.setItem(key, value)
        window.sessionStorage.removeItem(key)
      } else {
        window.sessionStorage.setItem(key, value)
        window.localStorage.removeItem(key)
      }
    } catch {
      // Nothing to do — see setRememberMe.
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      // Nothing to do.
    }
  },
}

/**
 * Browser client for the admin console.
 *
 * The publishable key is deliberately shipped to the browser. Anyone can read
 * it, which is fine: row-level security decides what each signed-in user may
 * see. The secret key must never appear here.
 *
 * detectSessionInUrl is on so email invite and password-reset links land
 * correctly when a new staff member opens them.
 */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    storage: splitStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
