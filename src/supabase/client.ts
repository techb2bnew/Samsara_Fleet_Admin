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
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
