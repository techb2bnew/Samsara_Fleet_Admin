-- ============================================================================
-- Hours of service  (2 tables)   -- admin module A06
-- ============================================================================
-- The driver's legal record of duty status, and the daily certification that
-- makes it an official log.
--
-- Two tables, not four. Deliberately missing:
--
--   hos_violations   - a violation is derived from these events against the
--                      rule set in force. Storing it freezes yesterday's
--                      arithmetic: change a limit and the stored rows start
--                      lying. It is computed on read.
--   hos_log_edits    - an edit IS an event. It is a row here with edit_of_id
--                      pointing at what it proposes to change, so the original
--                      and the correction live in one timeline rather than two
--                      tables that must be stitched together to answer "what
--                      did this driver's day actually look like".
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.duty_status as enum (
  'off_duty',
  'sleeper_berth',
  'driving',
  'on_duty_not_driving',
  -- Driving that does not count against the driving limit. Both are heavily
  -- audited, which is why they are their own statuses rather than a flag.
  'personal_conveyance',
  'yard_move'
);

create type public.duty_event_source as enum (
  'automatic',    -- the device recorded it from vehicle movement
  'manual',       -- the driver entered it
  'carrier_edit'  -- the office proposed it
);

create type public.duty_edit_status as enum ('pending', 'accepted', 'rejected');


-- ---------------------------------------------------------------------------
-- duty_status_events
-- ---------------------------------------------------------------------------
-- Append-only. This is the record a roadside inspection or an audit reads, so
-- a row can be superseded but never rewritten and never deleted. The trigger
-- below enforces that in the database rather than trusting every future code
-- path to remember.
--
-- Only the start time is stored. A status runs until the next event, which
-- means a day can never contain a gap or an overlap - both of which are
-- possible, and common, when start and end are stored separately.

create table public.duty_status_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid        not null references public.organizations(id) on delete cascade,
  driver_id      uuid        not null references public.drivers(id)       on delete cascade,
  vehicle_id     uuid references public.vehicles(id) on delete set null,

  status         public.duty_status       not null,
  started_at     timestamptz              not null,
  source         public.duty_event_source not null default 'manual',

  -- Where and what the truck read when the status changed. Required on the
  -- official log; also what makes a suspicious edit visible.
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  location_name  text,
  odometer_km    numeric(12,2),
  engine_hours   numeric(10,2),

  -- The driver's own note. Some statuses are not accepted without one.
  annotation     text,

  -- Set when this row proposes a change to an earlier one. The office may
  -- suggest a correction, but only the driver can accept it - a carrier that
  -- can silently rewrite a driver's log is the exact abuse the rules exist to
  -- prevent.
  edit_of_id     uuid references public.duty_status_events(id) on delete restrict,
  edit_status    public.duty_edit_status,
  edit_reason    text,
  proposed_by    uuid references public.users(id) on delete set null,
  reviewed_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- An edit is exactly the rows that point at another row. Neither half of the
  -- pair can exist without the other.
  constraint duty_events_edit_pair check (
    (edit_of_id is null and edit_status is null)
    or (edit_of_id is not null and edit_status is not null)
  ),
  constraint duty_events_no_self_edit check (edit_of_id is null or edit_of_id <> id),
  constraint duty_events_latitude_range  check (latitude  is null or latitude  between  -90 and  90),
  constraint duty_events_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint duty_events_odometer_not_negative check (odometer_km is null or odometer_km >= 0)
);

comment on table public.duty_status_events is
  'Append-only duty status record. Corrections are new rows via edit_of_id; nothing is ever rewritten.';

comment on column public.duty_status_events.started_at is
  'When the status began. It runs until the next event, so days cannot gap or overlap.';

comment on column public.duty_status_events.edit_status is
  'Pending until the driver accepts or rejects. A carrier cannot change a log unilaterally.';

-- The log grid reads one driver's day at a time; this is the query that has to
-- stay fast as the table grows into millions of rows.
create index duty_events_driver_time_idx on public.duty_status_events (driver_id, started_at desc);
create index duty_events_org_time_idx    on public.duty_status_events (org_id, started_at desc);
create index duty_events_vehicle_idx     on public.duty_status_events (vehicle_id, started_at desc)
  where vehicle_id is not null;

-- The office's review queue: edits still waiting on a driver.
create index duty_events_pending_edits_idx on public.duty_status_events (org_id, created_at desc)
  where edit_status = 'pending';

create index duty_events_edit_of_idx on public.duty_status_events (edit_of_id)
  where edit_of_id is not null;


-- ---------------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------------
-- Application code will get this right today. This is about the day someone
-- writes a "fix the bad row" script at 2am.

create or replace function public.duty_status_events_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'duty_status_events is append-only: row % cannot be deleted', old.id
      using errcode = 'restrict_violation';
  end if;

  -- An original record is final the moment it is written.
  if old.edit_of_id is null then
    raise exception 'duty_status_events is append-only: row % cannot be updated, write a correction instead', old.id
      using errcode = 'restrict_violation';
  end if;

  -- An edit may only have its outcome recorded. What it proposes is fixed.
  if new.driver_id  is distinct from old.driver_id
     or new.status  is distinct from old.status
     or new.started_at  is distinct from old.started_at
     or new.edit_of_id  is distinct from old.edit_of_id
     or new.edit_reason is distinct from old.edit_reason
     or new.proposed_by is distinct from old.proposed_by then
    raise exception 'only the review outcome of a proposed edit may be changed'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.duty_status_events_append_only() is
  'Blocks deletes, blocks edits to original records, and limits edit rows to their review outcome.';

create trigger duty_events_append_only
  before update or delete on public.duty_status_events
  for each row execute function public.duty_status_events_append_only();

create trigger duty_events_set_updated_at before update on public.duty_status_events
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- hos_daily_logs
-- ---------------------------------------------------------------------------
-- One row per driver per calendar day, holding the certification.
--
-- This cannot be derived from the events above. Certifying a day is a separate
-- legal act by the driver - "I confirm this record is correct" - and a day with
-- identical events is a different thing certified and uncertified. The console's
-- hours grid is built on exactly this distinction.
--
-- log_date is a date, not a timestamp: the legal day is the driver's home
-- terminal day, already resolved when the row is written.

create table public.hos_daily_logs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid        not null references public.organizations(id) on delete cascade,
  driver_id        uuid        not null references public.drivers(id)       on delete cascade,

  log_date         date        not null,

  certified_at     timestamptz,
  -- Re-certification after a later edit is normal and is itself auditable, so
  -- the count is kept rather than silently overwriting the first signature.
  certified_count  smallint    not null default 0,
  signature_path   text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint hos_daily_logs_certified_consistent check (
    (certified_at is null and certified_count = 0)
    or (certified_at is not null and certified_count > 0)
  )
);

comment on table public.hos_daily_logs is
  'Per-driver per-day certification. Certifying is a legal act and cannot be derived from duty events.';

create unique index hos_daily_logs_driver_date_idx
  on public.hos_daily_logs (driver_id, log_date);

-- "Show me everything still uncertified" - the compliance officer's first
-- question every morning.
create index hos_daily_logs_uncertified_idx on public.hos_daily_logs (org_id, log_date desc)
  where certified_at is null;

create trigger hos_daily_logs_set_updated_at before update on public.hos_daily_logs
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.duty_status_events enable row level security;
alter table public.hos_daily_logs     enable row level security;


-- duty_status_events --------------------------------------------------------

create policy duty_events_select_org on public.duty_status_events
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy duty_events_select_self on public.duty_status_events
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

-- A driver writes their own record. This is the normal path: the log is theirs.
create policy duty_events_insert_self on public.duty_status_events
  for insert to authenticated
  with check (driver_id = (select public.current_driver_id()));

-- The driver accepts or rejects a proposed edit. The trigger already limits
-- what may change; this limits who may change it.
create policy duty_events_review_self on public.duty_status_events
  for update to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

-- The office may propose corrections, and nothing else. There is no update
-- policy for staff on purpose: a carrier cannot accept its own edit.
create policy duty_events_propose_edit on public.duty_status_events
  for insert to authenticated
  with check (
    edit_of_id is not null
    and edit_status = 'pending'
    and (select public.has_org_role(org_id, array['fleet_admin','compliance_officer']))
  );


-- hos_daily_logs ------------------------------------------------------------

create policy hos_daily_logs_select_org on public.hos_daily_logs
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy hos_daily_logs_select_self on public.hos_daily_logs
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

-- Only the driver signs their own day.
create policy hos_daily_logs_self_write on public.hos_daily_logs
  for all to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- No delete on either table. The append-only trigger would reject it anyway;
-- withholding the grant means the attempt fails before it reaches the trigger.

grant select, insert, update on public.duty_status_events to authenticated;
grant select, insert, update on public.hos_daily_logs     to authenticated;
