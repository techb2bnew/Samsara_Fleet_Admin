/**
 * Console-wide configuration.
 *
 * There is no mock-data switch any more. Every screen reads from Supabase, and
 * a screen with nothing behind it shows an empty state rather than invented
 * rows. Nothing in the console can be reached with data that did not come out
 * of the database.
 */

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
