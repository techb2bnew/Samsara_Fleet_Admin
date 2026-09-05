-- ============================================================================
-- Telling somebody a truck is taken, instead of failing at them
-- ============================================================================
-- Two unique indexes have always guarded this table:
--
--   dva_active_driver_idx    one open assignment per driver
--   dva_active_vehicle_idx   one open assignment per vehicle
--
-- They work. What was missing is everything around them. A driver picking a
-- truck their colleague is already on got a raw unique-violation from Postgres
-- — and got it AFTER the app had already closed their own assignment, so they
-- ended the trip with no truck at all and a message about a duplicate key.
--
-- Nothing here loosens those indexes. It gives both sides a way to ask the
-- question before doing the thing, and makes the driver's own sign-on atomic
-- so a refusal leaves them exactly where they were.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Which trucks are already taken
-- ---------------------------------------------------------------------------
-- A driver cannot read this from the table. dva_select_self returns their own
-- assignments and nothing else, so from the app every truck in the depot looks
-- free — including the one somebody is sitting in.
--
-- Security definer, and returning ONLY vehicle ids. The driver needs to know a
-- truck is unavailable, which is a fact about the truck; who is on it is a
-- fact about a colleague, and widening this to names would hand every driver a
-- live roster of where everyone is. The office already reads the table
-- directly and can show names there.

create or replace function public.taken_vehicle_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.vehicle_id
  from public.driver_vehicle_assignments a
  where a.ended_at is null
    and a.org_id = (select public.current_driver_org_id())
    -- Their own truck is not "taken" from where they are standing.
    and a.driver_id is distinct from (select public.current_driver_id())
$$;

comment on function public.taken_vehicle_ids is
  'Vehicle ids with an open assignment to somebody else in the caller''s organisation. Security definer because dva_select_self hides colleagues rows; returns ids only, never who is on them.';

revoke all on function public.taken_vehicle_ids() from public;
grant execute on function public.taken_vehicle_ids() to authenticated;


-- ---------------------------------------------------------------------------
-- Signing on, atomically
-- ---------------------------------------------------------------------------
-- The app used to close the driver's current assignment and then insert the
-- new one, as two statements. When the second failed the first had already
-- committed, which is how a driver ended up on nothing.
--
-- One function is one transaction: it either moves them or leaves them alone,
-- and it raises a message the app can put in front of a person rather than a
-- constraint name.

create or replace function public.sign_on_to_vehicle(p_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select public.current_driver_id());
  v_org uuid := (select public.current_driver_org_id());
  v_taken_by uuid;
  v_name text;
  v_id uuid;
begin
  if v_driver is null then
    raise exception 'Not a driver on this account.' using errcode = '42501';
  end if;

  -- Own organisation, and a truck that is fit to drive. Checked here rather
  -- than trusted from the app: this function runs as definer, so it is the
  -- only thing standing between a crafted id and another company's fleet.
  select v.name into v_name
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.org_id = v_org
    and v.deleted_at is null
    and v.status = 'active';

  if not found then
    raise exception 'That truck is not available.' using errcode = 'P0002';
  end if;

  select a.driver_id into v_taken_by
  from public.driver_vehicle_assignments a
  where a.vehicle_id = p_vehicle_id
    and a.ended_at is null
    and a.driver_id is distinct from v_driver;

  if found then
    -- The vehicle's name, not the colleague's. Same reasoning as
    -- taken_vehicle_ids: the driver needs to know which truck to stop trying.
    raise exception 'Another driver is signed on to %.', coalesce(v_name, 'that truck')
      using errcode = 'P0001';
  end if;

  -- Already on it. Returning the existing row rather than churning the
  -- assignment keeps started_at meaning "when this driver got in".
  select a.id into v_id
  from public.driver_vehicle_assignments a
  where a.vehicle_id = p_vehicle_id and a.driver_id = v_driver and a.ended_at is null;
  if found then
    return v_id;
  end if;

  update public.driver_vehicle_assignments
    set ended_at = now()
  where driver_id = v_driver and ended_at is null;

  insert into public.driver_vehicle_assignments (org_id, driver_id, vehicle_id, started_at)
  values (v_org, v_driver, p_vehicle_id, now())
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.sign_on_to_vehicle is
  'Moves the calling driver onto a vehicle in one transaction. Raises a readable message when the truck is taken, rather than letting dva_active_vehicle_idx fail after the old assignment has already been closed.';

revoke all on function public.sign_on_to_vehicle(uuid) from public;
grant execute on function public.sign_on_to_vehicle(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- What else a driver is already committed to
-- ---------------------------------------------------------------------------
-- Deliberately NOT a unique index.
--
-- A dispatcher plans tomorrow's route this afternoon, and the driver is on
-- today's. A database constraint saying "one open route per driver" would
-- refuse the normal case to prevent the mistaken one, and the office would end
-- up planning routes against nobody and pairing them up by hand.
--
-- So this is a question, not a rule: it tells the dispatch screen what the
-- driver is already on, and the screen puts that in front of the person making
-- the decision. Anything a fleet legitimately does at 4pm on a Tuesday should
-- not be blocked by an index.

create or replace function public.driver_commitments(p_org_id uuid)
returns table (
  driver_id uuid,
  vehicle_id uuid,
  vehicle_name text,
  open_route_id uuid,
  open_route_reference text,
  open_route_status public.route_status
)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    a.vehicle_id,
    coalesce(nullif(btrim(v.name), ''), v.plate),
    r.id,
    r.reference,
    r.status
  from public.drivers d
  left join public.driver_vehicle_assignments a
    on a.driver_id = d.id and a.ended_at is null
  left join public.vehicles v
    on v.id = a.vehicle_id
  left join lateral (
    select r2.id, r2.reference, r2.status
    from public.routes r2
    where r2.driver_id = d.id
      and r2.deleted_at is null
      and r2.status in ('planned', 'dispatched', 'in_progress')
    order by r2.planned_start_at nulls last
    limit 1
  ) r on true
  where d.org_id = p_org_id
    and d.deleted_at is null
$$;

comment on function public.driver_commitments is
  'Per driver: the truck they are on and the earliest route still open. Feeds the dispatch screen so a dispatcher sees who is already committed before they assign. Not security definer — the office reads these tables anyway, and RLS should still apply.';
