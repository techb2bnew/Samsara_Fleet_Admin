-- ============================================================================
-- A depot has a place on the map
-- ============================================================================
-- Routes run from one depot to another. Without an address those ends are
-- just names, and Directions has nothing to plot. The office types the
-- address when they create the depot; latitude and longitude are filled in
-- from geocoding when a map key is present.

alter table public.fleets
  add column if not exists address   text,
  add column if not exists latitude  numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.fleets
  drop constraint if exists fleets_latitude_range,
  drop constraint if exists fleets_longitude_range;

alter table public.fleets
  add constraint fleets_latitude_range  check (latitude  is null or latitude  between  -90 and  90),
  add constraint fleets_longitude_range check (longitude is null or longitude between -180 and 180);

comment on column public.fleets.address is
  'Street address of the yard. Used as the start or end when planning a route from this depot.';
comment on column public.fleets.latitude is
  'Geocoded from address. Null when the address has not been resolved yet.';
comment on column public.fleets.longitude is
  'Geocoded from address. Null when the address has not been resolved yet.';
