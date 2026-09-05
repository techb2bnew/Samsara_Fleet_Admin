-- ============================================================================
-- Actually writing the audit trail
-- ============================================================================
-- audit_log has been read by the console since it was built, and written by
-- nothing. The screen says "Every change made in this console, with who made
-- it. Required for audits." and recorded not one row.
--
-- ---------------------------------------------------------------------------
-- Triggers, not console code
-- ---------------------------------------------------------------------------
-- The obvious alternative is an insert next to every write in the client.
-- That is forty call sites to remember, one of which will be forgotten, and it
-- records only what the CONSOLE did — a change made from the driver app, from
-- a script, or by somebody with the secret key in a SQL editor would leave no
-- trace at all. An audit trail with a way around it is not an audit trail.
--
-- A trigger sees every change to the row whatever made it.
--
-- ---------------------------------------------------------------------------
-- If it cannot be recorded, it does not happen
-- ---------------------------------------------------------------------------
-- The function deliberately does not swallow its own errors. A failure here
-- rolls the whole statement back, so a change either lands with its audit row
-- or does not land. Catching and continuing would mean shipping a trail that
-- looks complete and quietly is not, which is the one failure mode that makes
-- an audit worse than none.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Who did it
-- ---------------------------------------------------------------------------
-- Office staff have a users row; drivers have a drivers row and no users row.
-- Anything else is the system: a migration, a scheduled job, a script holding
-- the secret key. All three are worth telling apart in a trail.

create or replace function public.audit_actor()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.full_name from public.users u where u.id = auth.uid()),
    (select d.first_name || ' ' || d.last_name
       from public.drivers d where d.user_id = auth.uid()),
    (select u.email from public.users u where u.id = auth.uid()),
    'System'
  )
$$;

comment on function public.audit_actor is
  'A readable name for whoever is making the current change. Falls back through office user, driver, email, then System.';


-- ---------------------------------------------------------------------------
-- The trigger itself
-- ---------------------------------------------------------------------------

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_org uuid;
  v_action text;
  v_changes jsonb;
  v_summary text;
  v_label text;
begin
  v_row := to_jsonb(coalesce(new, old));
  v_old := case when old is null then null else to_jsonb(old) end;
  v_org := nullif(v_row ->> 'org_id', '')::uuid;

  /*
   * A soft delete is a delete, not an edit. deleted_at going from null to a
   * timestamp is the single most important line an auditor reads, and calling
   * it "updated" buries it among field changes.
   */
  if tg_op = 'UPDATE'
     and (v_old ->> 'deleted_at') is null
     and (v_row ->> 'deleted_at') is not null then
    v_action := 'delete';
  else
    v_action := lower(tg_op);
  end if;

  /*
   * Only what actually changed, and never the whole row on an update. A diff
   * is what somebody reads; a pair of full rows is something they have to
   * compare by eye.
   *
   * updated_at is dropped because it changes on every write and says nothing.
   */
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', v_old -> key, 'to', v_row -> key))
      into v_changes
    from jsonb_object_keys(v_row) as key
    where key not in ('updated_at')
      and (v_old -> key) is distinct from (v_row -> key);

    -- Nothing but updated_at moved. A row rewritten to the same values is not
    -- a change anybody needs to read about.
    if v_changes is null then
      return coalesce(new, old);
    end if;
  end if;

  v_label := public.audit_actor();

  v_summary := case v_action
    when 'insert' then 'Created'
    when 'delete' then 'Deleted'
    else 'Changed ' || (
      select string_agg(k, ', ' order by k) from jsonb_object_keys(v_changes) as k
    )
  end;

  insert into public.audit_log (
    org_id, actor_user_id, actor_driver_id, actor_label,
    action, entity_type, entity_id, summary, changes
  )
  values (
    v_org,
    (select u.id from public.users u where u.id = auth.uid()),
    (select d.id from public.drivers d where d.user_id = auth.uid()),
    v_label,
    v_action,
    tg_table_name,
    nullif(v_row ->> 'id', '')::uuid,
    v_summary,
    v_changes
  );

  return coalesce(new, old);
end;
$$;

comment on function public.write_audit_log is
  'Writes one audit_log row per change. Attached by the loop below; do not call directly.';


-- ---------------------------------------------------------------------------
-- What is audited
-- ---------------------------------------------------------------------------
-- The records an inspector or an insurer asks about, and the settings that
-- decide how the rest of the system behaves.
--
-- duty_status_events is the deliberate exception: it takes UPDATE only. Every
-- driver taps a status twenty times a shift, and those inserts ARE the record
-- — auditing them would double the largest table in the schema to say "the log
-- says what the log says". An UPDATE to one is a correction being proposed or
-- reviewed, which is exactly the thing worth a trail.

do $$
declare
  t text;
  full_tables text[] := array[
    'drivers',
    'vehicles',
    'driver_vehicle_assignments',
    'routes',
    'route_stops',
    'work_orders',
    'defects',
    'forms',
    'courses',
    'course_assignments',
    'documents',
    'hos_daily_logs',
    'organizations',
    'fleets',
    'user_roles'
  ];
begin
  foreach t in array full_tables loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.write_audit_log()', t);
  end loop;

  drop trigger if exists audit_duty_status_events on public.duty_status_events;
  create trigger audit_duty_status_events
    after update on public.duty_status_events
    for each row execute function public.write_audit_log();
end;
$$;
