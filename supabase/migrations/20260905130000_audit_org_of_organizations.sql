-- ============================================================================
-- The organisations table is its own organisation
-- ============================================================================
-- The audit trigger read org_id off the row it was given. Every audited table
-- has one except the one that IS an organisation: `organizations.id` is the
-- org, and there is no org_id to find.
--
-- audit_log.org_id is not null, so the trigger raised — and because a failed
-- audit rolls the statement back, creating an organisation stopped working
-- entirely. The test suite caught it on the first line of its setup, which is
-- the whole reason that suite creates real companies.
--
-- Anything else with no org_id raises with the table named, rather than
-- skipping the row. A gap in an audit trail is worse than a loud failure the
-- first time somebody adds a table to the list, and that failure lands in
-- seconds rather than being noticed by an inspector.
-- ============================================================================

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

  v_org := coalesce(
    nullif(v_row ->> 'org_id', '')::uuid,
    -- The organisations table has no org_id; its own id is the organisation.
    case when tg_table_name = 'organizations'
      then nullif(v_row ->> 'id', '')::uuid
    end
  );

  if v_org is null then
    raise exception
      'write_audit_log: no organisation for a row in %. Add a case for it or take it off the audited list.',
      tg_table_name
      using errcode = 'P0001';
  end if;

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
   * Only what actually changed. A diff is what somebody reads; a pair of full
   * rows is something they have to compare by eye. updated_at is dropped
   * because it moves on every write and says nothing.
   */
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', v_old -> key, 'to', v_row -> key))
      into v_changes
    from jsonb_object_keys(v_row) as key
    where key not in ('updated_at')
      and (v_old -> key) is distinct from (v_row -> key);

    -- A row rewritten to the same values is not a change anybody reads about.
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
