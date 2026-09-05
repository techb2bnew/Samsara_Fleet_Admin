-- ============================================================================
-- Depots: one word, one link
-- ============================================================================
-- The product has always had exactly one idea here — a place a driver is based
-- at and a vehicle is kept at — and three names for it. The table is `fleets`,
-- the drivers screen calls it "Home terminal", the users screen calls it
-- "Fleet", and reports call it "Depot". Same row every time.
--
-- The UI settles on "Depot", which is what the yard actually says. The table
-- keeps its name: renaming it would touch six foreign keys to buy nothing.
--
-- Two real problems get fixed here.
--
-- 1. Drivers were linked to their depot BY NAME, in drivers.home_terminal,
--    while everything else used fleet_id. Renaming a depot silently broke
--    every driver in it: the reports filter stopped matching, and the driver's
--    detail page showed a depot that no longer existed. drivers.fleet_id has
--    existed since the first migration and was never populated.
--
-- 2. A depot had no timezone. The working-hours day boundary is a property of
--    the depot, not of the phone — a driver crossing a timezone must not have
--    their legal day shift under them. It was stored per driver and defaulted
--    to UTC, so every driver in Pune was being measured on a London day.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. A depot has a timezone
-- ---------------------------------------------------------------------------

alter table public.fleets
  add column timezone text not null default 'UTC';

comment on column public.fleets.timezone is
  'IANA name, e.g. Asia/Kolkata. The working-hours day for drivers based here is cut in this timezone. A driver row may override it.';

comment on table public.fleets is
  'A depot: somewhere drivers are based and vehicles are kept. Called "Depot" throughout the UI; the table keeps the name fleets because six foreign keys point at it.';


-- ---------------------------------------------------------------------------
-- 2. Every name in home_terminal becomes a real depot
-- ---------------------------------------------------------------------------
-- Nothing is lost. A depot that was only ever typed as free text on a driver
-- becomes a row, so the backfill below can find it and the office can see it.
-- Blank and whitespace-only values are not depots and are skipped.

insert into public.fleets (org_id, name)
select distinct d.org_id, btrim(d.home_terminal)
from public.drivers d
where d.home_terminal is not null
  and length(btrim(d.home_terminal)) > 0
  and not exists (
    select 1 from public.fleets f
    where f.org_id = d.org_id
      and lower(btrim(f.name)) = lower(btrim(d.home_terminal))
      and f.deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 3. Point drivers at the row instead of the string
-- ---------------------------------------------------------------------------

update public.drivers d
set fleet_id = f.id
from public.fleets f
where d.fleet_id is null
  and d.home_terminal is not null
  and f.org_id = d.org_id
  and f.deleted_at is null
  and lower(btrim(f.name)) = lower(btrim(d.home_terminal));


-- ---------------------------------------------------------------------------
-- 4. The string goes
-- ---------------------------------------------------------------------------
-- Keeping both would leave two answers to "which depot is this driver at?",
-- and the console would have to pick one every time it read a driver.

alter table public.drivers
  drop column home_terminal;

comment on column public.drivers.fleet_id is
  'The depot this driver is based at. Their working-hours day is cut in the depot timezone unless drivers.timezone overrides it.';

comment on column public.drivers.timezone is
  'Overrides the depot timezone for this driver. Set from the depot when the driver is created.';


-- ---------------------------------------------------------------------------
-- 5. Counting drivers and vehicles per depot
-- ---------------------------------------------------------------------------
-- The depots screen shows both counts. Partial indexes so archived rows and
-- drivers with no depot cost nothing.

create index if not exists drivers_fleet_idx on public.drivers (fleet_id)
  where fleet_id is not null and deleted_at is null;

create index if not exists vehicles_fleet_idx on public.vehicles (fleet_id)
  where fleet_id is not null and deleted_at is null;
