-- ============================================================================
-- Do not audit a change into an organisation that is on its way out
-- ============================================================================
-- Deleting an organisation stopped working the day the audit triggers landed,
-- and the reason is a loop the triggers created themselves:
--
--   1. the organizations row is deleted
--   2. every child row cascades — drivers, vehicles, routes, the lot
--   3. each of those deletions fires write_audit_log
--   4. the trigger inserts an audit row whose org_id is the organisation
--      that was removed in step 1
--   5. audit_log_org_id_fkey refuses it, and the whole delete rolls back
--
-- So no organisation could be deleted at all, and the error named a foreign
-- key rather than the thing that caused it.
--
-- The fix is to notice that there is nowhere for that audit row to live.
-- audit_log.org_id is ON DELETE CASCADE, so every row written in step 4 would
-- be deleted moments later anyway — the trigger was insisting on writing
-- history into a filing cabinet that was being carried out of the building.
--
-- One indexed existence check per audited write. That is a real cost on a
-- table like route_stops, and still the right trade: the alternative is an
-- audit trail that cannot be reasoned about because deletes are impossible.
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
   * The organisation is already gone — this is its own deletion, or one of the
   * cascade that follows. There is nothing to write into and nothing that
   * would survive if there were: audit_log cascades with the organisation.
   *
   * Checked rather than caught, because catching a foreign key violation here
   * would also swallow a real one.
   */
  if not exists (select 1 from public.organizations o where o.id = v_org) then
    return coalesce(new, old);
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
