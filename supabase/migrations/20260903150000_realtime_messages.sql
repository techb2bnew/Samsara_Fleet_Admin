-- ============================================================================
-- Live messages
-- ============================================================================
-- The office sends a message and the driver's phone does not know. The driver
-- replies and the console does not know. Both sides only ever read on load, so
-- a conversation needed one of them to reopen the screen — and the driver's
-- messages tab does not even remount when they switch tabs, so it never
-- refreshed at all.
--
-- Realtime needs two things, and neither existed: the table has to be in the
-- publication Supabase listens on, and each side has to subscribe.
--
-- Only `messages` is added here, deliberately. A chat is the one place where
-- waiting for a refresh is wrong — the driver is standing at a gate reading
-- "call the office". Duty events, inspections and routes are all fine to load
-- on open, and putting every table on the wire would mean every phone in the
-- fleet holding a socket for changes it does not display.
--
-- Row-level security still applies. Realtime evaluates the subscriber's own
-- policies per row, so a driver's socket carries their thread and nothing
-- else — the same rule as the query.
-- ============================================================================

alter publication supabase_realtime add table public.messages;

/*
 * A read receipt is an UPDATE, and postgres_changes only carries the columns
 * in the replica identity for the OLD row. The default is the primary key,
 * which is enough to deliver the new row — but not to tell a client which
 * driver's thread an update belonged to if the row is no longer visible to
 * them. FULL costs a little WAL on a table that holds short text rows, and it
 * makes the update self-describing.
 */
alter table public.messages replica identity full;
