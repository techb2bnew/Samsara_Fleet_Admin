-- ============================================================================
-- Vehicle last known position  (0 tables)   -- admin module A03
-- ============================================================================
-- The live map needs one thing: where each truck is right now. That is five
-- columns on the vehicle, not a table.
--
-- A vehicle_positions table is the obvious design and the expensive one. A
-- device reporting every thirty seconds writes 2,880 rows per truck per day -
-- for forty trucks that is roughly forty million rows a year, all of it to
-- answer a question that only ever concerns the newest row per vehicle. The
-- map would then need a distinct-on query over that table on every refresh.
--
-- Here the map is `select ... from vehicles`, and each report is an update in
-- place. Nothing accumulates.
--
-- The history is genuinely useful later - trip replay, distance travelled,
-- proving where a truck was during an incident. When that feature is actually
-- being built, add vehicle_positions then and keep these columns as the
-- current-state cache. Building it now would mean a table nothing reads.
-- ============================================================================

alter table public.vehicles
  add column last_latitude    numeric(9,6),
  add column last_longitude   numeric(9,6),
  add column last_speed_kph   numeric(6,2),
  add column last_heading_deg smallint,
  add column last_ignition_on boolean,
  add column last_position_at timestamptz;

comment on column public.vehicles.last_position_at is
  'When the position was reported. Null means the vehicle has never reported; a stale value means it is offline.';

alter table public.vehicles
  add constraint vehicles_last_latitude_range
    check (last_latitude is null or last_latitude between -90 and 90),
  add constraint vehicles_last_longitude_range
    check (last_longitude is null or last_longitude between -180 and 180),
  add constraint vehicles_last_speed_not_negative
    check (last_speed_kph is null or last_speed_kph >= 0),
  add constraint vehicles_last_heading_range
    check (last_heading_deg is null or last_heading_deg between 0 and 359);

-- The map query: everything that has reported recently. Partial, so parked and
-- retired vehicles that have never reported cost nothing.
create index vehicles_last_position_idx on public.vehicles (org_id, last_position_at desc)
  where last_position_at is not null and deleted_at is null;
