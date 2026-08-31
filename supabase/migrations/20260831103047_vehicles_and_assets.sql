-- ============================================================================
-- Vehicles, assets and maintenance  (7 tables)   -- admin module A05
-- ============================================================================
-- Trucks, trailers and other equipment, the paperwork attached to each, the
-- service schedules that keep them legal, and the repair jobs raised against
-- them.
--
-- Vehicles deliberately do not carry a "current driver" column. Who is driving
-- what changes several times a day and needs history, so it lives in
-- driver_vehicle_assignments in the next migration instead.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

create type public.vehicle_status as enum (
  'active',
  'out_of_service',   -- a serious defect was found; must not be driven
  'in_maintenance',
  'retired'
);

create type public.asset_kind as enum (
  'trailer',
  'container',
  'reefer',
  'generator',
  'other'
);

create type public.work_order_status as enum (
  'open',
  'assigned',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.maintenance_trigger as enum (
  'distance',   -- every N kilometres
  'time'        -- every N days
);


-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid        not null references public.organizations(id) on delete cascade,
  fleet_id       uuid references public.fleets(id) on delete set null,

  vin            text,
  plate          text        not null,
  name           text,                       -- what the yard calls it, e.g. "Truck 12"

  make           text,
  model          text,
  year           smallint,

  status         public.vehicle_status not null default 'active',

  -- Stored in kilometres throughout. Display units are a presentation choice;
  -- mixing units in the database is how mileage reports quietly go wrong.
  odometer_km    numeric(12,2) not null default 0,
  odometer_at    timestamptz,

  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint vehicles_plate_not_blank check (length(btrim(plate)) > 0),
  constraint vehicles_year_sane check (year is null or (year between 1950 and 2100)),
  constraint vehicles_odometer_not_negative check (odometer_km >= 0)
);

comment on table public.vehicles is
  'Powered vehicles. Odometer is always kilometres.';

create unique index vehicles_plate_unique_idx on public.vehicles (org_id, upper(btrim(plate)))
  where deleted_at is null;
create unique index vehicles_vin_unique_idx on public.vehicles (org_id, upper(btrim(vin)))
  where deleted_at is null and vin is not null;

create index vehicles_org_idx    on public.vehicles (org_id) where deleted_at is null;
create index vehicles_fleet_idx  on public.vehicles (fleet_id) where deleted_at is null;
create index vehicles_status_idx on public.vehicles (org_id, status) where deleted_at is null;
create index vehicles_search_idx on public.vehicles using gin (
  (coalesce(plate,'') || ' ' || coalesce(name,'') || ' ' || coalesce(make,'') || ' ' || coalesce(model,''))
  extensions.gin_trgm_ops
);


-- ---------------------------------------------------------------------------
-- trailers
-- ---------------------------------------------------------------------------
-- Kept separate from vehicles rather than folded in with a type column,
-- because a trailer has no engine, no odometer and no driver - and the
-- inspection rules that apply to it are different.

create table public.trailers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  fleet_id   uuid references public.fleets(id) on delete set null,

  number     text        not null,
  vin        text,
  make       text,
  model      text,
  year       smallint,
  status     public.vehicle_status not null default 'active',
  notes      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint trailers_number_not_blank check (length(btrim(number)) > 0)
);

create unique index trailers_number_unique_idx on public.trailers (org_id, upper(btrim(number)))
  where deleted_at is null;
create index trailers_org_idx on public.trailers (org_id) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
-- Anything else worth tracking that is neither a truck nor a trailer.

create table public.assets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  fleet_id   uuid references public.fleets(id) on delete set null,

  kind       public.asset_kind not null default 'other',
  identifier text        not null,
  name       text,
  status     public.vehicle_status not null default 'active',
  notes      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint assets_identifier_not_blank check (length(btrim(identifier)) > 0)
);

create unique index assets_identifier_unique_idx on public.assets (org_id, upper(btrim(identifier)))
  where deleted_at is null;
create index assets_org_idx on public.assets (org_id) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- vehicle_documents
-- ---------------------------------------------------------------------------
-- Registration, insurance, annual inspection certificates. Expiry dates drive
-- the alerts in module A15, which is why expires_on is indexed.
--
-- Exactly one of vehicle_id, trailer_id or asset_id is set.

create table public.vehicle_documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,

  vehicle_id        uuid references public.vehicles(id) on delete cascade,
  trailer_id        uuid references public.trailers(id) on delete cascade,
  asset_id          uuid references public.assets(id)   on delete cascade,

  doc_type          text        not null,
  reference         text,
  issuing_authority text,
  issued_on         date,
  expires_on        date,

  -- Path inside the Supabase storage bucket. The file itself is not in the
  -- database.
  storage_path      text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint vehicle_documents_one_owner check (
    (vehicle_id is not null)::int
    + (trailer_id is not null)::int
    + (asset_id  is not null)::int = 1
  ),
  constraint vehicle_documents_dates_ordered check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  )
);

comment on table public.vehicle_documents is
  'Paperwork for a vehicle, trailer or asset. Exactly one owner column is set.';

create index vehicle_documents_vehicle_idx on public.vehicle_documents (vehicle_id) where deleted_at is null;
create index vehicle_documents_trailer_idx on public.vehicle_documents (trailer_id) where deleted_at is null;
create index vehicle_documents_asset_idx   on public.vehicle_documents (asset_id)   where deleted_at is null;

-- Powers the "expiring soon" alerts without scanning the table.
create index vehicle_documents_expiry_idx on public.vehicle_documents (org_id, expires_on)
  where deleted_at is null and expires_on is not null;


-- ---------------------------------------------------------------------------
-- maintenance_schedules
-- ---------------------------------------------------------------------------
-- A recurring service rule. Either every N kilometres or every N days, never
-- both in one row - a vehicle needing both gets two rows, which keeps "what is
-- overdue" a simple comparison instead of a special case.

create table public.maintenance_schedules (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid        not null references public.organizations(id) on delete cascade,
  vehicle_id         uuid references public.vehicles(id) on delete cascade,
  trailer_id         uuid references public.trailers(id) on delete cascade,

  name               text        not null,
  trigger_type       public.maintenance_trigger not null,

  interval_km        numeric(12,2),
  interval_days      integer,

  -- Snapshot of the last service, used to work out the next one.
  last_service_at    timestamptz,
  last_service_km    numeric(12,2),

  -- Kept as stored columns rather than computed on read, so the overdue query
  -- in the dashboard stays a plain indexed comparison.
  next_due_at        timestamptz,
  next_due_km        numeric(12,2),

  is_active          boolean     not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint maintenance_one_owner check (
    (vehicle_id is not null)::int + (trailer_id is not null)::int = 1
  ),
  constraint maintenance_interval_matches_trigger check (
    (trigger_type = 'distance' and interval_km   is not null and interval_km   > 0 and interval_days is null)
    or
    (trigger_type = 'time'     and interval_days is not null and interval_days > 0 and interval_km   is null)
  )
);

comment on table public.maintenance_schedules is
  'Recurring service rules. One row per rule; distance and time never mix.';

create index maintenance_vehicle_idx  on public.maintenance_schedules (vehicle_id) where deleted_at is null;
create index maintenance_due_at_idx   on public.maintenance_schedules (org_id, next_due_at)
  where deleted_at is null and is_active and next_due_at is not null;
create index maintenance_due_km_idx   on public.maintenance_schedules (org_id, next_due_km)
  where deleted_at is null and is_active and next_due_km is not null;


-- ---------------------------------------------------------------------------
-- work_orders
-- ---------------------------------------------------------------------------
-- A repair job. Raised from a schedule falling due, from a defect found during
-- an inspection, or by hand. The inspection link is added later, once the DVIR
-- tables exist.

create table public.work_orders (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete cascade,

  vehicle_id          uuid references public.vehicles(id) on delete cascade,
  trailer_id          uuid references public.trailers(id) on delete cascade,

  schedule_id         uuid references public.maintenance_schedules(id) on delete set null,

  reference           text,
  title               text        not null,
  description         text,
  status              public.work_order_status not null default 'open',

  assigned_to         uuid references public.users(id) on delete set null,
  opened_by           uuid references public.users(id) on delete set null,

  opened_at           timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,

  odometer_km         numeric(12,2),
  labour_hours        numeric(8,2),
  labour_cost_cents   bigint,
  parts_cost_cents    bigint,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint work_orders_one_owner check (
    (vehicle_id is not null)::int + (trailer_id is not null)::int = 1
  ),
  constraint work_orders_title_not_blank check (length(btrim(title)) > 0),
  constraint work_orders_costs_not_negative check (
    coalesce(labour_cost_cents, 0) >= 0 and coalesce(parts_cost_cents, 0) >= 0
  ),
  -- A completed job must say when it was completed, and an open one must not.
  constraint work_orders_completion_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

comment on table public.work_orders is
  'Repair jobs. Money is stored in integer cents, never floating point.';

create unique index work_orders_reference_idx on public.work_orders (org_id, upper(btrim(reference)))
  where deleted_at is null and reference is not null;

create index work_orders_vehicle_idx  on public.work_orders (vehicle_id) where deleted_at is null;
create index work_orders_open_idx     on public.work_orders (org_id, status) where deleted_at is null;
create index work_orders_assignee_idx on public.work_orders (assigned_to)
  where deleted_at is null and assigned_to is not null;


-- ---------------------------------------------------------------------------
-- work_order_items
-- ---------------------------------------------------------------------------

create table public.work_order_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,
  work_order_id     uuid        not null references public.work_orders(id) on delete cascade,

  description       text        not null,
  part_number       text,
  quantity          numeric(10,2) not null default 1,
  unit_cost_cents   bigint      not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint work_order_items_description_not_blank check (length(btrim(description)) > 0),
  constraint work_order_items_quantity_positive check (quantity > 0),
  constraint work_order_items_cost_not_negative check (unit_cost_cents >= 0)
);

create index work_order_items_order_idx on public.work_order_items (work_order_id);


-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger trailers_set_updated_at before update on public.trailers
  for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger vehicle_documents_set_updated_at before update on public.vehicle_documents
  for each row execute function public.set_updated_at();
create trigger maintenance_schedules_set_updated_at before update on public.maintenance_schedules
  for each row execute function public.set_updated_at();
create trigger work_orders_set_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();
create trigger work_order_items_set_updated_at before update on public.work_order_items
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Read: anyone with a role in the organisation.
-- Write: fleet admins, plus mechanics on the tables they actually work in.

alter table public.vehicles              enable row level security;
alter table public.trailers              enable row level security;
alter table public.assets                enable row level security;
alter table public.vehicle_documents     enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.work_orders           enable row level security;
alter table public.work_order_items      enable row level security;


create policy vehicles_select on public.vehicles
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy vehicles_write on public.vehicles
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


create policy trailers_select on public.trailers
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy trailers_write on public.trailers
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


create policy assets_select on public.assets
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy assets_write on public.assets
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


create policy vehicle_documents_select on public.vehicle_documents
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy vehicle_documents_write on public.vehicle_documents
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


-- Mechanics maintain the service schedules they work to.
create policy maintenance_schedules_select on public.maintenance_schedules
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy maintenance_schedules_write on public.maintenance_schedules
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])));


create policy work_orders_select on public.work_orders
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy work_orders_write on public.work_orders
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])));


-- Line items inherit their parent's organisation. The org_id column is checked
-- directly rather than joined through work_orders, so the policy stays cheap.
create policy work_order_items_select on public.work_order_items
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy work_order_items_write on public.work_order_items
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','mechanic'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.vehicles              to authenticated;
grant select, insert, update, delete on public.trailers              to authenticated;
grant select, insert, update, delete on public.assets                to authenticated;
grant select, insert, update, delete on public.vehicle_documents     to authenticated;
grant select, insert, update, delete on public.maintenance_schedules to authenticated;
grant select, insert, update, delete on public.work_orders           to authenticated;
grant select, insert, update, delete on public.work_order_items      to authenticated;
