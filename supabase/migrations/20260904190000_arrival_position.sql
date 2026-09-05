-- ============================================================================
-- Where the driver actually was when they marked a stop arrived
-- ============================================================================
-- A stop recorded arrived_at and nothing else, so "arrived" was a claim with
-- nothing behind it. A driver could mark eight stops from the depot car park
-- and the office would see a completed route.
--
-- The app now takes a fix before it lets them mark one, and refuses when they
-- are more than a kilometre away. That check lives in the app, which makes it
-- a gate rather than a guarantee — a phone with location turned off cannot be
-- measured, and a driver genuinely standing at a loading bay under a steel
-- roof often cannot either. Refusing those would strand somebody doing their
-- job.
--
-- So the position is RECORDED, not just checked. Where the check could not be
-- made the columns stay null, and the office can see the arrival was
-- unverified — a far more useful thing to hand a dispatcher than a driver
-- locked out of their own route.
-- ============================================================================

alter table public.route_stops
  add column if not exists arrived_latitude numeric(9, 6),
  add column if not exists arrived_longitude numeric(9, 6),
  -- Metres, and stored rather than recomputed: it is the distance AT THE TIME,
  -- and the office may correct the stop's own coordinates later.
  add column if not exists arrived_distance_m integer;

comment on column public.route_stops.arrived_latitude is
  'Where the driver was when they marked this stop arrived. Null when no fix was available, which is itself the useful answer.';
comment on column public.route_stops.arrived_distance_m is
  'Metres between the driver and the stop at the moment they marked it. Null when either position was unknown.';

alter table public.route_stops
  drop constraint if exists route_stops_arrival_position_paired;

alter table public.route_stops
  add constraint route_stops_arrival_position_paired
  -- Both or neither. Half a coordinate is not a location, and a lone latitude
  -- would quietly plot itself on the Greenwich meridian.
  check (
    (arrived_latitude is null and arrived_longitude is null)
    or (arrived_latitude is not null and arrived_longitude is not null)
  );

alter table public.route_stops
  drop constraint if exists route_stops_arrival_distance_sane;

alter table public.route_stops
  add constraint route_stops_arrival_distance_sane
  -- Negative is meaningless, and 40,000 km is further than the planet is
  -- round: past that the number came from a bug, not a lorry.
  check (
    arrived_distance_m is null
    or (arrived_distance_m >= 0 and arrived_distance_m <= 40000000)
  );


-- ---------------------------------------------------------------------------
-- The rule book, spelled the way the app reads it
-- ---------------------------------------------------------------------------
-- hos_regulator is free text and the console offered a free text box for it.
-- The driver app parses it strictly — FMCSA, DOT, US, EU, EC561, AETR — and
-- anything else becomes null, at which point every clock in the hours strip
-- shows a dash and nothing says why.
--
-- That is a bad failure mode. An office that typed "India" or "FMCSA (US)"
-- got a driver app that quietly stopped calculating hours, and no screen
-- anywhere mentioned that the two spellings had to agree.
--
-- The console becomes a picker in the same change. This is the backstop, so
-- no other client can store a value the app cannot read.

alter table public.organizations
  drop constraint if exists organizations_hos_regulator_known;

alter table public.organizations
  add constraint organizations_hos_regulator_known
  check (hos_regulator is null or hos_regulator in ('FMCSA', 'EU'));

comment on column public.organizations.hos_regulator is
  'FMCSA, EU, or null when the office has not chosen. Constrained because the driver app parses it strictly, and an unrecognised value makes every hours clock show a dash with no reason given.';
