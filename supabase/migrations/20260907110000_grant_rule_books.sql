-- ============================================================================
-- Grants on hos_rule_books
-- ============================================================================
-- The table went out with row-level security and policies and no GRANT, which
-- are two different things and only one of them was done.
--
-- RLS decides WHICH ROWS a role may see. A grant decides whether the role may
-- touch the table at all. Without the grant, PostgREST refuses before any
-- policy is consulted — "permission denied for table hos_rule_books" — and
-- because loadSettings read the rule books alongside the organisation and
-- threw on any error, one missing grant blanked out the organisation's name,
-- country and timezone on the settings screen.
--
-- Every other table in this schema has these; this one was new and nothing
-- grants them automatically.
-- ============================================================================

grant select, insert, update, delete on public.hos_rule_books to authenticated;

/*
 * anon gets select to match the rest of the schema, and reaches nothing: there
 * is no policy for anon, and RLS denies by default. Kept consistent so a
 * future audit of grants does not find one table shaped differently for a
 * reason nobody wrote down.
 */
grant select on public.hos_rule_books to anon;

grant all on public.hos_rule_books to service_role;
