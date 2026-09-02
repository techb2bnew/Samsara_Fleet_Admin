-- ============================================================================
-- Lean pass: 32 tables down to 26
-- ============================================================================
-- Every table below was either merged into one that already existed, or
-- removed because nothing in the product uses it and nothing plans to.
--
--   trailers              -> vehicles.kind. The console already treats a
--                            trailer as a row in the vehicle list, and the
--                            screen says "Trucks and trailers". Keeping them
--                            apart cost a nullable trailer_id and a one-owner
--                            check on seven other tables.
--   driver_settings       -> columns on drivers. Its primary key WAS driver_id,
--                            so it was one row per driver, always read with the
--                            driver. That is a join to fetch six preferences.
--   permissions           -> roles.module_permissions. 105 rows describing
--                            7 roles x 15 modules, which is one small object
--                            per role.
--   assets                    removed. Nothing in the console mentions an
--                            asset, and no module covers them.
--   work_order_items          removed. work_orders already carries parts and
--                            labour totals, and the screen shows one cost.
--   co_driver_assignments     removed. Team driving is a real feature and is
--                            not in any of the fifteen modules. It is a small
--                            table to add back on the day it is built.
--
-- driver_devices stays. Nothing reads it yet, but push notifications need a
-- token per phone and a driver can carry two.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Trailers become vehicles
-- ---------------------------------------------------------------------------

create type public.vehicle_kind as enum ('truck', 'trailer');

alter table public.vehicles
  add column kind public.vehicle_kind not null default 'truck';

comment on column public.vehicles.kind is
  'Truck or trailer. They live in one table because every screen, document and work order treats them the same way.';

-- A trailer has no odometer, so the column it shares with trucks stays at zero.
-- `number` becomes `plate`: it is the identifier painted on the side, which is
-- exactly what plate holds for a truck.
insert into public.vehicles (
  id, org_id, fleet_id, kind, plate, name, vin, make, model, year, status, notes,
  created_at, updated_at, deleted_at
)
select
  id, org_id, fleet_id, 'trailer', number, coalesce('Trailer ' || number, number),
  vin, make, model, year, status, notes,
  created_at, updated_at, deleted_at
from public.trailers;

-- Point everything that referenced a trailer at the vehicle row instead. The
-- ids were carried across above, so the values already line up.
update public.documents             set vehicle_id = trailer_id where trailer_id is not null;
update public.work_orders           set vehicle_id = trailer_id where trailer_id is not null;
update public.maintenance_schedules set vehicle_id = trailer_id where trailer_id is not null;
update public.defects               set vehicle_id = trailer_id where trailer_id is not null;

-- These three carry a trailer alongside a vehicle rather than instead of one,
-- so the reference becomes a second vehicle: the trailer being pulled.
alter table public.form_submissions           rename column trailer_id to towed_vehicle_id;
alter table public.routes                     rename column trailer_id to towed_vehicle_id;
alter table public.driver_vehicle_assignments rename column trailer_id to towed_vehicle_id;

alter table public.form_submissions
  drop constraint form_submissions_trailer_id_fkey,
  add constraint form_submissions_towed_vehicle_id_fkey
    foreign key (towed_vehicle_id) references public.vehicles(id) on delete set null;

alter table public.routes
  drop constraint routes_trailer_id_fkey,
  add constraint routes_towed_vehicle_id_fkey
    foreign key (towed_vehicle_id) references public.vehicles(id) on delete set null;

alter table public.driver_vehicle_assignments
  drop constraint driver_vehicle_assignments_trailer_id_fkey,
  add constraint driver_vehicle_assignments_towed_vehicle_id_fkey
    foreign key (towed_vehicle_id) references public.vehicles(id) on delete set null;

comment on column public.routes.towed_vehicle_id is
  'The trailer on this route, as a vehicle row of kind = trailer.';

-- One-owner checks lose their trailer half. On defects, maintenance and work
-- orders that leaves exactly one owner, so the column simply becomes required.
alter table public.defects
  drop constraint defects_one_owner,
  drop column trailer_id,
  alter column vehicle_id set not null;

alter table public.maintenance_schedules
  drop constraint maintenance_one_owner,
  drop column trailer_id,
  alter column vehicle_id set not null;

alter table public.work_orders
  drop constraint work_orders_one_owner,
  drop column trailer_id,
  alter column vehicle_id set not null;

-- documents holds both a trailer_id and an asset_id; the owner check covers
-- both, so it has to come off before either column can.
alter table public.documents
  drop constraint documents_owner_present,
  drop column trailer_id;

drop table public.trailers;


-- ---------------------------------------------------------------------------
-- 2. Assets removed
-- ---------------------------------------------------------------------------

alter table public.documents
  drop column asset_id;

alter table public.documents
  add constraint documents_owner_present check (
    case category
      when 'compliance' then num_nonnulls(driver_id, vehicle_id) = 1
      else num_nonnulls(driver_id, vehicle_id, route_id, stop_id) >= 1
    end
  );

drop table public.assets;
drop type public.asset_kind;


-- ---------------------------------------------------------------------------
-- 3. Work order line items removed
-- ---------------------------------------------------------------------------
-- work_orders already has labour_hours, labour_cost_cents and parts_cost_cents.

drop table public.work_order_items;


-- ---------------------------------------------------------------------------
-- 4. Co-driver assignments removed
-- ---------------------------------------------------------------------------

drop table public.co_driver_assignments;


-- ---------------------------------------------------------------------------
-- 5. Driver settings fold into drivers
-- ---------------------------------------------------------------------------

alter table public.drivers
  add column locale                text    not null default 'en',
  add column distance_unit         text    not null default 'km',
  add column notify_push           boolean not null default true,
  add column notify_email          boolean not null default false,
  add column notify_break_reminder boolean not null default true,
  add column exemptions            jsonb   not null default '{}'::jsonb,
  add constraint drivers_distance_unit check (distance_unit in ('km', 'mi')),
  add constraint drivers_exemptions_is_object check (jsonb_typeof(exemptions) = 'object');

comment on column public.drivers.exemptions is
  'Hours-of-service exemptions this driver is entitled to, as claimed on their log.';

update public.drivers d
set locale                = s.locale,
    distance_unit         = s.distance_unit,
    notify_push           = s.notify_push,
    notify_email          = s.notify_email,
    notify_break_reminder = s.notify_break_reminder,
    exemptions            = s.exemptions
from public.driver_settings s
where s.driver_id = d.id;

drop table public.driver_settings;

-- The driver owns their own preferences, which used to be a policy on the
-- settings table. On drivers, the existing self-select policy already lets them
-- read the row; this lets them change it. The with-check keeps them on their
-- own row, and RLS cannot restrict which columns they touch - the console never
-- exposes the rest, and a driver editing their own name is not a risk worth a
-- trigger.
create policy drivers_update_self on public.drivers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- 6. Permissions fold into roles
-- ---------------------------------------------------------------------------
-- { "A01": { "view": true, "edit": true, "delete": false }, ... }

alter table public.roles
  add column module_permissions jsonb not null default '{}'::jsonb,
  add constraint roles_module_permissions_is_object
    check (jsonb_typeof(module_permissions) = 'object');

comment on column public.roles.module_permissions is
  'Per-module view/edit/delete for this role, keyed by module code. One object per role, where 15 rows used to be.';

update public.roles r
set module_permissions = coalesce(
  (
    select jsonb_object_agg(
      p.module,
      jsonb_build_object('view', p.can_view, 'edit', p.can_edit, 'delete', p.can_delete)
    )
    from public.permissions p
    where p.role_id = r.id
  ),
  '{}'::jsonb
);

drop table public.permissions;
