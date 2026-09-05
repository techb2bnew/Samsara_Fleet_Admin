-- ============================================================================
-- Live routes and vehicle assignments, for the driver's notifications
-- ============================================================================
-- The messages migration added one table and argued for keeping the wire
-- narrow. That reasoning still holds; what changed is the requirement.
--
-- A driver has to be told three things without opening the app and looking:
--
--   a message arrived        messages                     (already live)
--   a route was assigned     routes                       added here
--   their truck changed      driver_vehicle_assignments   added here
--
-- All three are things somebody in the office DID TO THEM, which is exactly
-- what a notification is for. Everything else a driver sees — their own duty
-- events, their own inspections — they did themselves and already know about,
-- and putting those on the wire would push a phone's own writes back to it.
--
-- Still narrow: three tables, and each subscription filters to the one driver
-- server-side, so a forty-truck depot does not push forty times the traffic to
-- every phone. Row-level security is evaluated per row on the socket as well,
-- so the filter is about bandwidth and the policy is about privacy.
-- ============================================================================

alter publication supabase_realtime add table public.routes;
alter publication supabase_realtime add table public.driver_vehicle_assignments;

/*
 * Both carry UPDATEs the driver needs to hear about — a route being dispatched,
 * an assignment being ended when the office moves them to another truck. As
 * with messages, FULL makes those updates self-describing rather than the
 * client having to already hold the row to make sense of one.
 */
alter table public.routes replica identity full;
alter table public.driver_vehicle_assignments replica identity full;
