-- ============================================================================
-- Tenancy and identity  (7 tables)
-- ============================================================================
-- Organisations, the fleets inside them, staff accounts, roles, and the
-- invitations that bring new staff in.
--
-- This is the root of the security model. Every other table in the database
-- carries an org_id that points back here, and every row-level-security policy
-- resolves to "does the signed-in user hold a role in this organisation".
--
-- Note on grants: the project was created with "automatically expose new
-- tables" turned OFF, so a new table is invisible to the API until it is
-- granted explicitly. That is deliberate - a table has to be opened on
-- purpose, and forgetting to write a policy fails closed instead of open.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
-- One row per carrier. The tenancy boundary.

create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  legal_name    text,

  -- Regulator identifiers. Nullable because they differ by country and the
  -- operating country is not settled yet.
  dot_number    text,
  mc_number     text,

  country_code  char(2)     not null default 'US',
  timezone      text        not null default 'UTC',

  -- Branding, surfaced in the driver app as well as the console.
  logo_url      text,
  primary_color text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint organizations_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.organizations is
  'One row per carrier. Root of the tenancy model - every other table links back here.';

create index organizations_active_idx on public.organizations (id) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- fleets
-- ---------------------------------------------------------------------------
-- Divisions inside a carrier - by depot, region, or contract. A user's role
-- can be scoped to one fleet, or left unscoped to cover the whole org.

create table public.fleets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  name       text        not null,
  code       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint fleets_name_not_blank check (length(btrim(name)) > 0),
  constraint fleets_code_unique_per_org unique (org_id, code)
);

comment on table public.fleets is
  'Divisions within a carrier. A role scoped to a fleet sees only that fleet.';

create index fleets_org_idx on public.fleets (org_id) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
-- System roles have org_id NULL and is_system TRUE; they are seeded below and
-- shared by every customer. A customer may add their own roles, which carry
-- their org_id.
--
-- super_admin is deliberately a system role that can only be granted with
-- org_id NULL (see user_roles), so no customer admin can create one.

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,
  key         text        not null,
  name        text        not null,
  description text,
  is_system   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint roles_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint roles_system_has_no_org check (
    (is_system and org_id is null) or (not is_system and org_id is not null)
  )
);

-- Two partial indexes rather than one constraint, because NULL org_id would
-- otherwise let duplicate system role keys through.
create unique index roles_system_key_idx on public.roles (key) where org_id is null;
create unique index roles_org_key_idx    on public.roles (org_id, key) where org_id is not null;

comment on table public.roles is
  'Seven system roles plus any custom roles a customer defines.';


-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
-- What each role may do, per admin module. `module` holds the reference code
-- from the scope document (A01 to A15) so the console and the document stay
-- in step.

create table public.permissions (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid        not null references public.roles(id) on delete cascade,
  module     text        not null,
  can_view   boolean     not null default false,
  can_edit   boolean     not null default false,
  can_delete boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint permissions_module_format check (module ~ '^A(0[1-9]|1[0-5])$'),
  constraint permissions_role_module_unique unique (role_id, module),

  -- Editing implies viewing; deleting implies editing. Stops a permission row
  -- from describing a state the console cannot render.
  constraint permissions_coherent check (
    (not can_edit or can_view) and (not can_delete or can_edit)
  )
);

comment on table public.permissions is
  'Per-module rights for a role. module matches the A01-A15 codes in the scope document.';

create index permissions_role_idx on public.permissions (role_id);


-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Profile data for anyone who can sign in - office staff and drivers alike.
-- Authentication itself lives in auth.users, which this mirrors one-to-one.
--
-- The row is created automatically by a trigger on auth.users, so the
-- application never has to remember to do it.

create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text        not null,
  full_name    text,
  phone        text,
  avatar_url   text,
  locale       text        not null default 'en',
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

comment on table public.users is
  'Profile mirror of auth.users. Populated by the on_auth_user_created trigger.';

create index users_email_idx on public.users (lower(email));


-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
-- Grants a role to a user, optionally narrowed to one fleet.
--
--   org_id NULL   -> platform-wide grant, only valid for super_admin
--   fleet_id NULL -> the role covers every fleet in the organisation
--
-- Revocation is a timestamp rather than a delete, so the audit trail survives.

create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete cascade,
  fleet_id   uuid references public.fleets(id) on delete cascade,
  role_id    uuid        not null references public.roles(id) on delete restrict,

  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,

  -- A fleet-scoped grant must belong to an organisation.
  constraint user_roles_fleet_needs_org check (fleet_id is null or org_id is not null)
);

comment on table public.user_roles is
  'Role grants. org_id NULL means a platform-wide grant; fleet_id NULL means all fleets.';

-- One active grant per user, org, fleet and role. The COALESCE keeps NULL
-- org_id and fleet_id from defeating uniqueness.
create unique index user_roles_active_unique_idx
  on public.user_roles (
    user_id,
    coalesce(org_id,   '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(fleet_id, '00000000-0000-0000-0000-000000000000'::uuid),
    role_id
  )
  where revoked_at is null;

-- current_org_ids() runs on every single query in the database, so this index
-- carries more traffic than any other in the schema.
create index user_roles_user_active_idx on public.user_roles (user_id, org_id) where revoked_at is null;
create index user_roles_org_idx         on public.user_roles (org_id)          where revoked_at is null;


-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
-- A pending invite to join an organisation. The token is stored hashed, so a
-- leaked database dump does not hand out working invite links.

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  fleet_id     uuid references public.fleets(id) on delete set null,
  role_id      uuid        not null references public.roles(id) on delete restrict,

  email        text        not null,
  token_hash   text        not null,

  invited_by   uuid references public.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.users(id) on delete set null,
  revoked_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint invitations_email_format check (position('@' in email) > 1)
);

comment on table public.invitations is
  'Pending staff invitations. token_hash stores a hash, never the raw token.';

create unique index invitations_pending_unique_idx
  on public.invitations (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index invitations_org_idx   on public.invitations (org_id);
create index invitations_token_idx on public.invitations (token_hash);


-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger fleets_set_updated_at before update on public.fleets
  for each row execute function public.set_updated_at();
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at before update on public.permissions
  for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Mirror auth.users into public.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates the public.users profile row whenever someone signs up.';


-- ---------------------------------------------------------------------------
-- Seed the system roles
-- ---------------------------------------------------------------------------

insert into public.roles (key, name, description, is_system) values
  ('super_admin',        'Super admin',        'Platform staff. Sees every organisation.',                       true),
  ('fleet_admin',        'Fleet admin',        'Full control of their own organisation.',                        true),
  ('dispatcher',         'Dispatcher',         'Plans routes, assigns work, messages drivers.',                  true),
  ('compliance_officer', 'Compliance officer', 'Reviews working-hours logs, violations and audit exports.',       true),
  ('safety_manager',     'Safety manager',     'Reviews incidents, assigns coaching and training.',              true),
  ('mechanic',           'Mechanic',           'Sees vehicle defects and repair jobs.',                          true),
  ('viewer',             'Viewer',             'Read-only access.',                                              true);


-- Default per-module permissions for the system roles.
-- fleet_admin gets everything; the rest are scoped to their job.
with r as (select id, key from public.roles where is_system),
     modules as (
       select unnest(array[
         'A01','A02','A03','A04','A05','A06','A07','A08',
         'A09','A10','A11','A12','A13','A14','A15'
       ]) as module
     )
insert into public.permissions (role_id, module, can_view, can_edit, can_delete)
select
  r.id,
  m.module,
  -- view
  case r.key
    when 'super_admin'        then true
    when 'fleet_admin'        then true
    when 'viewer'             then m.module <> 'A15'
    when 'dispatcher'         then m.module in ('A02','A03','A04','A05','A08','A09','A10','A13')
    when 'compliance_officer' then m.module in ('A02','A04','A05','A06','A07','A13','A14')
    when 'safety_manager'     then m.module in ('A02','A03','A04','A06','A07','A11','A12','A14')
    when 'mechanic'           then m.module in ('A02','A05','A07')
    else false
  end,
  -- edit
  case r.key
    when 'super_admin'        then true
    when 'fleet_admin'        then true
    when 'dispatcher'         then m.module in ('A08','A09','A10')
    when 'compliance_officer' then m.module in ('A06','A07')
    when 'safety_manager'     then m.module in ('A11','A12')
    when 'mechanic'           then m.module in ('A05','A07')
    else false
  end,
  -- delete
  case r.key
    when 'super_admin' then true
    when 'fleet_admin' then true
    else false
  end
from r cross join modules m;


-- ---------------------------------------------------------------------------
-- Tenancy helpers
-- ---------------------------------------------------------------------------
-- These decide what the signed-in user is allowed to see. Every row-level
-- security policy in this database is built on them, which makes them the most
-- security-sensitive code in the project.
--
-- They are defined here, after user_roles exists, because a `language sql`
-- function is validated at creation time and cannot reference a table that has
-- not been created yet.
--
-- Three properties matter in every definition below:
--
--   security definer  - the function reads user_roles, which the caller is not
--                       otherwise permitted to read freely. Without this the
--                       policies would recurse into their own table.
--   stable            - lets Postgres call it once per statement instead of
--                       once per row.
--   set search_path   - stops a caller from shadowing `public` with their own
--                       schema and substituting a fake user_roles table.

-- Every organisation the current user belongs to.
create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct ur.org_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.revoked_at is null
    and ur.org_id is not null;
$$;

comment on function public.current_org_ids() is
  'Organisation ids the signed-in user has an active role in. Basis of every RLS policy.';


-- True when the user holds the platform-wide super admin role. Super admins
-- are our own staff, not a customer's. The grant is scoped to org_id IS NULL,
-- and user_roles policies forbid writing rows in that shape, so no customer
-- admin can ever create one.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and ur.org_id is null
      and r.key = 'super_admin'
  );
$$;

comment on function public.is_super_admin() is
  'True for platform staff. Customer admins can never grant this role.';


-- True when the user has an active role in the given organisation.
create or replace function public.has_org_access(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and ur.org_id = target_org_id
  );
$$;


-- True when the user holds any of the named role keys in the given
-- organisation. Used by policies that need more than "can this user see the
-- organisation at all" - for example, only a fleet admin may grant a role.
create or replace function public.has_org_role(target_org_id uuid, role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and ur.org_id = target_org_id
      and r.key = any(role_keys)
  );
$$;


-- These are security definer, so execution is granted deliberately rather than
-- left on the default PUBLIC grant.
revoke execute on function public.current_org_ids()          from public;
revoke execute on function public.is_super_admin()           from public;
revoke execute on function public.has_org_access(uuid)       from public;
revoke execute on function public.has_org_role(uuid, text[]) from public;

grant execute on function public.current_org_ids()           to authenticated;
grant execute on function public.is_super_admin()            to authenticated;
grant execute on function public.has_org_access(uuid)        to authenticated;
grant execute on function public.has_org_role(uuid, text[])  to authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Every policy below calls the helpers as `(select public.fn())`. That form is
-- evaluated once per statement instead of once per row - the difference is
-- large enough to matter on every table, and decisive on the big ones.

alter table public.organizations enable row level security;
alter table public.fleets        enable row level security;
alter table public.roles         enable row level security;
alter table public.permissions   enable row level security;
alter table public.users         enable row level security;
alter table public.user_roles    enable row level security;
alter table public.invitations   enable row level security;


-- organizations ------------------------------------------------------------

create policy organizations_select on public.organizations
  for select to authenticated
  using (
    (select public.is_super_admin())
    or id in (select public.current_org_ids())
  );

create policy organizations_update on public.organizations
  for update to authenticated
  using (
    (select public.is_super_admin())
    or (select public.has_org_role(id, array['fleet_admin']))
  )
  with check (
    (select public.is_super_admin())
    or (select public.has_org_role(id, array['fleet_admin']))
  );

-- Creating and deleting an organisation is a platform operation, not something
-- a customer does for themselves. No insert or delete policy is defined, so
-- both are refused for every signed-in user.


-- fleets --------------------------------------------------------------------

create policy fleets_select on public.fleets
  for select to authenticated
  using (
    (select public.is_super_admin())
    or org_id in (select public.current_org_ids())
  );

create policy fleets_write on public.fleets
  for all to authenticated
  using (
    (select public.is_super_admin())
    or (select public.has_org_role(org_id, array['fleet_admin']))
  )
  with check (
    (select public.is_super_admin())
    or (select public.has_org_role(org_id, array['fleet_admin']))
  );


-- roles ---------------------------------------------------------------------
-- System roles are readable by everyone signed in, because the console needs
-- their names to render. Custom roles are visible only inside their org.

create policy roles_select on public.roles
  for select to authenticated
  using (
    is_system
    or (select public.is_super_admin())
    or org_id in (select public.current_org_ids())
  );

-- Only custom roles are writable, and only by a fleet admin in that org.
-- The is_system guard is what stops a customer from editing super_admin.
create policy roles_write on public.roles
  for all to authenticated
  using (
    not is_system
    and org_id is not null
    and (select public.has_org_role(org_id, array['fleet_admin']))
  )
  with check (
    not is_system
    and org_id is not null
    and (select public.has_org_role(org_id, array['fleet_admin']))
  );


-- permissions ---------------------------------------------------------------

create policy permissions_select on public.permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = permissions.role_id
        and (
          r.is_system
          or (select public.is_super_admin())
          or r.org_id in (select public.current_org_ids())
        )
    )
  );

create policy permissions_write on public.permissions
  for all to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = permissions.role_id
        and not r.is_system
        and r.org_id is not null
        and (select public.has_org_role(r.org_id, array['fleet_admin']))
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = permissions.role_id
        and not r.is_system
        and r.org_id is not null
        and (select public.has_org_role(r.org_id, array['fleet_admin']))
    )
  );


-- users ---------------------------------------------------------------------
-- A user always sees their own profile. Beyond that, staff see colleagues who
-- share an organisation with them.

create policy users_select_self on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy users_select_colleagues on public.users
  for select to authenticated
  using (
    (select public.is_super_admin())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = users.id
        and ur.revoked_at is null
        and ur.org_id in (select public.current_org_ids())
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Insert happens through the auth trigger, which runs as security definer and
-- therefore bypasses RLS. No insert policy is needed or wanted.


-- user_roles ----------------------------------------------------------------
-- The helper functions read this table, but they are security definer, so
-- these policies never recurse into themselves.

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_super_admin())
    or org_id in (select public.current_org_ids())
  );

-- Granting and revoking is a fleet admin action, and it is explicitly blocked
-- from touching platform-wide grants: org_id must not be null, which is
-- exactly the shape a super_admin grant has.
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (
    org_id is not null
    and (select public.has_org_role(org_id, array['fleet_admin']))
  )
  with check (
    org_id is not null
    and (select public.has_org_role(org_id, array['fleet_admin']))
    and exists (
      select 1 from public.roles r
      where r.id = user_roles.role_id
        and r.key <> 'super_admin'
    )
  );


-- invitations ---------------------------------------------------------------

create policy invitations_select on public.invitations
  for select to authenticated
  using (
    (select public.is_super_admin())
    or org_id in (select public.current_org_ids())
  );

create policy invitations_write on public.invitations
  for all to authenticated
  using (
    (select public.has_org_role(org_id, array['fleet_admin']))
  )
  with check (
    (select public.has_org_role(org_id, array['fleet_admin']))
  );


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Required because the project has "automatically expose new tables" off.
-- RLS still decides which rows are visible; these grants only decide which
-- tables the API will talk to at all.

grant usage on schema public to authenticated;

grant select                         on public.organizations to authenticated;
grant update                         on public.organizations to authenticated;
grant select, insert, update, delete on public.fleets        to authenticated;
grant select, insert, update, delete on public.roles         to authenticated;
grant select, insert, update, delete on public.permissions   to authenticated;
grant select, update                 on public.users         to authenticated;
grant select, insert, update, delete on public.user_roles    to authenticated;
grant select, insert, update, delete on public.invitations   to authenticated;

-- The anon role gets nothing. Nothing in this schema is public.
