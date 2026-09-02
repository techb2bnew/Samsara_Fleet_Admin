-- ============================================================================
-- Dispatch  (2 tables)   -- admin module A08
-- ============================================================================
-- Planned work: a route, and the stops on it.
--
-- Two tables is the floor here. A stop cannot be a column on a route - there
-- are many per route, each with its own time window, arrival and status - and
-- a route cannot be a property of a stop.
--
-- Deliberately missing:
--
--   route_status_history - the console shows the current state of a route, not
--                          a state machine's diary. The audit log records who
--                          dispatched what; that covers the real question.
--   geofences            - nothing in the admin console uses them yet. Adding
--                          the table now would be a table nothing writes to.
-- ============================================================================


create type public.route_status as enum (
  'planned',
  'dispatched',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.stop_status as enum (
  'pending',
  'arrived',
  'completed',
  'skipped',
  'failed'      -- attempted, could not be delivered
);


-- ---------------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------------
-- "Late" is not a stored status. It is planned_end_at compared against now and
-- the stops still outstanding, so a route cannot sit in the database marked
-- on-time while the clock says otherwise.

create table public.routes (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid        not null references public.organizations(id) on delete cascade,
  fleet_id           uuid references public.fleets(id) on delete set null,

  reference          text        not null,   -- NL-4471
  name               text,

  driver_id          uuid references public.drivers(id)  on delete set null,
  vehicle_id         uuid references public.vehicles(id) on delete set null,
  trailer_id         uuid references public.trailers(id) on delete set null,

  status             public.route_status not null default 'planned',

  planned_start_at   timestamptz,
  planned_end_at     timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,

  planned_distance_km numeric(10,2),
  notes              text,

  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint routes_reference_not_blank check (length(btrim(reference)) > 0),
  constraint routes_planned_window_ordered check (
    planned_start_at is null or planned_end_at is null or planned_end_at >= planned_start_at
  ),
  constraint routes_actual_window_ordered check (
    started_at is null or completed_at is null or completed_at >= started_at
  ),
  constraint routes_completion_consistent check (
    status <> 'completed' or completed_at is not null
  ),
  constraint routes_distance_not_negative check (
    planned_distance_km is null or planned_distance_km >= 0
  )
);

comment on table public.routes is
  'A planned day of work for one driver and vehicle. Lateness is computed against planned_end_at, never stored.';

create unique index routes_reference_idx on public.routes (org_id, upper(btrim(reference)))
  where deleted_at is null;

create index routes_org_status_idx on public.routes (org_id, status) where deleted_at is null;
create index routes_driver_idx     on public.routes (driver_id, planned_start_at desc)
  where deleted_at is null and driver_id is not null;
create index routes_vehicle_idx    on public.routes (vehicle_id, planned_start_at desc)
  where deleted_at is null and vehicle_id is not null;

-- The dispatch board: everything not yet finished.
create index routes_open_idx on public.routes (org_id, planned_start_at)
  where status in ('planned','dispatched','in_progress') and deleted_at is null;


-- ---------------------------------------------------------------------------
-- route_stops
-- ---------------------------------------------------------------------------
-- Latitude and longitude are plain numbers rather than a PostGIS geography
-- column. The console reads them straight onto a map, and PostgREST returns
-- geography as hex, which every caller would then have to decode. When a
-- feature genuinely needs spatial querying - nearest depot, geofence entry -
-- a generated geography column can be added over these two without touching
-- anything that already reads them.

create table public.route_stops (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  route_id        uuid        not null references public.routes(id) on delete cascade,

  sequence        integer     not null,
  name            text        not null,
  address         text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),

  window_start_at timestamptz,
  window_end_at   timestamptz,

  arrived_at      timestamptz,
  departed_at     timestamptz,
  status          public.stop_status not null default 'pending',

  contact_name    text,
  contact_phone   text,
  instructions    text,
  failure_reason  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint route_stops_name_not_blank check (length(btrim(name)) > 0),
  constraint route_stops_sequence_positive check (sequence > 0),
  constraint route_stops_window_ordered check (
    window_start_at is null or window_end_at is null or window_end_at >= window_start_at
  ),
  constraint route_stops_visit_ordered check (
    arrived_at is null or departed_at is null or departed_at >= arrived_at
  ),
  constraint route_stops_arrival_consistent check (
    status not in ('arrived','completed') or arrived_at is not null
  ),
  constraint route_stops_latitude_range  check (latitude  is null or latitude  between  -90 and  90),
  constraint route_stops_longitude_range check (longitude is null or longitude between -180 and 180)
);

comment on table public.route_stops is
  'Stops on a route, in visiting order. Deleted with the route: a stop has no meaning without one.';

-- Two stops cannot claim the same position in the order.
create unique index route_stops_sequence_idx on public.route_stops (route_id, sequence);

create index route_stops_route_idx  on public.route_stops (route_id, sequence);
create index route_stops_org_idx    on public.route_stops (org_id);
create index route_stops_pending_idx on public.route_stops (route_id)
  where status = 'pending';


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger routes_set_updated_at before update on public.routes
  for each row execute function public.set_updated_at();
create trigger route_stops_set_updated_at before update on public.route_stops
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.routes      enable row level security;
alter table public.route_stops enable row level security;


-- routes --------------------------------------------------------------------

create policy routes_select_org on public.routes
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy routes_select_self on public.routes
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

-- A driver marks their own route started and finished, and nothing else. They
-- cannot reassign it or hand it to someone else, because the with-check keeps
-- driver_id pointed at them.
create policy routes_progress_self on public.routes
  for update to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

create policy routes_write on public.routes
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])));


-- route_stops ---------------------------------------------------------------
-- A driver's access follows the route they are on, so these policies join back
-- to routes rather than repeating the rule.

create policy route_stops_select_org on public.route_stops
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy route_stops_select_self on public.route_stops
  for select to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and r.driver_id = (select public.current_driver_id())
    )
  );

create policy route_stops_progress_self on public.route_stops
  for update to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and r.driver_id = (select public.current_driver_id())
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and r.driver_id = (select public.current_driver_id())
    )
  );

create policy route_stops_write on public.route_stops
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.routes      to authenticated;
grant select, insert, update, delete on public.route_stops to authenticated;
