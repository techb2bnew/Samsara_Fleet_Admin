-- ============================================================================
-- Append-only: an escape hatch for the platform operator
-- ============================================================================
-- The triggers on duty_status_events and audit_log refused every delete, from
-- everyone. That is right for the app and wrong for the operator, and it broke
-- two real things:
--
--   1. Deleting an organisation. The cascade reaches these tables, the trigger
--      refuses, and the whole delete rolls back - so the organisation survives.
--      The RLS suite hit this immediately: its teardown could not remove the
--      companies it had created, and each run left a dead tenant behind.
--   2. Erasing a customer. When a contract ends, or someone exercises a right
--      to erasure, their data has to actually go. A table nothing on earth can
--      delete from is not a compliance feature, it is a liability.
--
-- The exemption is narrow. `postgres` is migrations and psql; `service_role`
-- is the secret key, which lives only on a server and already bypasses every
-- row-level policy - it could always read and rewrite anything, so this grants
-- it nothing it did not have.
--
-- What matters is unchanged: `authenticated` - every browser and every phone -
-- still cannot rewrite a duty record or touch the audit trail. That is the
-- audience the rule was written for.
-- ============================================================================

create or replace function public.duty_status_events_append_only()
returns trigger
language plpgsql
as $$
begin
  -- Migrations and the secret key. Not reachable from a browser or a phone.
  if current_user in ('postgres', 'service_role') then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'duty_status_events is append-only: row % cannot be deleted', old.id
      using errcode = 'restrict_violation';
  end if;

  -- An original record is final the moment it is written.
  if old.edit_of_id is null then
    raise exception 'duty_status_events is append-only: row % cannot be updated, write a correction instead', old.id
      using errcode = 'restrict_violation';
  end if;

  -- An edit may only have its outcome recorded. What it proposes is fixed.
  if new.driver_id  is distinct from old.driver_id
     or new.status  is distinct from old.status
     or new.started_at  is distinct from old.started_at
     or new.edit_of_id  is distinct from old.edit_of_id
     or new.edit_reason is distinct from old.edit_reason
     or new.proposed_by is distinct from old.proposed_by then
    raise exception 'only the review outcome of a proposed edit may be changed'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.duty_status_events_append_only() is
  'Blocks app-side deletes and rewrites of duty records. Migrations and the secret key are exempt so a tenant can still be erased.';


create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  raise exception 'audit_log is append-only: entries cannot be % ',
    case tg_op when 'DELETE' then 'deleted' else 'changed' end
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.audit_log_append_only() is
  'Refuses app-side updates and deletes on the audit trail. Migrations and the secret key are exempt so a tenant can still be erased.';
