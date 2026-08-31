-- ============================================================================
-- service_role grants
-- ============================================================================
-- The project was created with "automatically expose new tables" off, which
-- withholds grants from every Data API role - including service_role. That is
-- the right default for `authenticated`, where each table should be opened
-- deliberately, but it also blocks the trusted server-side paths:
--
--   - Edge Functions doing work no end user should be able to do directly
--     (the HOS rule engine, the nightly scoring jobs, the DOT export)
--   - the RLS test suite, which needs to build two separate companies before
--     it can prove they cannot see each other
--
-- service_role already bypasses row-level security by design, so granting it
-- table access adds no new exposure. It is not reachable from a browser or a
-- phone: the secret key never leaves the server.
--
-- Default privileges are set as well as the explicit grants, so every table in
-- later migrations is covered without anyone having to remember. `authenticated`
-- deliberately gets no such default - each table stays closed until a migration
-- opens it on purpose.
-- ============================================================================

-- Existing tables.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future tables, so this never has to be repeated.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

grant usage on schema public to service_role;
