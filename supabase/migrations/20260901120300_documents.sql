-- ============================================================================
-- Documents  (1 table, replacing 2)   -- admin module A10
-- ============================================================================
-- One table for every file the fleet keeps, replacing driver_documents and
-- vehicle_documents.
--
-- Why one:
--
--   - The documents screen lists everything at once, sorted and paged. Three
--     tables means three queries, merged and sorted in JavaScript, with
--     pagination done by hand.
--   - Expiry warnings get written once. As two tables they were written once,
--     for drivers, and vehicle insurance and fitness certificates - the ones
--     that stop a truck at a checkpoint - were quietly not covered.
--   - One upload path, one storage convention, one RLS policy. Trailer and
--     organisation paperwork need no further tables.
--
-- These are still real foreign keys, not a polymorphic owner_type/owner_id
-- pair, so cascade delete still works and a document cannot point at a driver
-- who does not exist. It is the same one-owner pattern already used by
-- work_orders and maintenance_schedules.
--
-- The one thing to watch: a single policy now guards every kind of document,
-- so a mistake in it is a mistake everywhere. That is the trade, and it is why
-- the driver rule below is written narrowly.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
-- Two kinds of paperwork with genuinely different rules, in one table.
--
--   compliance - a licence, medical certificate, insurance, fitness. Belongs
--                to exactly one thing, expires, and drives alerts.
--   trip       - a bill of lading, proof of delivery, fuel docket. Belongs to
--                a driver AND a vehicle AND usually a stop, never expires.
--
-- The owner constraint below is written per category rather than forcing trip
-- paperwork into a shape that does not fit it.

create type public.document_category as enum ('compliance', 'trip');


-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,

  category          public.document_category not null,

  driver_id         uuid references public.drivers(id)     on delete cascade,
  vehicle_id        uuid references public.vehicles(id)    on delete cascade,
  trailer_id        uuid references public.trailers(id)    on delete cascade,
  asset_id          uuid references public.assets(id)      on delete cascade,
  route_id          uuid references public.routes(id)      on delete set null,
  stop_id           uuid references public.route_stops(id) on delete set null,

  doc_type          text        not null,   -- licence, medical, insurance, bill_of_lading
  title             text,                   -- what the file is called on screen
  reference         text,                   -- licence or policy number

  -- Compliance only. Null on trip paperwork, which is what the partial index
  -- below relies on.
  issuing_authority text,
  issued_on         date,
  expires_on        date,

  -- Path inside the Supabase storage bucket. The file itself is not in the
  -- database.
  storage_path      text,
  mime_type         text,
  size_bytes        bigint,

  uploaded_by_user  uuid references public.users(id)   on delete set null,
  uploaded_by_driver uuid references public.drivers(id) on delete set null,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  -- Compliance paperwork belongs to exactly one thing. Trip paperwork belongs
  -- to the job, which is several things at once.
  constraint documents_owner_present check (
    case category
      when 'compliance' then num_nonnulls(driver_id, vehicle_id, trailer_id, asset_id) = 1
      else num_nonnulls(driver_id, vehicle_id, trailer_id, asset_id, route_id, stop_id) >= 1
    end
  ),
  -- An expiry date on a fuel receipt means someone filed it in the wrong
  -- category, and it would show up in the compliance warnings.
  constraint documents_trip_has_no_expiry check (
    category = 'compliance' or expires_on is null
  ),
  constraint documents_type_not_blank check (length(btrim(doc_type)) > 0),
  constraint documents_dates_ordered check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  ),
  constraint documents_size_not_negative check (size_bytes is null or size_bytes >= 0)
);

comment on table public.documents is
  'Every file the fleet keeps: compliance paperwork and trip paperwork, in one table with one upload path.';

comment on column public.documents.category is
  'compliance paperwork has one owner and an expiry; trip paperwork belongs to the job and never expires.';

-- The expiry warning query. Partial, so it stays small even when trip
-- paperwork - which is the high-volume half - fills the table.
create index documents_expiring_idx on public.documents (org_id, expires_on)
  where expires_on is not null and deleted_at is null;

create index documents_org_idx      on public.documents (org_id, created_at desc) where deleted_at is null;
create index documents_category_idx on public.documents (org_id, category) where deleted_at is null;
create index documents_driver_idx   on public.documents (driver_id)  where deleted_at is null and driver_id  is not null;
create index documents_vehicle_idx  on public.documents (vehicle_id) where deleted_at is null and vehicle_id is not null;
create index documents_trailer_idx  on public.documents (trailer_id) where deleted_at is null and trailer_id is not null;
create index documents_route_idx    on public.documents (route_id)   where deleted_at is null and route_id   is not null;

create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Move the existing rows across
-- ---------------------------------------------------------------------------
-- Both source tables hold compliance paperwork only, so the category is fixed.

insert into public.documents (
  id, org_id, category, driver_id,
  doc_type, reference, issuing_authority, issued_on, expires_on, storage_path,
  created_at, updated_at, deleted_at
)
select
  id, org_id, 'compliance', driver_id,
  doc_type, reference, issuing_authority, issued_on, expires_on, storage_path,
  created_at, updated_at, deleted_at
from public.driver_documents;

insert into public.documents (
  id, org_id, category, vehicle_id, trailer_id, asset_id,
  doc_type, reference, issuing_authority, issued_on, expires_on, storage_path,
  created_at, updated_at, deleted_at
)
select
  id, org_id, 'compliance', vehicle_id, trailer_id, asset_id,
  doc_type, reference, issuing_authority, issued_on, expires_on, storage_path,
  created_at, updated_at, deleted_at
from public.vehicle_documents;

drop table public.driver_documents;
drop table public.vehicle_documents;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;

create policy documents_select_org on public.documents
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

-- A driver sees their own paperwork and the paperwork of the vehicle they are
-- currently assigned to - they need the truck's insurance and fitness papers at
-- a checkpoint. Not the whole fleet's, and never another driver's licence.
create policy documents_select_self on public.documents
  for select to authenticated
  using (
    driver_id = (select public.current_driver_id())
    or exists (
      select 1
      from public.driver_vehicle_assignments a
      where a.driver_id = (select public.current_driver_id())
        and a.vehicle_id = documents.vehicle_id
        and a.ended_at is null
    )
  );

-- Drivers upload trip paperwork from the cab. They cannot file compliance
-- documents: a driver who can add their own medical certificate can extend it.
create policy documents_insert_trip_self on public.documents
  for insert to authenticated
  with check (
    category = 'trip'
    and uploaded_by_driver = (select public.current_driver_id())
  );

create policy documents_write on public.documents
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.documents to authenticated;
