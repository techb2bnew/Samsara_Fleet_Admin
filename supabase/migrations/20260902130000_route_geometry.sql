-- ============================================================================
-- Route geometry: the line on the map, and km at each stop
-- ============================================================================
-- A route used to be a driver, a vehicle and a count of unnamed stops. That
-- is enough for a list and not enough for a map: there is nothing to draw,
-- and "Stop 3" does not say how far along the drive it is.
--
-- The planned drive is stored as a polyline of lat,lng points so the map can
-- follow the road rather than drawing chords between the six visit points.
-- Each stop carries kilometres from the start, which is what a dispatcher
-- asks when they say "kitne km ke baad".
-- ============================================================================

alter table public.routes
  add column if not exists path_polyline text;

comment on column public.routes.path_polyline is
  'The planned drive as lat,lng points joined by |. Used to draw the line on the map.';

alter table public.route_stops
  add column if not exists distance_from_start_km numeric(10, 2);

comment on column public.route_stops.distance_from_start_km is
  'Kilometres along the planned drive from the origin to this stop.';
