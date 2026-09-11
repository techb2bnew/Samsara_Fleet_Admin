-- ============================================================================
-- Daily rest: the hours off duty a driver needs before driving again
-- ============================================================================
-- The one rule of the three that was asked for and that real ELD software
-- actually enforces.
--
--   FMCSA 395.3(a)(1)  10 consecutive hours off duty before driving again
--   EU 561/2006 art.8  11 hours daily rest (reducible to 9, three times a week)
--
-- Both are CONSECUTIVE, and that word is the whole rule. A driver who takes
-- five hours off, works, and takes five more has not rested — under either
-- regime they are not fit to drive, and a check that added the two together
-- would tell them they were compliant when they were not. Being wrong in that
-- direction is the only kind of wrong that matters here.
--
-- Nullable, like duty_window_minutes: a fleet's own rule book may simply not
-- have such a rule, and "no such rule" has to be expressible rather than
-- standing in as a zero.
-- ============================================================================

alter table public.hos_rule_books
  add column if not exists daily_rest_minutes integer;

comment on column public.hos_rule_books.daily_rest_minutes is
  'Consecutive minutes off duty required before driving again. Null when the rule book has no such rule.';

/*
 * Four hours to eighteen. Bounds, not a judgement: below four nothing that
 * could be called a daily rest fits, and above eighteen there is no day left
 * to drive in. The regimes this stands in for sit at 10 and 11.
 */
alter table public.hos_rule_books
  drop constraint if exists hos_rule_books_daily_rest_sane;

alter table public.hos_rule_books
  add constraint hos_rule_books_daily_rest_sane
  check (daily_rest_minutes is null or daily_rest_minutes between 240 and 1080);
