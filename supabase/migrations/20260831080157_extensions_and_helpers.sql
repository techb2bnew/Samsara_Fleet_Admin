-- ============================================================================
-- Extensions and table-independent helpers
-- ============================================================================
-- Runs first. Everything here is used by later migrations and depends on no
-- table of ours, which is the rule for what belongs in this file.
--
-- The tenancy helpers (current_org_ids, is_super_admin, has_org_role) are NOT
-- here even though they are used everywhere. A `language sql` function has its
-- body validated the moment it is created, so a helper that reads user_roles
-- cannot be defined before user_roles exists. Each helper therefore lives in
-- the same migration as the table it reads.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- gen_random_uuid() for primary keys.
create extension if not exists "pgcrypto" with schema extensions;

-- Geometry types and spatial indexes, for location_pings, geofences and
-- route_stops. Installed now because adding it later means rewriting those
-- tables rather than altering them.
create extension if not exists "postgis" with schema extensions;

-- Trigram search, used for driver and vehicle name lookups in the console.
create extension if not exists "pg_trgm" with schema extensions;


-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
-- Attached as a trigger to every table with an updated_at column, so the
-- application can never forget to set it.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at on every UPDATE.';
