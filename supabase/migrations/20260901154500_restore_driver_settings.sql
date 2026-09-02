-- ============================================================================
-- driver_settings comes back
-- ============================================================================
-- The lean pass folded driver_settings into drivers on the grounds that it was
-- one row per driver holding six preferences. That reasoning was about shape,
-- and it missed why the split existed.
--
-- The two tables have different owners:
--
--   drivers          the office owns it. A driver must not rename themselves,
--                    change their employee number or move their home terminal.
--                    There is a test for exactly this.
--   driver_settings  the driver owns it. They toggle their own notifications
--                    and units from the phone.
--
-- Merged, letting the driver write their preferences meant letting them write
-- the whole row - row-level security grants access to a row, not to columns.
-- The RLS suite caught it immediately: the driver renamed themselves.
--
-- The alternative was a trigger listing which columns a driver may touch. That
-- works until someone adds a seventh column to drivers and does not think about
-- it, at which point the driver can edit that one too. A separate table has no
-- such failure mode: the boundary is the table, and Postgres enforces it with
-- the policies already written.
--
-- One table more than the lean pass aimed at. It is the right one to keep.
-- ============================================================================

drop policy if exists drivers_update_self on public.drivers;

create table public.driver_settings (
  driver_id             uuid primary key references public.drivers(id) on delete cascade,
  org_id                uuid        not null references public.organizations(id) on delete cascade,

  locale                text        not null default 'en',
  distance_unit         text        not null default 'km',
  notify_push           boolean     not null default true,
  notify_email          boolean     not null default false,
  notify_break_reminder boolean     not null default true,

  -- Hours-of-service exemptions this driver is entitled to claim.
  exemptions            jsonb       not null default '{}'::jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint driver_settings_distance_unit check (distance_unit in ('km', 'mi')),
  constraint driver_settings_exemptions_is_object check (jsonb_typeof(exemptions) = 'object')
);

comment on table public.driver_settings is
  'Preferences the driver owns. Separate from drivers because the office owns that row and a driver must not be able to edit it.';

create index driver_settings_org_idx on public.driver_settings (org_id);

create trigger driver_settings_set_updated_at before update on public.driver_settings
  for each row execute function public.set_updated_at();

-- Carry back anything the fold wrote onto drivers.
insert into public.driver_settings (
  driver_id, org_id, locale, distance_unit,
  notify_push, notify_email, notify_break_reminder, exemptions
)
select
  d.id, d.org_id, d.locale, d.distance_unit,
  d.notify_push, d.notify_email, d.notify_break_reminder, d.exemptions
from public.drivers d;

alter table public.drivers
  drop constraint drivers_distance_unit,
  drop constraint drivers_exemptions_is_object,
  drop column locale,
  drop column distance_unit,
  drop column notify_push,
  drop column notify_email,
  drop column notify_break_reminder,
  drop column exemptions;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.driver_settings enable row level security;

create policy driver_settings_select_org on public.driver_settings
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

-- The driver's own row, theirs to change.
create policy driver_settings_self on public.driver_settings
  for all to authenticated
  using (driver_id = (select public.current_driver_id()))
  with check (driver_id = (select public.current_driver_id()));

-- The office can set them up and help over the phone.
create policy driver_settings_admin_write on public.driver_settings
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));

grant select, insert, update, delete on public.driver_settings to authenticated;
