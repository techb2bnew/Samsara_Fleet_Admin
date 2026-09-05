-- ============================================================================
-- What the driver app is allowed to read
-- ============================================================================
-- A driver has no row in user_roles. The invite creates an auth account, a
-- users row and sets drivers.user_id — that is all. Every org-wide policy in
-- this schema rests on current_org_ids(), which reads only user_roles, so it
-- returns nothing for a driver.
--
-- That was right for the tables a driver must not browse, and it silently took
-- away five things the app genuinely needs. The symptom is the bad kind: no
-- error, zero rows. The app shows an empty list and looks like a fleet with no
-- vehicles in it.
--
-- Everything below is a SELECT policy scoped through the driver's own record.
-- Policies are OR'd, so the office keeps the access it already had.
--
-- ---------------------------------------------------------------------------
-- Decisions being locked in here, and why they should not need reversing
-- ---------------------------------------------------------------------------
-- 1. Vehicles are scoped to the driver's depot, OR to a vehicle they are
--    already assigned to. The second half is not decoration: depot-only would
--    hand an empty picker to a driver seconded to another depot, and a driver
--    who cannot pick a truck cannot start a shift, log hours, or report a
--    position. The office can pre-assign across depots and it still works.
--
-- 2. Courses include anything the driver has an assignment for, not just what
--    is scoped to their depot. A course assigned to one driver by name has no
--    fleet on it, so a depot-only rule would make exactly those invisible.
--
-- 3. Work orders cover every vehicle the driver has EVER been assigned to, not
--    only the current one. A driver reports a brake defect on Tuesday and is in
--    a different truck on Wednesday; "was it fixed?" is a fair question and
--    their own history is the bounded way to answer it.
--
-- Deliberately NOT granted, so the next person does not assume it was missed:
--   - other drivers' rows, on any table
--   - the roster, the depot list, staff, audit, alert rules, reports
--   - defects reported by other drivers on the same vehicle. Arguably useful
--     as "known issues" on a pre-trip, but it exposes colleagues' reports and
--     is a widening to make on purpose, not by accident.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- security definer, so a policy on public.drivers can call one of these
-- without re-entering that table's own policies and recursing.

create or replace function public.current_driver_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.org_id
  from public.drivers d
  where d.user_id = (select auth.uid())
    and d.deleted_at is null
  limit 1
$$;

comment on function public.current_driver_org_id is
  'The organisation of the signed-in driver, or null when the caller is not a driver. Basis of the driver-side RLS policies, the way current_org_ids() is for office staff.';

create or replace function public.current_driver_fleet_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.fleet_id
  from public.drivers d
  where d.user_id = (select auth.uid())
    and d.deleted_at is null
  limit 1
$$;

comment on function public.current_driver_fleet_id is
  'The depot of the signed-in driver. Null when they have no depot set, which is a setup gap rather than an error — the vehicle policy falls back to whatever they are already assigned to.';

revoke execute on function public.current_driver_org_id()   from public;
revoke execute on function public.current_driver_fleet_id() from public;
grant  execute on function public.current_driver_org_id()   to authenticated;
grant  execute on function public.current_driver_fleet_id() to authenticated;


-- ---------------------------------------------------------------------------
-- Their own organisation
-- ---------------------------------------------------------------------------
-- Name for the header, timezone and regulator so the app can work out the
-- legal day and which hours limits to warn against.

create policy organizations_select_driver on public.organizations
  for select to authenticated
  using (id = (select public.current_driver_org_id()));


-- ---------------------------------------------------------------------------
-- Vehicles they could be driving
-- ---------------------------------------------------------------------------

create policy vehicles_select_driver on public.vehicles
  for select to authenticated
  using (
    deleted_at is null
    and org_id = (select public.current_driver_org_id())
    and (
      -- Their depot's trucks: the shift-start picker.
      (fleet_id is not null and fleet_id = (select public.current_driver_fleet_id()))
      -- Or one they are already on, wherever it is kept. This is what keeps a
      -- cross-depot assignment, and a driver with no depot set, working.
      or exists (
        select 1
        from public.driver_vehicle_assignments a
        where a.vehicle_id = public.vehicles.id
          and a.driver_id = (select public.current_driver_id())
      )
    )
  );


-- ---------------------------------------------------------------------------
-- Forms they have to fill in
-- ---------------------------------------------------------------------------
-- Published only — a draft is the office still writing it. The app asks for
-- the newest version per key, the same way the console does; RLS cannot
-- express "newest" and should not try.

create policy forms_select_driver on public.forms
  for select to authenticated
  using (
    deleted_at is null
    and status = 'published'
    and org_id = (select public.current_driver_org_id())
    and (
      assigned_fleet_id is null
      or assigned_fleet_id = (select public.current_driver_fleet_id())
    )
  );


-- ---------------------------------------------------------------------------
-- Courses they have to do
-- ---------------------------------------------------------------------------

create policy courses_select_driver on public.courses
  for select to authenticated
  using (
    deleted_at is null
    and status = 'published'
    and org_id = (select public.current_driver_org_id())
    and (
      assigned_fleet_id is null
      or assigned_fleet_id = (select public.current_driver_fleet_id())
      -- Assigned to them by name, which carries no fleet.
      or exists (
        select 1
        from public.course_assignments ca
        where ca.course_id = public.courses.id
          and ca.driver_id = (select public.current_driver_id())
          and ca.deleted_at is null
      )
    )
  );


-- ---------------------------------------------------------------------------
-- Repairs on trucks they have driven
-- ---------------------------------------------------------------------------
-- Read only. Opening a work order stays with fleet_admin and mechanic — the
-- driver's half of that conversation is a defect.

create policy work_orders_select_driver on public.work_orders
  for select to authenticated
  using (
    deleted_at is null
    and org_id = (select public.current_driver_org_id())
    and exists (
      select 1
      from public.driver_vehicle_assignments a
      where a.vehicle_id = public.work_orders.vehicle_id
        and a.driver_id = (select public.current_driver_id())
    )
  );
