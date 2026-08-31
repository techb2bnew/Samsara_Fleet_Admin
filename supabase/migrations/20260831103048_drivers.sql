-- ============================================================================
-- Drivers  (6 tables)   -- admin module A04
-- ============================================================================
-- Driver records, their licences and medical certificates, their app settings,
-- the phones they carry, team pairings, and the history of who drove what.
--
-- A driver row exists whether or not the person has signed into the app yet.
-- user_id stays null until they accept their invitation, so the office can set
-- up a whole fleet before anyone installs anything.
-- ============================================================================


create type public.driver_status as enum (
  'active',
  'inactive',   -- on leave, suspended
  'terminated'
);

create type public.device_platform as enum ('ios', 'android');


-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------

create table public.drivers (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid        not null references public.organizations(id) on delete cascade,
  fleet_id         uuid references public.fleets(id) on delete set null,

  -- Null until the person accepts their invitation and signs in. This is what
  -- current_driver_id() matches on.
  user_id          uuid references public.users(id) on delete set null,

  employee_number  text,
  first_name       text        not null,
  last_name        text        not null,
  email            text,
  phone            text,

  -- The depot a driver is based at. Working-hours rules are calculated in this
  -- timezone, not the phone's - a driver crossing timezones must not have their
  -- legal day shift under them.
  home_terminal    text,
  timezone         text        not null default 'UTC',

  status           public.driver_status not null default 'active',
  hired_on         date,
  terminated_on    date,

  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint drivers_first_name_not_blank check (length(btrim(first_name)) > 0),
  constraint drivers_last_name_not_blank  check (length(btrim(last_name))  > 0),
  constraint drivers_email_format check (email is null or position('@' in email) > 1),
  constraint drivers_dates_ordered check (
    hired_on is null or terminated_on is null or terminated_on >= hired_on
  )
);

comment on table public.drivers is
  'Driver records. user_id is null until the driver accepts their app invitation.';

comment on column public.drivers.timezone is
  'Home terminal timezone. Working-hours limits are evaluated here, not on the device.';

-- One driver row per signed-in user. Without this a person could end up
-- attached to two driver records and current_driver_id() would pick arbitrarily.
create unique index drivers_user_unique_idx on public.drivers (user_id)
  where user_id is not null and deleted_at is null;

create unique index drivers_employee_number_idx on public.drivers (org_id, upper(btrim(employee_number)))
  where deleted_at is null and employee_number is not null;

create index drivers_org_idx    on public.drivers (org_id) where deleted_at is null;
create index drivers_fleet_idx  on public.drivers (fleet_id) where deleted_at is null;
create index drivers_status_idx on public.drivers (org_id, status) where deleted_at is null;
create index drivers_search_idx on public.drivers using gin (
  (first_name || ' ' || last_name || ' ' || coalesce(employee_number, ''))
  extensions.gin_trgm_ops
);


-- ---------------------------------------------------------------------------
-- driver_documents
-- ---------------------------------------------------------------------------
-- Licences, medical certificates, endorsements. expires_on drives the advance
-- warnings in the console - a driver whose medical card lapses cannot legally
-- work, so this is a compliance feature, not an admin convenience.

create table public.driver_documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,
  driver_id         uuid        not null references public.drivers(id) on delete cascade,

  doc_type          text        not null,   -- licence, medical, endorsement, other
  reference         text,                   -- licence number
  issuing_authority text,                   -- issuing state or authority
  issued_on         date,
  expires_on        date,
  storage_path      text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint driver_documents_type_not_blank check (length(btrim(doc_type)) > 0),
  constraint driver_documents_dates_ordered check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  )
);

comment on table public.driver_documents is
  'Driver paperwork. expires_on powers the licence and medical expiry alerts.';

create index driver_documents_driver_idx on public.driver_documents (driver_id) where deleted_at is null;
create index driver_documents_expiry_idx on public.driver_documents (org_id, expires_on)
  where deleted_at is null and expires_on is not null;


-- ---------------------------------------------------------------------------
-- driver_settings
-- ---------------------------------------------------------------------------
-- One row per driver. Kept apart from the driver record because the app writes
-- here often and the office writes there rarely.

create table public.driver_settings (
  driver_id             uuid primary key references public.drivers(id) on delete cascade,
  org_id                uuid        not null references public.organizations(id) on delete cascade,

  locale                text        not null default 'en',
  distance_unit         text        not null default 'km',

  notify_push           boolean     not null default true,
  notify_email          boolean     not null default false,
  notify_break_reminder boolean     not null default true,

  -- Exemptions the driver is permitted to use. Rule sets are not modelled yet,
  -- so this stays a flexible document until the operating country is settled.
  exemptions            jsonb       not null default '{}'::jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint driver_settings_distance_unit check (distance_unit in ('km', 'mi'))
);

create index driver_settings_org_idx on public.driver_settings (org_id);


-- ---------------------------------------------------------------------------
-- driver_devices
-- ---------------------------------------------------------------------------
-- The phones a driver has signed in on. The console uses this to answer
-- "has this driver actually installed the app, and is their phone syncing".

create table public.driver_devices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  driver_id     uuid        not null references public.drivers(id) on delete cascade,

  platform      public.device_platform not null,
  device_name   text,
  os_version    text,
  app_version   text,

  -- Push token for notifications. Rotates, so it is not treated as an identity.
  push_token    text,

  last_seen_at  timestamptz,
  last_sync_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

comment on table public.driver_devices is
  'Phones a driver has signed in on. last_sync_at answers "is this phone up to date".';

create index driver_devices_driver_idx on public.driver_devices (driver_id) where revoked_at is null;
create index driver_devices_org_idx    on public.driver_devices (org_id)    where revoked_at is null;


-- ---------------------------------------------------------------------------
-- co_driver_assignments
-- ---------------------------------------------------------------------------
-- Team driving. Two drivers share a truck, and the working-hours rules treat
-- them differently from a solo driver, so the pairing has to be recorded with
-- the period it applied to.

create table public.co_driver_assignments (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,

  primary_driver_id uuid        not null references public.drivers(id) on delete cascade,
  co_driver_id      uuid        not null references public.drivers(id) on delete cascade,

  started_at        timestamptz not null default now(),
  ended_at          timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint co_driver_distinct check (primary_driver_id <> co_driver_id),
  constraint co_driver_period_ordered check (ended_at is null or ended_at > started_at)
);

create index co_driver_primary_idx on public.co_driver_assignments (primary_driver_id) where ended_at is null;
create index co_driver_co_idx      on public.co_driver_assignments (co_driver_id)      where ended_at is null;


-- ---------------------------------------------------------------------------
-- driver_vehicle_assignments
-- ---------------------------------------------------------------------------
-- Who drove what, and when. This is history, not a current-state flag, because
-- every later question - whose driving time was that, who filed that
-- inspection, who was on the truck when the incident happened - is answered by
-- looking up a moment in time.

create table public.driver_vehicle_assignments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,

  driver_id  uuid        not null references public.drivers(id) on delete cascade,
  vehicle_id uuid        not null references public.vehicles(id) on delete cascade,
  trailer_id uuid references public.trailers(id) on delete set null,

  started_at timestamptz not null default now(),
  ended_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dva_period_ordered check (ended_at is null or ended_at > started_at)
);

comment on table public.driver_vehicle_assignments is
  'History of who drove which vehicle. Never a current-state flag on vehicles.';

-- A driver can only be on one vehicle at a time, and a vehicle can only have
-- one active driver. Two partial unique indexes enforce both cheaply.
create unique index dva_active_driver_idx  on public.driver_vehicle_assignments (driver_id)  where ended_at is null;
create unique index dva_active_vehicle_idx on public.driver_vehicle_assignments (vehicle_id) where ended_at is null;

create index dva_org_idx     on public.driver_vehicle_assignments (org_id);
create index dva_vehicle_idx on public.driver_vehicle_assignments (vehicle_id, started_at desc);
create index dva_driver_idx  on public.driver_vehicle_assignments (driver_id, started_at desc);


-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger drivers_set_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();
create trigger driver_documents_set_updated_at before update on public.driver_documents
  for each row execute function public.set_updated_at();
create trigger driver_settings_set_updated_at before update on public.driver_settings
  for each row execute function public.set_updated_at();
create trigger driver_devices_set_updated_at before update on public.driver_devices
  for each row execute function public.set_updated_at();
create trigger co_driver_assignments_set_updated_at before update on public.co_driver_assignments
  for each row execute function public.set_updated_at();
create trigger dva_set_updated_at before update on public.driver_vehicle_assignments
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Driver identity helper
-- ---------------------------------------------------------------------------
-- Defined here rather than in the first migration, because a `language sql`
-- function is validated when it is created and cannot read a table that does
-- not exist yet.
--
-- The mobile app signs in as a driver. A driver must see their own records and
-- nothing belonging to a colleague, which is stricter than the organisation
-- check office staff get.

create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.drivers d
  where d.user_id = auth.uid()
    and d.deleted_at is null
  limit 1;
$$;

comment on function public.current_driver_id() is
  'The driver row belonging to the signed-in user, or NULL for office staff.';

revoke execute on function public.current_driver_id() from public;
grant  execute on function public.current_driver_id() to authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Two audiences read these tables and they need different rules:
--
--   office staff - see every driver in their organisation
--   drivers      - see themselves only, never a colleague
--
-- Each table therefore carries a `_self` policy alongside the org policy.
-- Postgres ORs multiple permissive policies together, so a driver who is also
-- office staff gets the union, which is correct.

alter table public.drivers                    enable row level security;
alter table public.driver_documents           enable row level security;
alter table public.driver_settings            enable row level security;
alter table public.driver_devices             enable row level security;
alter table public.co_driver_assignments      enable row level security;
alter table public.driver_vehicle_assignments enable row level security;


-- drivers -------------------------------------------------------------------

create policy drivers_select_org on public.drivers
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy drivers_select_self on public.drivers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy drivers_write on public.drivers
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


-- driver_documents ----------------------------------------------------------

create policy driver_documents_select_org on public.driver_documents
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy driver_documents_select_self on public.driver_documents
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

create policy driver_documents_write on public.driver_documents
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','compliance_officer'])));


-- driver_settings -----------------------------------------------------------
-- The driver owns these. The office can read them for support, and a fleet
-- admin can change them, but the driver is the normal author.

create policy driver_settings_select_org on public.driver_settings
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy driver_settings_self on public.driver_settings
  for all to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

create policy driver_settings_admin_write on public.driver_settings
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


-- driver_devices ------------------------------------------------------------
-- A driver registers and updates their own phone; the office can see the fleet's
-- devices to answer "is this phone syncing".

create policy driver_devices_select_org on public.driver_devices
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy driver_devices_self on public.driver_devices
  for all to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

create policy driver_devices_admin_write on public.driver_devices
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


-- co_driver_assignments -----------------------------------------------------

create policy co_driver_select_org on public.co_driver_assignments
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy co_driver_select_self on public.co_driver_assignments
  for select to authenticated
  using (
    primary_driver_id = (select public.current_driver_id())
    or co_driver_id   = (select public.current_driver_id())
  );

create policy co_driver_write on public.co_driver_assignments
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])));


-- driver_vehicle_assignments ------------------------------------------------
-- Drivers pick their own truck at the start of a shift, so they may write here
-- for themselves. They cannot assign anyone else.

create policy dva_select_org on public.driver_vehicle_assignments
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy dva_select_self on public.driver_vehicle_assignments
  for select to authenticated
  using (driver_id = (select public.current_driver_id()));

create policy dva_self_write on public.driver_vehicle_assignments
  for all to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

create policy dva_admin_write on public.driver_vehicle_assignments
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin','dispatcher'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.drivers                    to authenticated;
grant select, insert, update, delete on public.driver_documents           to authenticated;
grant select, insert, update, delete on public.driver_settings            to authenticated;
grant select, insert, update, delete on public.driver_devices             to authenticated;
grant select, insert, update, delete on public.co_driver_assignments      to authenticated;
grant select, insert, update, delete on public.driver_vehicle_assignments to authenticated;
