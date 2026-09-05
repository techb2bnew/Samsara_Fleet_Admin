-- ============================================================================
-- Drivers report where they are
-- ============================================================================
-- The live map needs a position per vehicle, and the only thing that knows it
-- is the phone in the cab. But `vehicles_write` is limited to fleet_admin, so
-- the driver app cannot write there — and it must not be given permission to.
--
-- Row-level security grants access to a ROW, never to a column. Letting a
-- driver update public.vehicles would let them update all of it: the plate,
-- the status, and the odometer. A driver who could roll their odometer back
-- could hide a service that is overdue. That mistake has already been made
-- once in this schema, which is why driver_settings is a separate table from
-- drivers.
--
-- So the driver gets a function instead of a table. It is security definer,
-- meaning it runs with the owner's rights rather than the caller's, and the
-- only thing it can do is what is written below: five position columns, on
-- one vehicle, the one the caller is signed on to.
--
-- ---------------------------------------------------------------------------
-- Why it takes a timestamp instead of using now()
-- ---------------------------------------------------------------------------
-- A truck loses signal in a tunnel, a basement dock, half of any hill road.
-- The app has to queue positions and send them when the network returns, which
-- means this function will be called with readings that are minutes or hours
-- old, out of order, in a burst.
--
-- Using now() would stamp every one of them as current, and the newest write
-- would win — so a replayed queue would leave the map showing a truck sitting
-- "live" wherever it happened to be when it lost signal. The fix is for the
-- caller to say when each reading was taken, and for this function to ignore
-- anything older than what is already stored.
--
-- That makes the call idempotent and order-independent: send the same queue
-- twice, in any order, and the stored position is the newest reading in it.
-- ============================================================================

create or replace function public.report_position(
  latitude     numeric,
  longitude    numeric,
  speed_kph    numeric  default null,
  heading_deg  smallint default null,
  ignition_on  boolean  default null,
  reported_at  timestamptz default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_driver uuid;
  target        uuid;
  taken_at      timestamptz;
begin
  -- Rejected rather than ignored. A driver app calling this with a bad reading
  -- has a bug, and silently storing nothing would leave it undiagnosable.
  if latitude is null or longitude is null then
    raise exception 'A position needs both a latitude and a longitude';
  end if;
  if latitude < -90 or latitude > 90 then
    raise exception 'Latitude % is not on the earth', latitude;
  end if;
  if longitude < -180 or longitude > 180 then
    raise exception 'Longitude % is not on the earth', longitude;
  end if;
  if speed_kph is not null and speed_kph < 0 then
    raise exception 'Speed cannot be negative';
  end if;
  if heading_deg is not null and (heading_deg < 0 or heading_deg > 359) then
    raise exception 'Heading % is not a compass bearing', heading_deg;
  end if;

  caller_driver := public.current_driver_id();

  -- Not an error. Office staff and anyone signed in who is not a driver simply
  -- has no vehicle to report for, and the app treats a null return as "your
  -- reading was not stored" without having to parse a message.
  if caller_driver is null then
    return null;
  end if;

  taken_at := coalesce(reported_at, clock_timestamp());

  -- A reading from the future is a phone with a wrong clock. Clamping rather
  -- than rejecting: the position is probably fine and the driver cannot fix
  -- their clock from the cab, but letting it through would freeze the map
  -- until the real time caught up.
  if taken_at > clock_timestamp() + interval '1 minute' then
    taken_at := clock_timestamp();
  end if;

  /*
   * The vehicle the caller is signed on to right now. Drivers pick their own
   * truck at the start of a shift, so this is the assignment the app itself
   * created. No open assignment means they have not selected a vehicle, and
   * there is nothing to attach the position to.
   */
  select a.vehicle_id
    into target
    from public.driver_vehicle_assignments a
   where a.driver_id = caller_driver
     and a.ended_at is null
   order by a.started_at desc
   limit 1;

  if target is null then
    return null;
  end if;

  update public.vehicles v
     set last_latitude    = report_position.latitude,
         last_longitude   = report_position.longitude,
         last_speed_kph   = report_position.speed_kph,
         last_heading_deg = report_position.heading_deg,
         last_ignition_on = report_position.ignition_on,
         last_position_at = taken_at
   where v.id = target
     and v.deleted_at is null
     -- The stale-reading guard. Anything not newer than what is stored is
     -- dropped, which is what makes a replayed offline queue harmless.
     and (v.last_position_at is null or v.last_position_at < taken_at);

  -- Zero rows means the stored position was already newer. The reading was
  -- handled correctly, so the vehicle is still the honest answer — the app
  -- should not retry.
  return target;
end
$$;

comment on function public.report_position is
  'Records where the calling driver''s current vehicle is. Updates only the five position columns, only on the vehicle they are signed on to, and only when the reading is newer than the stored one — so a replayed offline queue cannot move the map backwards. Returns the vehicle id, or null when the caller has no vehicle signed on.';

-- Only signed-in drivers. The service key writes to public.vehicles directly
-- and does not need this.
revoke all on function public.report_position(
  numeric, numeric, numeric, smallint, boolean, timestamptz
) from public;

grant execute on function public.report_position(
  numeric, numeric, numeric, smallint, boolean, timestamptz
) to authenticated;
