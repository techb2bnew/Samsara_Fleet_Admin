/**
 * Switch between the mock data the console was built on and the real Supabase
 * backend.
 *
 *   VITE_USE_MOCK_DATA=true    screens read from src/mocks  (default)
 *   VITE_USE_MOCK_DATA=false   screens read from Supabase
 *
 * This flag covers SCREEN DATA ONLY — drivers, vehicles, hours, inspections and
 * the rest. It has no say over signing in. Auth is always real: the only way
 * into the console is an account that exists in Supabase, whatever this is set
 * to. See features/auth/AuthProvider.
 *
 * Set it in `.env.local` and restart the dev server — Vite reads env at build
 * time, so changing it while the server is running has no effect.
 *
 * It defaults to mock when unset. A missing or misspelled variable then leaves
 * the console working on mock data, rather than silently pointing a half-wired
 * screen at a live database.
 *
 * Nothing about the mocks is deleted while this exists. Each module is switched
 * over as its backend lands, and the mocks come out only once every screen is
 * reading from Supabase.
 */
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false'

/**
 * Which roles may sign into the admin console.
 *
 * One role for now, by decision: the console is being built for the fleet
 * admin, and the other roles have no screens of their own yet. A dispatcher
 * who signed in today would get the full fifteen-module sidebar and a set of
 * screens that either show everything or, where row-level security stops them,
 * nothing at all. Being told there is no access is the clearer answer.
 *
 * Row-level security already decides what each role can READ. This decides who
 * gets through the door, which is a product decision, not a security one -
 * removing a role from this list does not make the data any safer.
 *
 * To open the console to more roles, add their keys here. Nothing else changes.
 */
export const CONSOLE_ROLES = ['fleet_admin'] as const
