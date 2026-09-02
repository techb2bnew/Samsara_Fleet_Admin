-- ============================================================================
-- Safety and training  (3 tables)   -- admin modules A12, A13
-- ============================================================================
-- Harsh-driving events with their coaching outcome, and the training library
-- with who has been assigned what.
--
-- No coaching_assignments table. A coaching session is the response to one
-- safety event and never exists without it, so it is columns on that event.
-- A second table would be one row per event, joined every time the list is
-- drawn, holding nothing the event could not hold itself.
--
-- Training does need two tables: many drivers take one course, and each of
-- them has their own due date, progress and score.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.safety_event_type as enum (
  'harsh_braking',
  'harsh_acceleration',
  'sharp_turn',
  'speeding',
  'following_too_close',
  'collision',
  'other'
);

create type public.safety_severity as enum ('low', 'medium', 'high');

create type public.safety_event_status as enum (
  'new',
  'coachable',   -- reviewed, coaching to be given
  'coached',     -- coaching done
  'dismissed'    -- reviewed, no action needed
);

create type public.course_status as enum ('draft', 'published', 'archived');

create type public.assignment_status as enum (
  'assigned',
  'in_progress',
  'completed',
  'overdue'      -- kept for the driver's own record; the console computes it
);


-- ---------------------------------------------------------------------------
-- safety_events
-- ---------------------------------------------------------------------------
-- Coaching lives in the coaching_* columns rather than its own table. They are
-- null until a reviewer decides the event is worth coaching.

create table public.safety_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,

  driver_id     uuid references public.drivers(id)  on delete set null,
  vehicle_id    uuid references public.vehicles(id) on delete set null,

  event_type    public.safety_event_type not null,
  severity      public.safety_severity   not null default 'low',
  status        public.safety_event_status not null default 'new',

  occurred_at   timestamptz not null,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  location_name text,

  speed_kph     numeric(6,2),
  speed_limit_kph numeric(6,2),
  video_path    text,

  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,

  -- Coaching, folded in.
  coach_user_id     uuid references public.users(id) on delete set null,
  coaching_due_on   date,
  coaching_note     text,
  coaching_done_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint safety_events_speed_not_negative check (
    (speed_kph is null or speed_kph >= 0) and (speed_limit_kph is null or speed_limit_kph >= 0)
  ),
  constraint safety_events_latitude_range  check (latitude  is null or latitude  between  -90 and  90),
  constraint safety_events_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint safety_events_reviewed_consistent check (
    status = 'new' or reviewed_at is not null
  ),
  constraint safety_events_coached_consistent check (
    status <> 'coached' or coaching_done_at is not null
  )
);

comment on table public.safety_events is
  'Harsh-driving and incident events. The coaching response is columns here, not a second table.';

create index safety_events_org_time_idx  on public.safety_events (org_id, occurred_at desc) where deleted_at is null;
create index safety_events_driver_idx    on public.safety_events (driver_id, occurred_at desc)
  where deleted_at is null and driver_id is not null;
create index safety_events_status_idx    on public.safety_events (org_id, status) where deleted_at is null;

-- The safety manager's queue.
create index safety_events_open_idx on public.safety_events (org_id, occurred_at desc)
  where status in ('new','coachable') and deleted_at is null;


-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid        not null references public.organizations(id) on delete cascade,

  title            text        not null,
  description      text,
  content_url      text,
  length_minutes   integer,
  status           public.course_status not null default 'draft',

  -- Null means every driver in the organisation.
  assigned_fleet_id uuid references public.fleets(id) on delete set null,

  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint courses_title_not_blank check (length(btrim(title)) > 0),
  constraint courses_length_positive check (length_minutes is null or length_minutes > 0)
);

comment on table public.courses is
  'Training library. Assignment counts are computed from course_assignments, never stored here.';

create index courses_org_idx    on public.courses (org_id) where deleted_at is null;
create index courses_status_idx on public.courses (org_id, status) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- course_assignments
-- ---------------------------------------------------------------------------
-- One driver's copy of one course: their due date, their progress, their score.

create table public.course_assignments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  course_id     uuid        not null references public.courses(id) on delete cascade,
  driver_id     uuid        not null references public.drivers(id) on delete cascade,

  -- Set when the course was assigned as a response to an incident, so the
  -- safety screen can show the loop being closed.
  safety_event_id uuid references public.safety_events(id) on delete set null,

  status        public.assignment_status not null default 'assigned',
  assigned_by   uuid references public.users(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  due_on        date,
  started_at    timestamptz,
  completed_at  timestamptz,
  score_percent smallint,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint course_assignments_score_range check (
    score_percent is null or score_percent between 0 and 100
  ),
  constraint course_assignments_progress_ordered check (
    started_at is null or completed_at is null or completed_at >= started_at
  ),
  constraint course_assignments_completion_consistent check (
    status <> 'completed' or completed_at is not null
  )
);

comment on table public.course_assignments is
  'One driver on one course. Separate from courses because each driver has their own due date, progress and score.';

-- A driver is on a course once. Re-assigning after completion is a new row
-- only once the old one is soft-deleted, which keeps the history honest.
create unique index course_assignments_unique_idx
  on public.course_assignments (course_id, driver_id)
  where deleted_at is null;

create index course_assignments_driver_idx on public.course_assignments (driver_id) where deleted_at is null;
create index course_assignments_course_idx on public.course_assignments (course_id) where deleted_at is null;
create index course_assignments_due_idx    on public.course_assignments (org_id, due_on)
  where status <> 'completed' and deleted_at is null;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger safety_events_set_updated_at before update on public.safety_events
  for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger course_assignments_set_updated_at before update on public.course_assignments
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.safety_events      enable row level security;
alter table public.courses            enable row level security;
alter table public.course_assignments enable row level security;


-- safety_events -------------------------------------------------------------
-- A driver sees their own events. Seeing a colleague's harsh-braking record is
-- neither their business nor good for the workplace.

create policy safety_events_select_org on public.safety_events
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy safety_events_select_self on public.safety_events
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

create policy safety_events_write on public.safety_events
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])));


-- courses -------------------------------------------------------------------

create policy courses_select_org on public.courses
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy courses_write on public.courses
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])));


-- course_assignments --------------------------------------------------------

create policy course_assignments_select_org on public.course_assignments
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy course_assignments_select_self on public.course_assignments
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

-- A driver records their own progress. They cannot assign themselves a course
-- or hand one to somebody else, because with-check pins driver_id to them.
create policy course_assignments_progress_self on public.course_assignments
  for update to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

create policy course_assignments_write on public.course_assignments
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','safety_manager'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.safety_events      to authenticated;
grant select, insert, update, delete on public.courses            to authenticated;
grant select, insert, update, delete on public.course_assignments to authenticated;
