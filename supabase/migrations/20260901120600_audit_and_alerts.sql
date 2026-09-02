-- ============================================================================
-- Audit trail and alert rules  (2 tables)   -- admin modules A14, A15
-- ============================================================================
-- Who did what, and which events are worth telling someone about.
--
-- The audit trail is also what fills the dashboard's "recent activity" panel.
-- That panel is currently empty on live data for exactly this reason: there
-- was nowhere to read it from.
--
-- No notifications table. A notification is an alert rule matching an event;
-- storing every delivered copy would be a high-volume table whose only reader
-- is a bell icon. In-app notifications are read from the events themselves -
-- open defects, pending edits, expiring documents - all of which are already
-- indexed for it.
-- ============================================================================


create type public.alert_channel as enum ('in_app', 'email', 'sms');


-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
-- Append-only, like duty_status_events, and for the same reason: an audit
-- trail that can be edited is not one. There is no updated_at and no
-- deleted_at, and the trigger below refuses updates and deletes outright.
--
-- actor_user_id is nullable and the reference is `set null`: the trail must
-- survive the account that made the entry being removed. actor_label keeps the
-- name readable after that happens.

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,

  actor_user_id uuid references public.users(id)   on delete set null,
  actor_driver_id uuid references public.drivers(id) on delete set null,
  -- Written at the time, so the entry still reads correctly years later even
  -- if the person has left and their row is gone.
  actor_label   text,

  action        text        not null,   -- approved_log_edit, closed_work_order
  entity_type   text,                   -- drivers, work_orders, routes
  entity_id     uuid,
  summary       text,                   -- one line, ready to display

  -- What changed. Kept small on purpose: the fields that moved, not the whole
  -- row, or this table becomes the largest in the database.
  changes       jsonb,

  ip_address    inet,
  created_at    timestamptz not null default now(),

  constraint audit_log_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_log_changes_is_object check (
    changes is null or jsonb_typeof(changes) = 'object'
  )
);

comment on table public.audit_log is
  'Append-only record of who changed what. Also the source of the dashboard activity feed.';

comment on column public.audit_log.actor_label is
  'The actor name as it read at the time, so the entry survives the account being deleted.';

create index audit_log_org_time_idx on public.audit_log (org_id, created_at desc);
create index audit_log_actor_idx    on public.audit_log (actor_user_id, created_at desc)
  where actor_user_id is not null;
create index audit_log_entity_idx   on public.audit_log (entity_type, entity_id)
  where entity_id is not null;

create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only: entries cannot be % ',
    case tg_op when 'DELETE' then 'deleted' else 'changed' end
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.audit_log_append_only() is
  'Trigger function: refuses every update and delete on the audit trail.';

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();


-- ---------------------------------------------------------------------------
-- alert_rules
-- ---------------------------------------------------------------------------
-- Which events notify whom, on which channel.
--
-- Recipients are role keys rather than user ids. "Tell the compliance officer"
-- keeps working when the compliance officer changes job; "tell Priya" does not.

create table public.alert_rules (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,

  -- Which event this rule is about: hours_violation, unsafe_defect,
  -- document_expiring, service_overdue, speeding.
  event_key       text        not null,
  name            text        not null,
  description     text,

  is_active       boolean     not null default true,
  channels        public.alert_channel[] not null default '{in_app}',

  -- Role keys from public.roles.
  recipient_roles text[]      not null default '{}',

  -- Rule-specific numbers: { "daysBefore": 30 } or { "overLimitKph": 15 }.
  -- A column each would mean a migration every time a rule gains a knob.
  thresholds      jsonb       not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint alert_rules_event_key_not_blank check (length(btrim(event_key)) > 0),
  constraint alert_rules_name_not_blank      check (length(btrim(name)) > 0),
  constraint alert_rules_has_channel         check (array_length(channels, 1) >= 1),
  constraint alert_rules_thresholds_is_object check (jsonb_typeof(thresholds) = 'object')
);

comment on table public.alert_rules is
  'Which events notify whom. Recipients are role keys, so a rule survives staff changes.';

comment on column public.alert_rules.thresholds is
  'Rule-specific settings as JSONB, so a new knob does not need a migration.';

-- One rule per event per organisation. Two rules for the same event would
-- double every notification.
create unique index alert_rules_event_idx on public.alert_rules (org_id, event_key)
  where deleted_at is null;

create index alert_rules_active_idx on public.alert_rules (org_id)
  where is_active and deleted_at is null;

create trigger alert_rules_set_updated_at before update on public.alert_rules
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.audit_log   enable row level security;
alter table public.alert_rules enable row level security;


-- audit_log -----------------------------------------------------------------
-- Read by the office only. A driver has no business reading the trail, and
-- nobody writes to it from the browser: entries come from the server, which
-- uses the secret key and bypasses these policies. There is deliberately no
-- insert policy for `authenticated` - a client that can write its own audit
-- entries can write false ones.

create policy audit_log_select_org on public.audit_log
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.has_org_role(org_id, array['fleet_admin','compliance_officer']))
  );


-- alert_rules ---------------------------------------------------------------

create policy alert_rules_select_org on public.alert_rules
  for select to authenticated
  using ((select public.is_super_admin()) or org_id in (select public.current_org_ids()));

create policy alert_rules_write on public.alert_rules
  for all to authenticated
  using ((select public.has_org_role(org_id, array['fleet_admin'])))
  with check ((select public.has_org_role(org_id, array['fleet_admin'])));


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- audit_log gets select only. Even with the append-only trigger, withholding
-- insert means a browser cannot forge an entry in the first place.

grant select                         on public.audit_log   to authenticated;
grant select, insert, update, delete on public.alert_rules to authenticated;
