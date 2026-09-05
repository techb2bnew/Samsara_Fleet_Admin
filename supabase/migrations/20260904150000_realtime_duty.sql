-- ============================================================================
-- The driver's own duty log on the wire
-- ============================================================================
-- The realtime migration before this one argued for keeping duty events OFF
-- the wire:
--
--   "Everything else a driver sees — their own duty events, their own
--    inspections — they did themselves and already know about, and putting
--    those on the wire would push a phone's own writes back to it."
--
-- That held while a driver had one phone. They do not. The same login on a
-- second device — a spare in the cab, a tablet in the depot, a phone being
-- replaced — is a driver whose two screens disagree about what duty status
-- they are in, and duty status is their legal record. A stale screen is how a
-- driver goes on duty twice, or certifies a day that is missing an hour.
--
-- The echo the old comment worried about is real but cheap: a phone hears its
-- own insert and re-reads a list it has already updated. The client collapses
-- a burst of these into one read. Two screens that agree is worth one query.
--
-- Still narrow. Two tables, each subscription filtered to the one driver
-- server-side, and the driver-scoped select policies are evaluated per row on
-- the socket — a phone cannot be handed a colleague's log even if the filter
-- were dropped.
-- ============================================================================

alter publication supabase_realtime add table public.duty_status_events;
alter publication supabase_realtime add table public.hos_daily_logs;

/*
 * FULL on both, for the same reason routes and assignments have it.
 *
 * Neither table is only ever inserted into. A duty event is updated when a
 * correction is proposed and again when the office reviews it, and a daily log
 * is updated when it is certified — which is the one change the other phone
 * most needs to hear, because certifying twice is a thing a driver can be
 * asked about at the roadside.
 */
alter table public.duty_status_events replica identity full;
alter table public.hos_daily_logs replica identity full;
