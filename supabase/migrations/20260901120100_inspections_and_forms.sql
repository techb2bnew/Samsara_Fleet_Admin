-- ============================================================================
-- Forms, submissions and defects  (3 tables)   -- admin modules A07, A09
-- ============================================================================
-- Three tables cover both the form builder and vehicle inspections, because a
-- DVIR is a form. Deliberately missing:
--
--   form_fields       - a field has no life of its own. It exists only as part
--                       of a form, is only ever read with that form, and is
--                       never queried across forms. It lives in forms.fields
--                       as JSONB, which also removes a join from every render.
--   inspections       - an inspection is a form submission whose form is the
--   inspection_items    pre-trip or post-trip form. Two tables for "the same
--                       thing, filled in by a driver" would mean two upload
--                       paths, two review flows and two sets of RLS.
--
-- Defects stay separate, and that is not inconsistency. A defect outlives the
-- submission that found it: it gets a work order, a mechanic, a repair and a
-- sign-off, on its own timeline. An answer inside a form does not.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.form_status as enum ('draft', 'published', 'archived');

create type public.form_kind as enum (
  'dvir_pre',    -- pre-trip inspection
  'dvir_post',   -- post-trip inspection
  'custom'       -- anything the office builds
);

create type public.submission_status as enum (
  'submitted',
  'reviewed',
  'flagged'      -- reviewed and something needs doing
);

create type public.defect_severity as enum (
  'minor',
  'major',
  'out_of_service'   -- the vehicle must not be driven
);

create type public.defect_status as enum ('open', 'in_repair', 'resolved', 'dismissed');


-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
-- A published form is never edited in place. Editing creates the next version
-- as a new row, and submissions point at the exact version they were filled
-- in on. Without this, changing a question silently rewrites history: an
-- inspection from March would render against April's questions, and its answers
-- would line up with the wrong labels.

create table public.forms (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,

  -- Stable across versions. Version 1 and version 4 of the pre-trip form share
  -- a key, which is how "the current pre-trip form" is found.
  key           text        not null,
  version       integer     not null default 1,

  name          text        not null,
  description   text,
  kind          public.form_kind   not null default 'custom',
  status        public.form_status not null default 'draft',

  -- [{ id, label, type, required, options: [] }]
  fields        jsonb       not null default '[]'::jsonb,

  -- Null means every driver in the organisation.
  assigned_fleet_id uuid references public.fleets(id) on delete set null,

  created_by    uuid references public.users(id) on delete set null,
  published_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint forms_key_not_blank  check (length(btrim(key)) > 0),
  constraint forms_name_not_blank check (length(btrim(name)) > 0),
  constraint forms_version_positive check (version > 0),
  constraint forms_fields_is_array check (jsonb_typeof(fields) = 'array'),
  constraint forms_published_has_timestamp check (
    status <> 'published' or published_at is not null
  )
);

comment on table public.forms is
  'Versioned form definitions. Editing a published form creates the next version so old submissions still render correctly.';

comment on column public.forms.fields is
  'Field list as JSONB. Fields are only ever read with their form, so a separate table would add a join and buy nothing.';

create unique index forms_key_version_idx on public.forms (org_id, key, version)
  where deleted_at is null;

-- One published version per key at a time, so "the current form" is never
-- ambiguous.
create unique index forms_one_published_idx on public.forms (org_id, key)
  where status = 'published' and deleted_at is null;

create index forms_org_idx  on public.forms (org_id) where deleted_at is null;
create index forms_kind_idx on public.forms (org_id, kind) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- form_submissions
-- ---------------------------------------------------------------------------
-- One filled-in form. A DVIR is one of these; so is a fuel docket or an
-- incident report.
--
-- No deleted_at. An inspection is a legal record that an audit may ask for
-- years later, and a soft-delete column is an invitation to hide one.

create table public.form_submissions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,

  -- restrict, not cascade: deleting a form definition must not take the
  -- inspections filed against it with it.
  form_id       uuid        not null references public.forms(id) on delete restrict,

  driver_id     uuid references public.drivers(id)  on delete set null,
  vehicle_id    uuid references public.vehicles(id) on delete set null,
  trailer_id    uuid references public.trailers(id) on delete set null,

  submitted_at  timestamptz not null default now(),

  -- { fieldId: answer }, matching forms.fields of the referenced version.
  answers       jsonb       not null default '{}'::jsonb,

  odometer_km   numeric(12,2),
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  signature_path text,

  status        public.submission_status not null default 'submitted',
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint submissions_answers_is_object check (jsonb_typeof(answers) = 'object'),
  constraint submissions_reviewed_consistent check (
    (status = 'submitted' and reviewed_at is null)
    or (status <> 'submitted' and reviewed_at is not null)
  ),
  constraint submissions_latitude_range  check (latitude  is null or latitude  between  -90 and  90),
  constraint submissions_longitude_range check (longitude is null or longitude between -180 and 180)
);

comment on table public.form_submissions is
  'A filled-in form. Vehicle inspections (DVIR) are submissions against the pre-trip or post-trip form.';

comment on column public.form_submissions.form_id is
  'The exact form version filled in, so a submission always renders with the questions it was answered against.';

create index submissions_org_time_idx     on public.form_submissions (org_id, submitted_at desc);
create index submissions_form_idx         on public.form_submissions (form_id, submitted_at desc);
create index submissions_driver_idx       on public.form_submissions (driver_id, submitted_at desc)
  where driver_id is not null;
create index submissions_vehicle_idx      on public.form_submissions (vehicle_id, submitted_at desc)
  where vehicle_id is not null;
create index submissions_awaiting_review_idx on public.form_submissions (org_id, submitted_at desc)
  where status = 'submitted';


-- ---------------------------------------------------------------------------
-- defects
-- ---------------------------------------------------------------------------
-- Something found wrong with a vehicle. Usually raised by an inspection, but
-- not always - a mechanic or a dispatcher can raise one directly, which is why
-- submission_id is nullable.
--
-- out_of_service is the severity that matters most: it is the one that must
-- stop the vehicle being dispatched.

create table public.defects (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,

  vehicle_id        uuid references public.vehicles(id) on delete cascade,
  trailer_id        uuid references public.trailers(id) on delete cascade,

  -- Where it was reported, when it came from an inspection.
  submission_id     uuid references public.form_submissions(id) on delete set null,
  reported_by_driver uuid references public.drivers(id) on delete set null,

  area              text        not null,   -- Brakes, Tyres, Lights
  finding           text        not null,
  severity          public.defect_severity not null default 'minor',
  status            public.defect_status   not null default 'open',

  -- The repair job, once one is raised.
  work_order_id     uuid references public.work_orders(id) on delete set null,

  corrective_action text,
  resolved_by       uuid references public.users(id) on delete set null,
  resolved_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  -- Same one-owner pattern as work_orders and maintenance_schedules.
  constraint defects_one_owner check (num_nonnulls(vehicle_id, trailer_id) = 1),
  constraint defects_area_not_blank    check (length(btrim(area)) > 0),
  constraint defects_finding_not_blank check (length(btrim(finding)) > 0),
  constraint defects_resolution_consistent check (
    (status in ('resolved','dismissed') and resolved_at is not null)
    or (status not in ('resolved','dismissed') and resolved_at is null)
  )
);

comment on table public.defects is
  'A fault found on a vehicle or trailer. Separate from submissions because a defect outlives the inspection that found it.';

comment on column public.defects.severity is
  'out_of_service means the vehicle must not be dispatched until the defect is cleared.';

create index defects_org_status_idx on public.defects (org_id, status) where deleted_at is null;
create index defects_vehicle_idx    on public.defects (vehicle_id) where deleted_at is null and vehicle_id is not null;
create index defects_trailer_idx    on public.defects (trailer_id) where deleted_at is null and trailer_id is not null;
create index defects_submission_idx on public.defects (submission_id) where submission_id is not null;

-- The dashboard's "unsafe to drive" figure.
create index defects_unsafe_idx on public.defects (org_id)
  where severity = 'out_of_service' and status in ('open','in_repair') and deleted_at is null;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger forms_set_updated_at before update on public.forms
  for each row execute function public.set_updated_at();
create trigger form_submissions_set_updated_at before update on public.form_submissions
  for each row execute function public.set_updated_at();
create trigger defects_set_updated_at before update on public.defects
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.forms            enable row level security;
alter table public.form_submissions enable row level security;
alter table public.defects          enable row level security;


-- forms ---------------------------------------------------------------------
-- Drivers read forms so the app can render them. Only the office writes them.

create policy forms_select_org on public.forms
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy forms_write on public.forms
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])));


-- form_submissions ----------------------------------------------------------

create policy submissions_select_org on public.form_submissions
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy submissions_select_self on public.form_submissions
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

-- A driver files their own submissions and cannot alter them afterwards. The
-- correction path is a new submission, the same as a paper DVIR book.
create policy submissions_insert_self on public.form_submissions
  for insert to authenticated
  with check (driver_id = (select public.current_driver_id()));

create policy submissions_review on public.form_submissions
  for update to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer','mechanic'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer','mechanic'])));


-- defects -------------------------------------------------------------------

create policy defects_select_org on public.defects
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

-- A driver sees what they reported, and may report more.
create policy defects_select_self on public.defects
  for select to authenticated
  using (reported_by_driver = (select public.current_driver_id()));

create policy defects_insert_self on public.defects
  for insert to authenticated
  with check (reported_by_driver = (select public.current_driver_id()));

create policy defects_write on public.defects
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','mechanic','compliance_officer'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','mechanic','compliance_officer'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- No delete on submissions: they are legal records and have no deleted_at.

grant select, insert, update, delete on public.forms            to authenticated;
grant select, insert, update         on public.form_submissions to authenticated;
grant select, insert, update, delete on public.defects          to authenticated;
