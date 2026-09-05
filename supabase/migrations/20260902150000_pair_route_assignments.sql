-- Live routes already named a driver and a vehicle, but the fleet lists read
-- driver_vehicle_assignments, not routes. Pair them once, without moving anyone
-- who already has an open assignment.

with ranked as (
  select
    r.org_id,
    r.driver_id,
    r.vehicle_id,
    row_number() over (
      partition by r.driver_id
      order by r.planned_start_at desc nulls last, r.created_at desc
    ) as driver_rank,
    row_number() over (
      partition by r.vehicle_id
      order by r.planned_start_at desc nulls last, r.created_at desc
    ) as vehicle_rank
  from public.routes r
  where r.deleted_at is null
    and r.driver_id is not null
    and r.vehicle_id is not null
    and r.status in ('planned', 'dispatched', 'in_progress')
)
insert into public.driver_vehicle_assignments (org_id, driver_id, vehicle_id, started_at)
select org_id, driver_id, vehicle_id, now()
from ranked
where driver_rank = 1
  and vehicle_rank = 1
  and not exists (
    select 1
    from public.driver_vehicle_assignments a
    where a.ended_at is null
      and a.driver_id = ranked.driver_id
  )
  and not exists (
    select 1
    from public.driver_vehicle_assignments a
    where a.ended_at is null
      and a.vehicle_id = ranked.vehicle_id
  );
