-- ============================================================================
-- A driver can take back a repair request, and only that
-- ============================================================================
-- Drivers can raise work orders. There was no way to withdraw one, so a
-- request typed by mistake, or fixed at the roadside ten minutes later, sat in
-- the workshop's queue until somebody in the office noticed and cancelled it.
--
-- What a driver may do here is deliberately one thing:
--
--   cancel, and only while it is still OPEN
--     Once the workshop has assigned it or started work, cancelling would
--     pull a job out from under a mechanic who is holding a spanner.
--
--   their OWN request, never one the office raised
--     requested_by_driver is the test. A defect the office turned into a work
--     order is the office's job to call off.
--
-- There is still no way for a driver to mark anything completed, and there
-- should not be. A driver who could close a repair could close one that never
-- happened, and the next person to read that record is an inspector asking why
-- a truck with a reported brake fault was on the road.
-- ============================================================================

drop policy if exists work_orders_cancel_own_driver on public.work_orders;
create policy work_orders_cancel_own_driver on public.work_orders
  for update to authenticated
  using (
    deleted_at is null
    and requested_by_driver = (select public.current_driver_id())
    and status = 'open'
  )
  with check (
    requested_by_driver = (select public.current_driver_id())
    -- The only destination. Without this the USING clause would let an open
    -- request be moved to in_progress or completed by the person who raised it.
    and status = 'cancelled'
    -- Everything the workshop owns has to still be untouched, for the same
    -- reason the insert policy refuses it: a row that arrives with a mechanic
    -- and a cost attached is a row that gets trusted.
    and assigned_to is null
    and labour_hours is null
    and labour_cost_cents is null
    and parts_cost_cents is null
    and completed_at is null
  );

comment on policy work_orders_cancel_own_driver on public.work_orders is
  'A driver may cancel a repair request they raised, while it is still open. Not complete it — a driver who could close a repair could close one that never happened.';
