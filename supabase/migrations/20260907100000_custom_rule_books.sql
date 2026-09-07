-- ============================================================================
-- Rule books a fleet can write for itself
-- ============================================================================
-- FMCSA and EU stay in code. Their limits come out of 49 CFR 395.3 and
-- Regulation (EC) 561/2006, they are commented with those citations, and a
-- fleet that picks one gets a calculation somebody has checked against the
-- law.
--
-- This table is for the case those two do not cover: a fleet operating
-- somewhere with its own rules, or to its own stricter internal policy. It sits
-- ALONGSIDE the built-ins rather than replacing them.
--
-- ---------------------------------------------------------------------------
-- The risk, and what is done about it
-- ---------------------------------------------------------------------------
-- These numbers drive the violations engine and the remaining-hours clocks a
-- driver looks at before deciding whether to keep going. A typo here does not
-- produce a wrong figure on a report; it tells a driver they are legal when
-- they are not.
--
-- That cannot be designed away, because the office asked to be able to set it.
-- What CAN be done is refuse the values that are definitely wrong, so a
-- mistyped digit is rejected at the database rather than believed:
--
--   * a driving limit longer than the day it sits in
--   * a duty window shorter than the driving allowed inside it
--   * a break threshold longer than the whole driving limit
--   * a cycle shorter than a single day's driving
--
-- Every check below is one of those — a bound no real rule book could be
-- outside of. None of them is a judgement about what a sensible policy is.
--
-- Minutes throughout, matching the engines on both sides. Hours would need a
-- fraction for the EU's 4h30 break threshold.
-- ============================================================================

create table if not exists public.hos_rule_books (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,

  name text not null,

  daily_driving_minutes integer not null,
  /*
   * Nullable on purpose, and not an oversight to be tidied up later. The EU
   * has no duty-window limit at all, so "no such rule" has to be expressible
   * — a 0 or a 24-hour default would both show the driver a clock that means
   * nothing.
   */
  duty_window_minutes integer,
  driving_before_break_minutes integer not null,
  break_length_minutes integer not null,
  cycle_minutes integer not null,
  cycle_days integer not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hos_rule_books_name_not_blank
    check (length(btrim(name)) > 0),

  -- A day is 1440 minutes. Nothing in here can exceed one.
  constraint hos_rule_books_daily_driving_sane
    check (daily_driving_minutes between 60 and 1440),

  -- Null is fine; a window that does not contain its own driving limit is not.
  constraint hos_rule_books_duty_window_sane
    check (
      duty_window_minutes is null
      or duty_window_minutes between daily_driving_minutes and 1440
    ),

  -- Driving before a break cannot exceed the driving allowed in the whole day.
  constraint hos_rule_books_break_threshold_sane
    check (driving_before_break_minutes between 30 and daily_driving_minutes),

  constraint hos_rule_books_break_length_sane
    check (break_length_minutes between 5 and 480),

  -- A fortnight is the longest cycle any regime uses; one day's driving is the
  -- shortest a cycle could possibly be.
  constraint hos_rule_books_cycle_sane
    check (cycle_minutes between daily_driving_minutes and 20160),

  constraint hos_rule_books_cycle_days_sane
    check (cycle_days between 1 and 14),

  -- One name per fleet, so a dropdown never shows the same label twice.
  constraint hos_rule_books_name_unique unique (org_id, name)
);

comment on table public.hos_rule_books is
  'Rule books a fleet writes for itself, used when neither FMCSA nor EU applies. Built-in regimes stay in application code.';

create index if not exists hos_rule_books_org_idx
  on public.hos_rule_books (org_id);


-- ---------------------------------------------------------------------------
-- Which one an organisation is on
-- ---------------------------------------------------------------------------
-- hos_regulator keeps naming a built-in. This names a custom book, and when it
-- is set it wins. Both null means no rule book is chosen and every clock on
-- the driver's hours screen shows a dash, which is what happens today.

alter table public.organizations
  add column if not exists hos_rule_book_id uuid
    /*
     * RESTRICT, not SET NULL.
     *
     * Set-null would let somebody delete the rule book their fleet runs on and
     * have every driver's remaining-hours clock silently change — or empty —
     * with nothing said and nothing to point at afterwards. Restrict makes the
     * console say "this one is in use, move the fleet off it first", which is
     * a sentence somebody can act on.
     */
    references public.hos_rule_books (id) on delete restrict;

comment on column public.organizations.hos_rule_book_id is
  'A custom rule book from hos_rule_books. When set it overrides hos_regulator.';


-- ---------------------------------------------------------------------------
-- Who can see and change them
-- ---------------------------------------------------------------------------

alter table public.hos_rule_books enable row level security;

-- The office, for its own fleets.
drop policy if exists hos_rule_books_all on public.hos_rule_books;
create policy hos_rule_books_all on public.hos_rule_books
  for all to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (org_id in (select public.current_org_ids()));

/*
 * And the driver, read-only.
 *
 * Not optional: the app calculates its own violations and its own clocks on
 * the phone, so without these numbers it cannot draw the hours screen. A
 * driver has no user_roles row, which is why current_org_ids() does not cover
 * them and this second policy exists.
 */
drop policy if exists hos_rule_books_select_driver on public.hos_rule_books;
create policy hos_rule_books_select_driver on public.hos_rule_books
  for select to authenticated
  using (org_id = (select public.current_driver_org_id()));


-- ---------------------------------------------------------------------------
-- Audited, like every other setting
-- ---------------------------------------------------------------------------
-- A change to these numbers changes what the law appears to say to every
-- driver in the fleet. If anything in this schema belongs in the trail, it is
-- this.

drop trigger if exists audit_hos_rule_books on public.hos_rule_books;
create trigger audit_hos_rule_books
  after insert or update or delete on public.hos_rule_books
  for each row execute function public.write_audit_log();
