-- ============================================================================
-- A driver can raise a work order, and both sides see the inspection loop live
-- ============================================================================
-- The office was the only thing that could open a work order, and it opened
-- one off the back of a defect. That is still the shape for anything an
-- inspection finds. What it could not do is the case the fleet actually asked
-- for: a driver who knows a job needs doing — "the AC has gone", "it needs a
-- service before Monday" — and had no way to say so except a message somebody
-- had to read and re-type.
--
-- So a driver may open one, and the row remembers that they did. The office
-- still owns everything that costs money.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Who asked for it
-- ---------------------------------------------------------------------------
-- opened_by cannot answer this: it references users, which is office staff.
-- A driver has no row there — they are a drivers row with an auth account —
-- so a driver-raised order would have to leave opened_by null and become
-- indistinguishable from one the system created.
--
-- The column matters beyond bookkeeping. A workshop triaging a morning's
-- queue treats "the driver says the brakes feel soft" differently from a
-- scheduled service, and an auditor asking who first reported a fault needs
-- the answer to be a person.

alter table public.work_orders
  add column if not exists requested_by_driver uuid references public.drivers(id) on delete set null;

comment on column public.work_orders.requested_by_driver is
  'The driver who raised this from the app, or null when the office opened it. opened_by cannot hold this: it references users, and a driver has no users row.';

create index if not exists work_orders_requested_by_driver_idx
  on public.work_orders (requested_by_driver)
  where requested_by_driver is not null;


-- ---------------------------------------------------------------------------
-- What a driver may open
-- ---------------------------------------------------------------------------
-- Narrow on purpose, and every clause is answering a way this goes wrong:
--
--   own org, own truck    a driver cannot raise work against the depot's
--                         other vehicles, let alone another company's
--   requested_by_driver   forced to themselves, so the row cannot be filed
--                         under a colleague's name
--   status = 'open'       a driver cannot file something already completed,
--                         which would put a repair in the record that never
--                         happened
--   no money, no owner    labour, parts and assigned_to stay null. A driver
--                         does not know what a job costs and does not decide
--                         which mechanic takes it; those are the fields the
--                         workshop fills in, and a request that arrives with
--                         them pre-filled is a request that gets trusted
--   no schedule           schedule_id belongs to planned maintenance, which
--                         the office owns
--
-- There is deliberately no UPDATE policy. A driver raises a request and then
-- watches it; a driver who could edit a work order could mark their own truck
-- repaired.

drop policy if exists work_orders_insert_driver on public.work_orders;
create policy work_orders_insert_driver on public.work_orders
  for insert to authenticated
  with check (
    org_id = (select public.current_driver_org_id())
    and requested_by_driver = (select public.current_driver_id())
    and status = 'open'
    and exists (
      select 1
      from public.driver_vehicle_assignments a
      where a.vehicle_id = work_orders.vehicle_id
        and a.driver_id = (select public.current_driver_id())
    )
    and assigned_to is null
    and schedule_id is null
    and labour_hours is null
    and labour_cost_cents is null
    and parts_cost_cents is null
    and completed_at is null
  );


-- ---------------------------------------------------------------------------
-- The loop, live on both sides
-- ---------------------------------------------------------------------------
-- The inspection chain is the one place in this system where two people are
-- waiting on each other. A driver files a defect and then wants to know
-- somebody picked it up; the workshop closes a job and the driver needs to
-- know before they walk out to the truck. Reloading a screen to find out is
-- how a driver drives away on an unrepaired fault.
--
-- Each of these already has a driver-scoped select policy, and RLS is
-- evaluated per row on the socket, so adding them to the publication widens
-- what is delivered live without widening who may see it.

alter publication supabase_realtime add table public.work_orders;
alter publication supabase_realtime add table public.defects;
alter publication supabase_realtime add table public.form_submissions;

/*
 * FULL on all three. Every one of them is interesting precisely when it is
 * UPDATED rather than inserted — a work order moving to in_progress, a defect
 * being resolved, a submission being reviewed — and without it an update
 * arrives as a bare key that the client can only make sense of if it already
 * held the row.
 */
alter table public.work_orders replica identity full;
alter table public.defects replica identity full;
alter table public.form_submissions replica identity full;
