-- ============================================================================
-- The rest of a fleet's own shift rules
-- ============================================================================
-- A fleet asked for a day shaped like this:
--
--     8h driving  +  10h rest  +  3h break  +  3h loading  =  24h
--
-- Three of those are not expressible yet. daily_driving_minutes covers the
-- first and daily_rest_minutes the second; the break and the loading have no
-- ceiling, and nothing says a break has to be earned before it is taken.
--
-- ---------------------------------------------------------------------------
-- These are policy, not law, and the column names say so
-- ---------------------------------------------------------------------------
-- Worth writing down because it will be asked again. Neither FMCSA nor EU
-- 561/2006 contains any of the three:
--
--   * no regime forbids resting early. Both REQUIRE a break after so much
--     driving; neither sets a minimum before one is allowed.
--   * no regime caps a break. Under FMCSA a ten-hour off-duty period is the
--     thing that legally ENDS a shift, so a cap would flag a driver's lawful
--     night as a breach.
--   * no regime caps on-duty-not-driving on its own; it is capped indirectly,
--     through the duty window and the cycle.
--
-- They are still worth having: a fleet running to an internal shift plan wants
-- them enforced, and enforcing them here is better than a supervisor checking
-- by eye. They live on hos_rule_books alongside the legal limits, nullable, so
-- a fleet on a legal regime simply leaves them unset and sees nothing.
--
-- The console words them as the fleet's own and the violations they raise are
-- labelled that way too. What must never happen is one of these appearing in
-- an inspector's report as though a regulation had been broken.
-- ============================================================================

alter table public.hos_rule_books
  add column if not exists min_work_before_break_minutes integer,
  add column if not exists max_break_minutes integer,
  add column if not exists max_on_duty_minutes integer;

comment on column public.hos_rule_books.min_work_before_break_minutes is
  'Fleet policy: work required before a break may be taken. Null for no such rule. Not a legal limit.';
comment on column public.hos_rule_books.max_break_minutes is
  'Fleet policy: longest single break. Null for no such rule. Not a legal limit.';
comment on column public.hos_rule_books.max_on_duty_minutes is
  'Fleet policy: longest on-duty-not-driving time in a day. Null for no such rule. Not a legal limit.';

/*
 * Bounds, not judgements. Each one is a span inside a single day, so a day is
 * the ceiling; the floors keep out the values that could only be a typo.
 */
alter table public.hos_rule_books
  drop constraint if exists hos_rule_books_min_work_sane;
alter table public.hos_rule_books
  add constraint hos_rule_books_min_work_sane
  check (
    min_work_before_break_minutes is null
    -- Cannot require more work before a break than the day allows driving,
    -- or the break could never legally be taken at all.
    or min_work_before_break_minutes between 15 and daily_driving_minutes
  );

alter table public.hos_rule_books
  drop constraint if exists hos_rule_books_max_break_sane;
alter table public.hos_rule_books
  add constraint hos_rule_books_max_break_sane
  check (
    max_break_minutes is null
    -- A cap shorter than the break the rules REQUIRE would contradict itself.
    or max_break_minutes between break_length_minutes and 1440
  );

alter table public.hos_rule_books
  drop constraint if exists hos_rule_books_max_on_duty_sane;
alter table public.hos_rule_books
  add constraint hos_rule_books_max_on_duty_sane
  check (max_on_duty_minutes is null or max_on_duty_minutes between 15 and 1440);
