-- =====================================================================
-- B&M HomeKeeper — COMPLETE SETUP
--
-- ▶ WHAT THIS IS
--   Every database file in one. Paste the whole thing into the Supabase
--   SQL Editor and press Run, once. It builds every table, every security
--   rule, both file buckets, and loads the Miller Home demo with three
--   test logins.
--
--   ALREADY SET UP? Do not run this — use CATCH-UP.sql instead.
--
-- ▶ HOW TO USE IT
--   1. Supabase dashboard → SQL Editor → New query
--   2. Select all of this file, copy, paste
--   3. Run
--   You want "Success. No rows returned."
--
-- ▶ RUN IT ONCE, ON A FRESH PROJECT
--   Running it twice will error on the second go (the tables already
--   exist). That is harmless but confusing — if you need to start over,
--   create a new Supabase project rather than re-running this.
--
-- ▶ DEMO LOGINS IT CREATES
--   admin@bmhomekeeper.test   HomeKeeper!2026
--   tech@bmhomekeeper.test    HomeKeeper!2026
--   member@bmhomekeeper.test  HomeKeeper!2026
--
--   DELETE ALL THREE before a real customer exists — that password is
--   published in this repository. Authentication → Users → delete.
--
-- ▶ ALSO TURN OFF PUBLIC SIGNUP
--   Authentication → Providers → Email → disable signups.
--   See SECURITY-REVIEW.md for why this one matters.
-- =====================================================================


-- ####################################################################
-- ## 0001_schema.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0001 schema
-- Core data objects: property, member, room, asset, visit, checklist_item,
-- finding, service_request, trade_partner, document, plan_item, report, photo
-- =====================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- The four roles from the project brief.
create type public.user_role as enum ('admin', 'tech', 'member', 'trade');

-- Finding status system — labels are fixed by the brief. Colors live in the UI
-- (lib/types/finding-status.ts), not in the database.
create type public.finding_status as enum (
  'GOOD',        -- green
  'MONITOR',     -- blue
  'PLAN',        -- amber
  'ACTION',      -- red
  'IMPROVEMENT'  -- purple
);

-- Service request stages, in order. Stored with underscores because Postgres
-- enum labels with spaces are painful to type; the display labels ("AWAITING
-- APPROVAL") are rendered in the UI.
create type public.service_request_stage as enum (
  'NEW',
  'TRIAGE',
  'DISPATCHED',
  'ACCEPTED',
  'ESTIMATING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'HOME_RECORD_UPDATED',
  'CLOSED'
);

create type public.visit_status as enum ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
create type public.visit_type as enum ('ONBOARDING', 'SEASONAL', 'ANNUAL', 'SERVICE', 'FOLLOW_UP');
create type public.checklist_result as enum ('PASS', 'ATTENTION', 'FAIL', 'NOT_APPLICABLE', 'NOT_CHECKED');
create type public.asset_condition as enum ('NEW', 'GOOD', 'FAIR', 'POOR', 'END_OF_LIFE', 'UNKNOWN');
create type public.plan_item_status as enum ('PROPOSED', 'APPROVED', 'SCHEDULED', 'DONE', 'DECLINED', 'DEFERRED');
create type public.priority_level as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type public.document_type as enum (
  'MANUAL', 'WARRANTY', 'RECEIPT', 'PERMIT', 'INSPECTION', 'INSURANCE',
  'CONTRACT', 'ESTIMATE', 'INVOICE', 'REPORT', 'OTHER'
);
create type public.report_type as enum ('VISIT_SUMMARY', 'ANNUAL_REVIEW', 'HOME_RECORD', 'HOME_PLAN');

-- ---------------------------------------------------------------------
-- profiles — one row per authenticated user, carries the role
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'member',
  full_name   text not null default '',
  email       text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application user. role drives every RLS policy in this schema.';

-- ---------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------
create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address_line1   text not null,
  address_line2   text,
  city            text not null,
  state           text not null default 'PA',
  postal_code     text not null,
  year_built      integer,
  square_feet     integer,
  bedrooms        integer,
  bathrooms       numeric(3,1),
  lot_size_acres  numeric(6,2),
  plan_tier       text,
  member_since    date,
  notes           text,
  -- Deliberately NO fields for alarm codes, gate codes, safe combinations,
  -- key locations or payment data. See CLAUDE.md rule 3.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- members — a homeowner attached to a property
-- ---------------------------------------------------------------------
create table public.members (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  profile_id   uuid references public.profiles (id) on delete set null,
  first_name   text not null,
  last_name    text not null,
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  relationship text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index members_property_id_idx on public.members (property_id);
create index members_profile_id_idx  on public.members (profile_id);

-- ---------------------------------------------------------------------
-- property_techs — which technicians are assigned to which property
-- Drives the "tech sees assigned properties only" rule.
-- ---------------------------------------------------------------------
create table public.property_techs (
  property_id uuid not null references public.properties (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (property_id, profile_id)
);

create index property_techs_profile_id_idx on public.property_techs (profile_id);

-- ---------------------------------------------------------------------
-- trade_partners
-- ---------------------------------------------------------------------
create table public.trade_partners (
  id             uuid primary key default gen_random_uuid(),
  company_name   text not null,
  trade          text not null,
  contact_name   text,
  email          text,
  phone          text,
  license_number text,
  profile_id     uuid references public.profiles (id) on delete set null,
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index trade_partners_profile_id_idx on public.trade_partners (profile_id);

-- ---------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name        text not null,
  room_type   text,
  floor       text,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rooms_property_id_idx on public.rooms (property_id);

-- ---------------------------------------------------------------------
-- assets — the Home Record
-- ---------------------------------------------------------------------
create table public.assets (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  room_id             uuid references public.rooms (id) on delete set null,
  category            text not null,
  name                text not null,
  manufacturer        text,
  model               text,
  serial_number       text,
  finish              text,
  install_date        date,
  warranty_expires    date,
  expected_life_years integer,
  condition           public.asset_condition not null default 'UNKNOWN',
  last_serviced_at    date,
  location_notes      text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index assets_property_id_idx on public.assets (property_id);
create index assets_room_id_idx     on public.assets (room_id);
create index assets_category_idx    on public.assets (category);

-- ---------------------------------------------------------------------
-- visits
-- ---------------------------------------------------------------------
create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  tech_id       uuid references public.profiles (id) on delete set null,
  visit_type    public.visit_type not null default 'SEASONAL',
  status        public.visit_status not null default 'SCHEDULED',
  scheduled_for timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  title         text,
  summary       text,
  member_notes  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index visits_property_id_idx on public.visits (property_id);
create index visits_tech_id_idx     on public.visits (tech_id);

-- ---------------------------------------------------------------------
-- checklist_items — what the tech ticks off during a visit
-- ---------------------------------------------------------------------
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits (id) on delete cascade,
  category    text not null,
  label       text not null,
  result      public.checklist_result not null default 'NOT_CHECKED',
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index checklist_items_visit_id_idx on public.checklist_items (visit_id);

-- ---------------------------------------------------------------------
-- findings
-- ---------------------------------------------------------------------
create table public.findings (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  visit_id            uuid references public.visits (id) on delete set null,
  room_id             uuid references public.rooms (id) on delete set null,
  asset_id            uuid references public.assets (id) on delete set null,
  status              public.finding_status not null,
  title               text not null,
  description         text,
  recommendation      text,
  priority            public.priority_level not null default 'MEDIUM',
  estimated_cost_low  numeric(10,2),
  estimated_cost_high numeric(10,2),
  created_by          uuid references public.profiles (id) on delete set null,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index findings_property_id_idx on public.findings (property_id);
create index findings_visit_id_idx    on public.findings (visit_id);
create index findings_status_idx      on public.findings (status);

-- ---------------------------------------------------------------------
-- plan_items — the Home Plan
-- ---------------------------------------------------------------------
create table public.plan_items (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  finding_id          uuid references public.findings (id) on delete set null,
  title               text not null,
  description         text,
  category            text,
  target_year         integer,
  target_season       text,
  priority            public.priority_level not null default 'MEDIUM',
  status              public.plan_item_status not null default 'PROPOSED',
  estimated_cost_low  numeric(10,2),
  estimated_cost_high numeric(10,2),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index plan_items_property_id_idx on public.plan_items (property_id);

-- ---------------------------------------------------------------------
-- service_requests
-- ---------------------------------------------------------------------
create table public.service_requests (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties (id) on delete cascade,
  member_id        uuid references public.members (id) on delete set null,
  created_by       uuid references public.profiles (id) on delete set null,
  trade_partner_id uuid references public.trade_partners (id) on delete set null,
  assigned_tech_id uuid references public.profiles (id) on delete set null,
  stage            public.service_request_stage not null default 'NEW',
  title            text not null,
  description      text,
  priority         public.priority_level not null default 'MEDIUM',
  estimate_amount  numeric(10,2),
  approved_at      timestamptz,
  scheduled_for    timestamptz,
  completed_at     timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index service_requests_property_id_idx      on public.service_requests (property_id);
create index service_requests_stage_idx            on public.service_requests (stage);
create index service_requests_trade_partner_id_idx on public.service_requests (trade_partner_id);

-- Stage history, so the pipeline is auditable.
create table public.service_request_events (
  id                 uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  from_stage         public.service_request_stage,
  to_stage           public.service_request_stage not null,
  note               text,
  actor_id           uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index service_request_events_request_idx on public.service_request_events (service_request_id);

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  asset_id     uuid references public.assets (id) on delete set null,
  title        text not null,
  doc_type     public.document_type not null default 'OTHER',
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index documents_property_id_idx on public.documents (property_id);

-- ---------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------
create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  finding_id   uuid references public.findings (id) on delete cascade,
  asset_id     uuid references public.assets (id) on delete set null,
  visit_id     uuid references public.visits (id) on delete set null,
  room_id      uuid references public.rooms (id) on delete set null,
  storage_path text not null,
  caption      text,
  width        integer,
  height       integer,
  size_bytes   bigint,
  taken_at     timestamptz,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index photos_property_id_idx on public.photos (property_id);
create index photos_finding_id_idx  on public.photos (finding_id);

-- ---------------------------------------------------------------------
-- reports — generated PDFs
-- ---------------------------------------------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  visit_id     uuid references public.visits (id) on delete set null,
  title        text not null,
  report_type  public.report_type not null default 'VISIT_SUMMARY',
  period_start date,
  period_end   date,
  storage_path text,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index reports_property_id_idx on public.reports (property_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'properties', 'members', 'trade_partners', 'rooms', 'assets',
    'visits', 'checklist_items', 'findings', 'plan_items', 'service_requests',
    'documents'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile row
-- Role comes from user metadata when an admin creates the user; otherwise
-- defaults to the least-privileged role, 'member'.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  begin
    requested_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    requested_role := 'member';
  end;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(requested_role, 'member'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ####################################################################
-- ## 0002_rls.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0002 Row Level Security
--
-- CLAUDE.md rule 2: "Members can never see another property's data.
-- Enforce with RLS, not just UI."
--
-- Model: RLS is ON for every table with a deny-by-default posture (no
-- policy = no access). Access is granted per role:
--   admin  — everything
--   tech   — only properties they are assigned to (public.property_techs)
--   member — only properties they are linked to (public.members), read-only
--            except for raising service requests
--   trade  — only the service requests dispatched to their company
--
-- The helper functions are SECURITY DEFINER so they can read profiles /
-- members / property_techs without tripping the policies on those same
-- tables (which would recurse infinitely).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- Can the current user SEE this property at all?
create or replace function public.can_access_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'tech' then exists (
      select 1 from public.property_techs pt
      where pt.property_id = target_property_id
        and pt.profile_id = auth.uid()
    )
    when 'member' then exists (
      select 1 from public.members m
      where m.property_id = target_property_id
        and m.profile_id = auth.uid()
    )
    else false
  end
$$;

-- Can the current user CHANGE data on this property?
-- Members are read-only on the Home Record; only staff write.
create or replace function public.can_write_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'tech' then exists (
      select 1 from public.property_techs pt
      where pt.property_id = target_property_id
        and pt.profile_id = auth.uid()
    )
    else false
  end
$$;

-- Is the current user the trade partner on this service request?
create or replace function public.is_trade_for_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    join public.trade_partners tp on tp.id = sr.trade_partner_id
    where sr.id = target_request_id
      and tp.profile_id = auth.uid()
      and tp.is_active
  )
$$;

-- The property a visit belongs to (used by checklist_items).
create or replace function public.visit_property_id(target_visit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select property_id from public.visits where id = target_visit_id
$$;

-- ---------------------------------------------------------------------
-- Turn RLS on everywhere. No table is exempt.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'properties', 'members', 'property_techs', 'trade_partners',
    'rooms', 'assets', 'visits', 'checklist_items', 'findings', 'plan_items',
    'service_requests', 'service_request_events', 'documents', 'photos', 'reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Staff names are effectively a company directory: a member is allowed to
-- know which B&M technician is coming to their house.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (role in ('admin', 'tech'));

-- A tech may see the profiles of members on properties they are assigned to.
create policy profiles_select_assigned_members on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'tech'
    and exists (
      select 1
      from public.members m
      join public.property_techs pt on pt.property_id = m.property_id
      where m.profile_id = public.profiles.id
        and pt.profile_id = auth.uid()
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Belt and braces: a user cannot promote themselves. Even though
-- profiles_update_self allows the row through, this trigger rejects any
-- role change that was not made by an admin.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin may change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------

create policy properties_select on public.properties
  for select to authenticated
  using (public.can_access_property(id));

create policy properties_admin_write on public.properties
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Techs may correct property details on their assigned properties, but may
-- not create or delete properties.
create policy properties_tech_update on public.properties
  for update to authenticated
  using (public.can_write_property(id))
  with check (public.can_write_property(id));

-- ---------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------

create policy members_select on public.members
  for select to authenticated
  using (public.can_access_property(property_id));

create policy members_admin_write on public.members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- property_techs — assignment table, admin-managed
-- ---------------------------------------------------------------------

create policy property_techs_select_self on public.property_techs
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy property_techs_admin_write on public.property_techs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- trade_partners — staff see the roster; a trade sees only itself
-- ---------------------------------------------------------------------

create policy trade_partners_select_staff on public.trade_partners
  for select to authenticated
  using (public.current_user_role() in ('admin', 'tech'));

create policy trade_partners_select_self on public.trade_partners
  for select to authenticated
  using (profile_id = auth.uid());

create policy trade_partners_admin_write on public.trade_partners
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Property-scoped tables: rooms, assets, visits, findings, plan_items,
-- documents, photos, reports
-- Read = anyone who can access the property (incl. the member).
-- Write = staff only (admin, or tech assigned to that property).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'rooms', 'assets', 'visits', 'findings', 'plan_items',
    'documents', 'photos', 'reports'
  ]
  loop
    execute format(
      'create policy %I_select on public.%I
         for select to authenticated
         using (public.can_access_property(property_id))', t, t);

    execute format(
      'create policy %I_staff_insert on public.%I
         for insert to authenticated
         with check (public.can_write_property(property_id))', t, t);

    execute format(
      'create policy %I_staff_update on public.%I
         for update to authenticated
         using (public.can_write_property(property_id))
         with check (public.can_write_property(property_id))', t, t);

    -- Deletes are admin-only: a tech should not be able to erase history.
    execute format(
      'create policy %I_admin_delete on public.%I
         for delete to authenticated
         using (public.is_admin())', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- checklist_items — scoped through the parent visit
-- ---------------------------------------------------------------------

create policy checklist_items_select on public.checklist_items
  for select to authenticated
  using (public.can_access_property(public.visit_property_id(visit_id)));

create policy checklist_items_staff_insert on public.checklist_items
  for insert to authenticated
  with check (public.can_write_property(public.visit_property_id(visit_id)));

create policy checklist_items_staff_update on public.checklist_items
  for update to authenticated
  using (public.can_write_property(public.visit_property_id(visit_id)))
  with check (public.can_write_property(public.visit_property_id(visit_id)));

create policy checklist_items_admin_delete on public.checklist_items
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- service_requests
-- Members may RAISE a request on their own property and may see their own.
-- Staff manage them. A trade partner sees only what was dispatched to them.
-- ---------------------------------------------------------------------

create policy service_requests_select on public.service_requests
  for select to authenticated
  using (
    public.can_access_property(property_id)
    or public.is_trade_for_request(id)
  );

-- A member can open a request, but only against their own property.
create policy service_requests_member_insert on public.service_requests
  for insert to authenticated
  with check (
    public.can_access_property(property_id)
    and (
      public.can_write_property(property_id)          -- staff
      or public.current_user_role() = 'member'        -- homeowner
    )
  );

create policy service_requests_staff_update on public.service_requests
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

-- A trade partner may move their own dispatched job along.
create policy service_requests_trade_update on public.service_requests
  for update to authenticated
  using (public.is_trade_for_request(id))
  with check (public.is_trade_for_request(id));

create policy service_requests_admin_delete on public.service_requests
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- service_request_events — stage history
-- ---------------------------------------------------------------------

create policy service_request_events_select on public.service_request_events
  for select to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (public.can_access_property(sr.property_id)
             or public.is_trade_for_request(sr.id))
    )
  );

create policy service_request_events_insert on public.service_request_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (public.can_write_property(sr.property_id)
             or public.is_trade_for_request(sr.id))
    )
  );

create policy service_request_events_admin_delete on public.service_request_events
  for delete to authenticated
  using (public.is_admin());

-- ####################################################################
-- ## 0003_storage.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0003 Storage buckets + policies
--
-- Two private buckets. Neither is public: every read goes through a signed
-- URL issued only after RLS has approved it.
--
-- Path convention (the first folder is ALWAYS the property id):
--   property-photos/<property_id>/<visit_id|misc>/<uuid>.jpg
--   property-docs/<property_id>/<uuid>-<filename>.pdf
--
-- That convention is what the policies below key on, so do not change it
-- without changing these policies too.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-photos', 'property-photos', false,
    10485760, -- 10 MB ceiling; the client compresses well below this (rule 4)
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'property-docs', 'property-docs', false,
    26214400, -- 25 MB
    array['application/pdf', 'image/jpeg', 'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
on conflict (id) do nothing;

-- Safely pull the property id out of a storage path. Returns null rather
-- than raising if the first path segment is not a uuid, which makes the
-- policies fail closed.
create or replace function public.storage_property_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  return first_segment::uuid;
exception when others then
  return null;
end;
$$;

-- --------------------------- reads -----------------------------------
create policy "hk property files are readable by that property's people"
  on storage.objects
  for select to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_access_property(public.storage_property_id(name))
  );

-- --------------------------- writes ----------------------------------
-- Only staff (admin, or the tech assigned to that property) may upload.
create policy "hk staff upload property files"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  );

create policy "hk staff update property files"
  on storage.objects
  for update to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  )
  with check (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  );

-- Deleting evidence is admin-only.
create policy "hk admins delete property files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.is_admin()
  );

-- ####################################################################
-- ## 0004_report_release.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0004 report review + release
--
-- A report is drafted automatically when a visit is completed, but the
-- member must not see it until an admin has read it and released it.
-- That review step is what keeps a half-finished report from going out
-- to a customer.
-- =====================================================================

create type public.report_status as enum ('DRAFT', 'IN_REVIEW', 'RELEASED');

alter table public.reports
  add column status public.report_status not null default 'DRAFT',
  add column released_at timestamptz,
  add column released_by uuid references public.profiles (id) on delete set null,
  add column headline_finding_id uuid references public.findings (id) on delete set null,
  add column admin_notes text;

create index reports_status_idx on public.reports (status);

-- Replace the blanket property-scoped select policy for reports with one
-- that hides unreleased drafts from members. Staff still see everything.
drop policy if exists reports_select on public.reports;

create policy reports_select on public.reports
  for select to authenticated
  using (
    public.can_access_property(property_id)
    and (
      -- staff see every report, at any stage
      public.can_write_property(property_id)
      -- members only ever see released ones
      or status = 'RELEASED'
    )
  );

-- Existing seeded reports predate the review step; treat them as released
-- so the demo member has something to look at.
update public.reports
   set status = 'RELEASED',
       released_at = generated_at
 where status = 'DRAFT';

-- ####################################################################
-- ## 0005_photo_capture.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0005 capture & scan
--
-- Photos become first-class: every photo can carry a note, can be typed
-- (a data plate vs a general shot vs before/after), and can hold the
-- result of a data-plate scan.
--
-- The scan result is stored separately from the asset record on purpose.
-- A scan is a *claim* read off a photo by a model; it only becomes part of
-- the Home Record when a human accepts it (scan_applied_at). That keeps a
-- misread serial number out of the record, and keeps the photo as the
-- evidence behind whatever is in there.
-- =====================================================================

create type public.photo_kind as enum (
  'GENERAL',
  'DATA_PLATE',   -- the placard/nameplate on a piece of equipment
  'DOCUMENT',     -- a page held up to the camera
  'BEFORE',
  'AFTER'
);

create type public.scan_status as enum (
  'NOT_REQUESTED',
  'PENDING',      -- queued; the phone may still be offline
  'DONE',
  'FAILED'
);

alter table public.photos
  add column kind            public.photo_kind  not null default 'GENERAL',
  add column note            text,
  add column scan_status     public.scan_status not null default 'NOT_REQUESTED',
  add column scan_data       jsonb,
  add column scan_error      text,
  add column scan_applied_at timestamptz,
  add column scan_applied_by uuid references public.profiles (id) on delete set null;

create index photos_scan_status_idx on public.photos (scan_status)
  where scan_status = 'PENDING';

create index photos_kind_idx on public.photos (kind);

comment on column public.photos.scan_data is
  'Fields read off a data plate by the vision model. A CLAIM, not a fact: '
  'it is not part of the Home Record until a human accepts it, which sets '
  'scan_applied_at.';

-- Photos are currently insert/update-able by staff only (policies in 0002
-- cover the whole property-scoped set), which is what we want here too:
-- a tech attaches and scans, a member reads.

-- ---------------------------------------------------------------------
-- Keep an asset's own record in step when a scan is accepted.
-- Only fills blanks; never silently overwrites something a human typed.
-- ---------------------------------------------------------------------
create or replace function public.apply_scan_to_asset(
  target_photo_id uuid,
  overwrite boolean default false
)
returns public.assets
language plpgsql
security invoker           -- runs as the caller, so RLS still applies
set search_path = public
as $$
declare
  photo   public.photos;
  data    jsonb;
  result  public.assets;
begin
  select * into photo from public.photos where id = target_photo_id;
  if photo is null then
    raise exception 'Photo not found';
  end if;
  if photo.asset_id is null then
    raise exception 'That photo is not attached to an item';
  end if;
  if photo.scan_data is null then
    raise exception 'That photo has no scan to apply';
  end if;

  data := photo.scan_data;

  update public.assets a
     set manufacturer = case
           when overwrite or a.manufacturer is null
           then coalesce(nullif(data ->> 'manufacturer', ''), a.manufacturer)
           else a.manufacturer end,
         model = case
           when overwrite or a.model is null
           then coalesce(nullif(data ->> 'model', ''), a.model)
           else a.model end,
         serial_number = case
           when overwrite or a.serial_number is null
           then coalesce(nullif(data ->> 'serial_number', ''), a.serial_number)
           else a.serial_number end,
         install_date = case
           when overwrite or a.install_date is null
           then coalesce((nullif(data ->> 'install_date', ''))::date, a.install_date)
           else a.install_date end
   where a.id = photo.asset_id
  returning * into result;

  update public.photos
     set scan_applied_at = now(),
         scan_applied_by = auth.uid()
   where id = target_photo_id;

  return result;
end;
$$;

-- ####################################################################
-- ## 0006_service_requests.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0006 request service, end to end
--
-- A member raises a request against a room and (where they know it) a
-- specific item in their Home Record. The office triages it, dispatches a
-- trade partner, and moves it along the stages in CLAUDE.md. When the work
-- is done, what was actually done flows back into the Home Record by
-- itself — that write-back is the whole point, because a service history
-- that depends on someone remembering to update it separately is a service
-- history that rots.
-- =====================================================================

alter table public.service_requests
  -- What and where
  add column category  text,
  add column room_id   uuid references public.rooms (id)  on delete set null,
  add column asset_id  uuid references public.assets (id) on delete set null,
  -- What was done, captured at completion and pushed to the asset
  add column work_performed       text,
  add column parts_used           text,
  add column completion_model     text,
  add column completion_serial    text,
  add column completion_condition public.asset_condition,
  add column completed_by         uuid references public.profiles (id) on delete set null,
  add column record_updated_at    timestamptz;

create index service_requests_asset_id_idx on public.service_requests (asset_id);
create index service_requests_room_id_idx  on public.service_requests (room_id);

comment on column public.service_requests.asset_id is
  'The Home Record item this request concerns, when the member or the office '
  'can identify one. Completion details are written back to it.';

-- ---------------------------------------------------------------------
-- Media on a request. Photos already carry nullable FKs per parent; add
-- one for requests, and a mime type so a video is distinguishable.
-- ---------------------------------------------------------------------
alter table public.photos
  add column service_request_id uuid references public.service_requests (id) on delete cascade,
  add column mime_type text;

create index photos_service_request_id_idx on public.photos (service_request_id);

-- Members attach video from a phone, so widen the bucket. The size ceiling
-- goes up for video; the client still compresses stills (rule 4).
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'video/mp4', 'video/quicktime', 'video/webm'
       ],
       file_size_limit = 104857600   -- 100 MB, for a short clip
 where id = 'property-photos';

-- ---------------------------------------------------------------------
-- A member may attach media to their OWN request.
--
-- Until now photo writes were staff-only. This opens exactly one door:
-- a member, on their own property, attaching media to a request that
-- belongs to that property. They still cannot touch anything else.
-- ---------------------------------------------------------------------
create policy photos_member_insert_on_own_request on public.photos
  for insert to authenticated
  with check (
    public.current_user_role() = 'member'
    and public.can_access_property(property_id)
    and service_request_id is not null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and sr.property_id = photos.property_id
    )
  );

-- The matching storage rule. Member uploads are confined to the
-- <property_id>/requests/ prefix so they cannot write over a tech's
-- visit photos.
create policy "hk members upload request media"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and public.current_user_role() = 'member'
    and public.can_access_property(public.storage_property_id(name))
    and split_part(name, '/', 2) = 'requests'
  );

-- ---------------------------------------------------------------------
-- Completion → Home Record.
--
-- Called when the office closes out the work. It records what was done,
-- updates the linked item, carries the request's media across to that item
-- so the photos live with the equipment, and advances the stage to
-- HOME RECORD UPDATED.
--
-- security invoker: RLS still applies, so only staff on that property can
-- run it.
-- ---------------------------------------------------------------------
create or replace function public.complete_service_request(
  target_request_id uuid,
  p_work_performed  text,
  p_parts_used      text default null,
  p_model           text default null,
  p_serial          text default null,
  p_condition       public.asset_condition default null,
  p_actor           uuid default null
)
returns public.service_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  req      public.service_requests;
  actor    uuid := coalesce(p_actor, auth.uid());
  done_at  timestamptz := now();
  result   public.service_requests;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'Service request not found';
  end if;
  if coalesce(btrim(p_work_performed), '') = '' then
    raise exception 'Say what work was done before closing this out';
  end if;

  update public.service_requests
     set work_performed       = p_work_performed,
         parts_used           = p_parts_used,
         completion_model     = p_model,
         completion_serial    = p_serial,
         completion_condition = p_condition,
         completed_by         = actor,
         completed_at         = coalesce(completed_at, done_at),
         stage                = 'COMPLETED'
   where id = target_request_id;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (target_request_id, req.stage, 'COMPLETED', p_work_performed, actor);

  -- Write back to the Home Record, when we know which item this was about.
  if req.asset_id is not null then
    update public.assets a
       set last_serviced_at = done_at::date,
           condition        = coalesce(p_condition, a.condition),
           -- Only fill a blank; a human-entered model is not overwritten by
           -- a number typed in a hurry at the end of a job.
           model            = case when a.model is null
                                   then nullif(btrim(coalesce(p_model, '')), '')
                                   else a.model end,
           serial_number    = case when a.serial_number is null
                                   then nullif(btrim(coalesce(p_serial, '')), '')
                                   else a.serial_number end,
           notes            = btrim(
                                coalesce(a.notes || E'\n\n', '') ||
                                to_char(done_at, 'Mon DD, YYYY') || ': ' || p_work_performed ||
                                case when coalesce(btrim(p_parts_used), '') <> ''
                                     then ' Parts: ' || p_parts_used else '' end
                              )
     where a.id = req.asset_id;

    -- The photos taken on the job belong with the equipment from now on.
    update public.photos
       set asset_id = req.asset_id
     where service_request_id = target_request_id
       and asset_id is null;
  end if;

  update public.service_requests
     set stage             = 'HOME_RECORD_UPDATED',
         record_updated_at = done_at
   where id = target_request_id
  returning * into result;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    target_request_id, 'COMPLETED', 'HOME_RECORD_UPDATED',
    case when req.asset_id is null
         then 'No linked item — nothing to update in the Home Record.'
         else 'Home Record updated from the completed work.' end,
    actor
  );

  return result;
end;
$$;

-- ####################################################################
-- ## 0007_security_hardening.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0007 security hardening
--
-- Fixes found by the audit in SECURITY-REVIEW.md. Run this before any real
-- customer data goes in.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CRITICAL — privilege escalation through signup metadata.
--
-- handle_new_user trusted `raw_user_meta_data->>'role'`. That field is set
-- by whoever calls the signup endpoint, so anyone holding the (public,
-- by-design) anon key could call
--
--     supabase.auth.signUp({ email, password,
--                            options: { data: { role: 'admin' } } })
--
-- and land an admin profile — which reads every property. Verified
-- exploitable against a local build of this schema.
--
-- The fix: a new user is ALWAYS a member. Roles are granted afterwards by
-- an admin, which prevent_role_escalation already restricts.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deliberately ignores any role supplied in user metadata: that value is
  -- attacker-controlled. Least privilege on the way in; an admin promotes
  -- from the profiles table afterwards.
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'member',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates the profile for a new auth user. Always role=member — never trust '
  'a role from signup metadata, it is client-supplied.';

-- ---------------------------------------------------------------------
-- MEDIUM — a member could forge fields on a request they submit.
--
-- The insert policy checked the property but not the columns, so a member
-- could POST a row already marked APPROVED, with an estimate, a trade
-- partner and a completion write-up. No cross-property leak, but it puts
-- false history in the office's board.
--
-- Staff inserts are untouched.
-- ---------------------------------------------------------------------
create or replace function public.force_member_request_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'member' then
    new.stage                := 'NEW';
    new.estimate_amount      := null;
    new.approved_at          := null;
    new.scheduled_for        := null;
    new.completed_at         := null;
    new.closed_at            := null;
    new.trade_partner_id     := null;
    new.assigned_tech_id     := null;
    new.work_performed       := null;
    new.parts_used           := null;
    new.completion_model     := null;
    new.completion_serial    := null;
    new.completion_condition := null;
    new.completed_by         := null;
    new.record_updated_at    := null;
    -- The request is theirs, whatever they claimed.
    new.created_by           := auth.uid();
  end if;
  return new;
end;
$$;

create trigger service_requests_member_defaults
  before insert on public.service_requests
  for each row execute function public.force_member_request_defaults();

-- ---------------------------------------------------------------------
-- BUG — a member-raised request had no history.
--
-- The events policy is staff/trade only (correct: a member must not be able
-- to write their own stage history). But the app tried to insert the opening
-- "Submitted through the member portal" event as the member, which RLS
-- silently refused, leaving the member's own timeline empty.
--
-- The opening event is now written by the database itself, so it is always
-- present and never forgeable.
-- ---------------------------------------------------------------------
create or replace function public.log_service_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    new.id,
    null,
    new.stage,
    case when public.current_user_role() = 'member'
         then 'Submitted through the member portal.'
         else 'Raised by the office.' end,
    auth.uid()
  );
  return new;
end;
$$;

create trigger service_requests_log_created
  after insert on public.service_requests
  for each row execute function public.log_service_request_created();

-- ---------------------------------------------------------------------
-- HARDENING — pin search_path on the two remaining functions that lacked
-- it. Neither is SECURITY DEFINER so the risk was low, but a function
-- without a pinned search_path is a loose end in a security review.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.storage_property_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  return first_segment::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Follow-on from the above.
--
-- Making handle_new_user always create a member means the seed (and any
-- admin setting up staff accounts from the SQL editor) must be able to set
-- a role. prevent_role_escalation was blocking that, because a SQL-editor
-- session has no auth.uid() and therefore is not "an admin".
--
-- A null auth.uid() means the statement is NOT an end-user request: it is a
-- migration, the SQL editor, or a service-role job — all of which already
-- bypass RLS entirely, so this trigger was never the control protecting
-- them. Every request that comes through the app carries a uid, and those
-- still have to be an admin.
-- ---------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null      -- a real signed-in request
     and not public.is_admin()
  then
    raise exception 'Only an admin may change a user role';
  end if;
  return new;
end;
$$;

-- ####################################################################
-- ## 0008_member_approval.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0008 member approves or declines an estimate
--
-- Members are read-only on service_requests by design (the staff update
-- policy is the only one), and that stays true. This adds exactly one
-- narrow, audited door instead of widening that policy:
--
--   a member may move THEIR OWN request from AWAITING APPROVAL to APPROVED,
--   or send it back to TRIAGE with a decline note. Nothing else.
--
-- SECURITY DEFINER because the update policy rightly refuses members. Every
-- precondition is re-checked inside, so the elevated privilege cannot be
-- used for anything but this one transition.
-- =====================================================================

create or replace function public.member_respond_to_estimate(
  target_request_id uuid,
  p_approve         boolean,
  p_note            text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req    public.service_requests;
  uid    uuid := auth.uid();
  result public.service_requests;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  -- The caller must be a member OF THIS PROPERTY. Checked directly against
  -- the members table rather than trusting anything passed in.
  if not exists (
    select 1 from public.members m
     where m.property_id = req.property_id
       and m.profile_id = uid
  ) then
    raise exception 'Not your request';
  end if;

  -- Staff have their own controls; this door is for members only, so a
  -- compromised staff session gains nothing here.
  if public.current_user_role() <> 'member' then
    raise exception 'This is the member approval route';
  end if;

  -- Only ever from the one stage where the ball is genuinely with them.
  if req.stage <> 'AWAITING_APPROVAL' then
    raise exception 'This request is not waiting on your approval';
  end if;

  if p_approve then
    update public.service_requests
       set stage = 'APPROVED',
           approved_at = now()
     where id = target_request_id
    returning * into result;

    insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
    values (target_request_id, 'AWAITING_APPROVAL', 'APPROVED',
            coalesce(nullif(btrim(p_note), ''), 'Approved by the homeowner.'), uid);
  else
    -- Back to the office to talk it through. The stage list has no
    -- "declined", and inventing one would put the pipeline out of step with
    -- the brief, so a decline returns it to TRIAGE with the reason attached.
    update public.service_requests
       set stage = 'TRIAGE',
           approved_at = null
     where id = target_request_id
    returning * into result;

    insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
    values (target_request_id, 'AWAITING_APPROVAL', 'TRIAGE',
            'Homeowner declined the estimate'
              || case when coalesce(btrim(p_note), '') <> ''
                      then ': ' || p_note else '.' end,
            uid);
  end if;

  return result;
end;
$$;

comment on function public.member_respond_to_estimate is
  'The only route by which a member may change a request stage. Confined to '
  'AWAITING APPROVAL -> APPROVED or -> TRIAGE, on their own property.';

-- ####################################################################
-- ## 0009_report_attachments.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0009 files attached to a report
--
-- The office needs to put files into a quarterly review: a trade partner's
-- service sheet, an inspection certificate, a manufacturer's bulletin, or a
-- PDF written elsewhere that belongs with that quarter's report.
--
-- Documents already carry property_id and an optional asset_id; this adds
-- an optional report_id alongside them. No new policy is needed — the
-- existing document rules are property-scoped (staff write, anyone on the
-- property reads), and a report attachment is just a document that also
-- names a report.
--
-- Storage path convention for these:
--   property-docs/<property_id>/reports/<report_id>/<uuid>-<filename>
-- which the existing storage policies already cover, because they key on
-- the property id being the first path segment.
-- =====================================================================

alter table public.documents
  add column report_id uuid references public.reports (id) on delete set null;

create index documents_report_id_idx on public.documents (report_id);

comment on column public.documents.report_id is
  'Set when this file belongs with a particular report. A member sees it '
  'only once that report is released, because the report page itself is '
  'what surfaces it.';

-- ---------------------------------------------------------------------
-- A file attached to a DRAFT report must not reach the member early.
--
-- Documents are property-scoped, so without this a member would see a
-- report attachment in their Documents list the moment it was uploaded —
-- before anyone had reviewed the report it belongs to. That defeats the
-- review step added in 0004.
--
-- Staff still see everything. A document not tied to a report is unchanged.
-- ---------------------------------------------------------------------
drop policy if exists documents_select on public.documents;

create policy documents_select on public.documents
  for select to authenticated
  using (
    public.can_access_property(property_id)
    and (
      public.can_write_property(property_id)       -- staff: everything
      or report_id is null                          -- not a report attachment
      or exists (                                   -- or its report is out
        select 1 from public.reports r
        where r.id = documents.report_id
          and r.status = 'RELEASED'
      )
    )
  );

-- ####################################################################
-- ## 0010_membership_tiers.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0010 membership tiers
--
-- Two tiers, from the Master Program Specification §4–§6:
--   CORE     $69/mo, $759 prepaid
--   RESPONSE $299/mo, $3,289 prepaid
--
-- The tier must GATE the product, and gating it only in the UI would be
-- the same mistake rule 2 exists to prevent: a Core member who guessed a
-- report URL would read a quarterly report they never paid for. So the
-- gate lives in RLS, and the UI merely agrees with it.
-- =====================================================================

create type public.membership_tier as enum ('CORE', 'RESPONSE');
create type public.billing_cycle   as enum ('MONTHLY', 'ANNUAL_PREPAID');

alter table public.properties
  add column tier                     public.membership_tier not null default 'CORE',
  add column billing_cycle            public.billing_cycle   not null default 'MONTHLY',
  -- §4: both tiers carry a 12-month initial commitment.
  add column commitment_start         date,
  add column commitment_months        integer not null default 12,
  -- §50: the member-pricing benefit is capped per membership year, so the
  -- running total has to live somewhere.
  add column member_discount_used_ytd numeric(10,2) not null default 0,
  add column member_discount_year_start date;

create index properties_tier_idx on public.properties (tier);

comment on column public.properties.tier is
  'CORE or RESPONSE. Gates quarterly visits, quarterly reports, the Hub and '
  'urgent help. Enforced in RLS, not only in the UI.';

comment on column public.properties.member_discount_used_ytd is
  'Member pricing given this membership year, against the tier cap (§50).';

-- The demo property advertises quarterly visits and quarterly reports, so
-- it is a Response home. plan_tier was free text and is now display-only.
update public.properties set tier = 'RESPONSE', billing_cycle = 'ANNUAL_PREPAID'
 where plan_tier is not null;

update public.properties
   set commitment_start = coalesce(member_since, current_date),
       member_discount_year_start = coalesce(member_since, current_date)
 where commitment_start is null;

-- ---------------------------------------------------------------------
-- Does this property's tier include a feature?
--
-- Deliberately mirrors lib/membership.ts. Only the features that actually
-- gate data need to exist here.
-- ---------------------------------------------------------------------
create or replace function public.property_has_feature(
  target_property_id uuid,
  feature text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when feature in ('quarterly_reports', 'quarterly_visits', 'hub',
                     'urgent_help', 'managed_services', 'expanded_baseline')
    then exists (
      select 1 from public.properties p
       where p.id = target_property_id and p.tier = 'RESPONSE'
    )
    else exists (select 1 from public.properties p where p.id = target_property_id)
  end
$$;

-- ---------------------------------------------------------------------
-- Quarterly reports are Response-only (§4, §37).
--
-- Staff still see every report on a property they can write to. A member
-- sees a released report unless it is a quarterly one on a Core home.
-- Annual reports remain available to both tiers.
-- ---------------------------------------------------------------------
drop policy if exists reports_select on public.reports;

create policy reports_select on public.reports
  for select to authenticated
  using (
    public.can_access_property(property_id)
    and (
      public.can_write_property(property_id)      -- staff: everything
      or (
        status = 'RELEASED'
        and (
          report_type <> 'VISIT_SUMMARY'          -- annual, passport, etc.
          or public.property_has_feature(property_id, 'quarterly_reports')
        )
      )
    )
  );


-- ####################################################################
-- ## seed.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — demo seed: "The Miller Home"
--
-- DEMO DATA AND DEMO LOGINS ONLY. Do not run this against production.
-- The three logins below share a well-known password that is published in
-- the repo; they exist so you can click through the app on your phone.
--
--   admin@bmhomekeeper.test   HomeKeeper!2026   (Garrette Becker, owner)
--   tech@bmhomekeeper.test    HomeKeeper!2026   (Dave Reinhart, technician)
--   member@bmhomekeeper.test  HomeKeeper!2026   (Sarah Miller, homeowner)
--
-- Re-runnable: every insert is keyed on a fixed uuid and upserts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Auth users
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'admin@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Garrette Becker","role":"admin"}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'tech@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Dave Reinhart","role":"tech"}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'member@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Sarah Miller","role":"member"}'::jsonb,
   '', '', '', '')
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_user_meta_data = excluded.raw_user_meta_data;

-- Email identities, so password sign-in works.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  ('a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002',
   '{"sub":"a0000000-0000-4000-8000-000000000002","email":"tech@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003',
   '{"sub":"a0000000-0000-4000-8000-000000000003","email":"member@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now())
on conflict (id) do nothing;

-- Profiles (the trigger creates these; this makes the values explicit).
insert into public.profiles (id, role, full_name, email, phone)
values
  ('a0000000-0000-4000-8000-000000000001', 'admin',  'Garrette Becker', 'admin@bmhomekeeper.test',  '(717) 555-0101'),
  ('a0000000-0000-4000-8000-000000000002', 'tech',   'Dave Reinhart',   'tech@bmhomekeeper.test',   '(717) 555-0102'),
  ('a0000000-0000-4000-8000-000000000003', 'member', 'Sarah Miller',    'member@bmhomekeeper.test', '(717) 555-0103')
on conflict (id) do update
  set role = excluded.role,
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone;

-- ---------------------------------------------------------------------
-- 2. The property
-- ---------------------------------------------------------------------
-- The demo home is a RESPONSE member: it is what we show on a sales call,
-- so it has to exercise quarterly visits and quarterly reports, which
-- migration 0010 gates behind that tier.
insert into public.properties (
  id, name, address_line1, city, state, postal_code,
  year_built, square_feet, bedrooms, bathrooms, lot_size_acres,
  plan_tier, member_since, notes,
  tier, billing_cycle, commitment_start, commitment_months,
  member_discount_used_ytd, member_discount_year_start
)
values (
  'b0000000-0000-4000-8000-000000000001',
  'The Miller Home', '123 Maple Ave', 'Lancaster', 'PA', '17601',
  1998, 2400, 4, 2.5, 0.31,
  'HomeKeeper Response', '2024-03-01',
  'Two-story colonial, original owners until 2019. Vinyl siding, architectural shingle roof replaced 2016. Municipal water and sewer, natural gas.',
  'RESPONSE', 'ANNUAL_PREPAID', '2024-03-01', 12,
  0, '2026-03-01'
)
on conflict (id) do update
  set name = excluded.name,
      year_built = excluded.year_built,
      square_feet = excluded.square_feet,
      bathrooms = excluded.bathrooms,
      notes = excluded.notes,
      plan_tier = excluded.plan_tier,
      tier = excluded.tier,
      billing_cycle = excluded.billing_cycle,
      commitment_start = excluded.commitment_start,
      member_discount_year_start = excluded.member_discount_year_start;

-- Homeowners
insert into public.members (id, property_id, profile_id, first_name, last_name, email, phone, is_primary, relationship)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'Sarah', 'Miller', 'member@bmhomekeeper.test', '(717) 555-0103', true, 'Owner'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   null, 'Tom', 'Miller', 'tom.miller@example.com', '(717) 555-0104', false, 'Spouse')
on conflict (id) do nothing;

-- Assign Dave to the Miller property.
insert into public.property_techs (property_id, profile_id)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Rooms
-- ---------------------------------------------------------------------
insert into public.rooms (id, property_id, name, room_type, floor, sort_order, notes) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Kitchen',          'Kitchen',   'Main',     10, 'Remodeled 2021 by B&M. Quartz counters, soft-close cabinetry.'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Primary Bathroom', 'Bathroom',  'Upper',    20, 'Full gut remodel 2022 by B&M. Onyx shower system.'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Hall Bathroom',    'Bathroom',  'Upper',    30, 'Original 1998 tub/shower, refreshed fixtures 2023.'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Powder Room',      'Bathroom',  'Main',     40, 'Half bath off the front hall.'),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Primary Bedroom',  'Bedroom',   'Upper',    50, null),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'Bedroom 2',        'Bedroom',   'Upper',    60, null),
  ('d0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'Bedroom 3',        'Bedroom',   'Upper',    70, null),
  ('d0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'Living Room',      'Living',    'Main',     80, null),
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'Dining Room',      'Dining',    'Main',     90, null),
  ('d0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'Laundry Room',     'Utility',   'Main',    100, 'Off the garage entry.'),
  ('d0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'Basement',         'Basement',  'Lower',   110, 'Unfinished, poured concrete. Mechanicals live here.'),
  ('d0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001', 'Garage',           'Garage',    'Main',    120, 'Two-car attached.'),
  ('d0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000001', 'Attic',            'Attic',     'Attic',   130, 'Blown-in insulation, pull-down stair access.'),
  ('d0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-000000000001', 'Exterior',         'Exterior',  'Exterior',140, 'Siding, roof, gutters, grounds, deck.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Assets — the Home Record (32 items)
-- ---------------------------------------------------------------------
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model, serial_number,
  finish, install_date, warranty_expires, expected_life_years, condition,
  last_serviced_at, location_notes, notes
) values
  -- Plumbing fixtures
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Plumbing Fixture', 'Kitchen Faucet', 'Delta', 'Trinsic 9159-AR-DST', 'DL-9159-114277',
   'Arctic Stainless', '2021-06-18', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Kitchen sink, island run', 'Delta lifetime limited warranty on finish and function. Pull-down magnetic docking spray.'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Faucet — Left Vanity', 'Delta', 'Trinsic 559LF-SS', 'DL-559-208841',
   'Stainless', '2022-04-02', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Left basin, double vanity', 'Matched pair with right vanity.'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Faucet — Right Vanity', 'Delta', 'Trinsic 559LF-SS', 'DL-559-208842',
   'Stainless', '2022-04-02', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Right basin, double vanity', 'Matched pair with left vanity.'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Shower Valve & Trim', 'Delta', 'Trinsic T17T259-SS TempAssure 17T', 'DL-17T-556120',
   'Stainless', '2022-04-02', '2099-12-31', 20, 'GOOD', '2026-04-14',
   'Primary shower', 'Thermostatic valve with integrated volume control.'),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Shower System', 'Onyx Shower Base & Surround', 'Onyx Collection', 'Custom 60x36 Base + 3-Panel Surround', 'ONX-2022-04117',
   'Bone / Matrix pattern', '2022-04-02', '2037-04-02', 30, 'GOOD', '2026-09-08',
   'Primary bathroom', 'Cast-to-order onyx. 15-year manufacturer warranty. Clean with non-abrasive only — no bleach or scouring pads.'),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Toilet', 'Kohler', 'Cimarron K-31641', 'KH-31641-77120',
   'White', '2022-04-02', '2023-04-02', 25, 'GOOD', null,
   'Primary bathroom', 'Comfort height, 1.28 gpf.'),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
   'Plumbing Fixture', 'Hall Bath Tub/Shower Valve', 'Moen', 'Posi-Temp 82910', 'MN-82910-331904',
   'Chrome', '2023-05-11', '2099-12-31', 20, 'GOOD', null,
   'Hall bathroom', 'Trim replaced 2023, original 1998 valve body retained.'),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
   'Plumbing Fixture', 'Hall Bath Toilet', 'American Standard', 'Cadet 3 215AA.104', 'AS-215-904471',
   'White', '2019-08-20', null, 25, 'FAIR', null,
   'Hall bathroom', 'Flapper replaced 2025. Running intermittently — see findings.'),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
   'Plumbing Fixture', 'Powder Room Toilet', 'Kohler', 'Wellworth K-3987', 'KH-3987-22841',
   'White', '1998-05-01', null, 25, 'FAIR', null,
   'Powder room', 'Original to the house. Nearing end of expected service life.'),
  ('e0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
   'Plumbing Fixture', 'Powder Room Faucet', 'Delta', 'Trinsic 559LF-BL', 'DL-559-771203',
   'Matte Black', '2023-05-11', '2099-12-31', 15, 'GOOD', null,
   'Powder room', null),
  -- Water / mechanical
  ('e0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Water Heater', 'Gas Water Heater — 50 gal', 'Bradford White', 'RG250T6N', 'BW-RG250-FE4471928',
   null, '2019-11-07', '2025-11-07', 12, 'FAIR', '2026-09-08',
   'Basement, northeast corner', '50 gallon atmospheric vent, natural gas. Anode rod never replaced — flagged in the Home Plan.'),
  ('e0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'HVAC', 'Gas Furnace', 'Carrier', 'Infinity 59TN6A080V17--14', 'CR-59TN-4218H09412',
   null, '2014-10-02', '2024-10-02', 20, 'GOOD', '2026-09-08',
   'Basement mechanical area', '80,000 BTU, 96% AFUE two-stage. Filter size 16x25x5.'),
  ('e0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'HVAC', 'A/C Condenser — 3 ton', 'Carrier', '24ANB136A003', 'CR-24ANB-3814W22087',
   null, '2014-10-02', '2024-10-02', 15, 'FAIR', '2026-04-14',
   'Exterior, east side pad', 'R-410A. Refrigerant charge verified spring 2026.'),
  ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'HVAC', 'Whole-House Humidifier', 'Aprilaire', '700M', 'AP-700-1190338',
   null, '2014-10-02', null, 15, 'GOOD', '2026-09-08',
   'Mounted on furnace supply plenum', 'Water panel changed each fall visit.'),
  ('e0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008',
   'HVAC', 'Smart Thermostat', 'ecobee', 'Smart Thermostat Premium EB-STATE6', 'EB-STATE6-1192840',
   null, '2023-02-14', '2026-02-14', 10, 'GOOD', null,
   'Living room, interior wall', 'Wired with C-wire. Remote sensor in primary bedroom.'),
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Electrical', 'Main Electrical Panel — 200A', 'Square D', 'QO140M200 Homeline 200A', 'SQ-QO140-9928471',
   null, '1998-05-01', null, 40, 'GOOD', '2026-04-14',
   'Basement, south wall', '200 amp service, 40 space. Six open breaker positions. AFCI added to bedroom circuits 2021.'),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Sump Pump', 'Zoeller', 'M53 Mighty-Mate 1/3 HP', 'ZL-M53-772019',
   null, '2021-03-22', '2024-03-22', 10, 'GOOD', '2026-04-14',
   'Basement, northwest pit', 'Cast iron 1/3 HP. No battery backup — see Home Plan.'),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Water Softener', 'Culligan', 'HE Twin 1.5', 'CU-HET-4429183',
   null, '2020-07-15', '2025-07-15', 15, 'GOOD', '2026-09-08',
   'Basement, beside water entry', 'Salt level checked each visit.'),
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Main Water Shutoff', null, 'Ball valve, 1 in.', null,
   null, '1998-05-01', null, 40, 'GOOD', null,
   'Basement, north wall where service enters', 'IMPORTANT: this is the valve to close in a plumbing emergency. Turns clockwise.'),
  -- Kitchen appliances
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Dishwasher', 'Bosch', '800 Series SHPM88Z75N', 'BS-SHPM-FD9812774',
   'Stainless', '2021-06-18', '2023-06-18', 12, 'GOOD', null,
   'Kitchen, left of sink', 'CrystalDry. Third rack.'),
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Refrigerator', 'GE', 'Profile PVD28BYNFS', 'GE-PVD28-RA912847',
   'Fingerprint Resistant Stainless', '2021-06-18', '2022-06-18', 14, 'GOOD', null,
   'Kitchen, north wall', '27.9 cu ft French door. Water line to icemaker has a shutoff behind the unit.'),
  ('e0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Gas Range', 'Bosch', '800 Series HGI8056UC', 'BS-HGI8-FD9814402',
   'Stainless', '2021-06-18', '2022-06-18', 15, 'GOOD', null,
   'Kitchen, island-adjacent', '30 in. slide-in gas, convection.'),
  ('e0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Range Hood', 'Broan', 'Glacier BCSD130SS', 'BR-BCSD-8871204',
   'Stainless', '2021-06-18', '2022-06-18', 15, 'GOOD', '2026-09-08',
   'Above range', 'Ducted to exterior through the north wall. 400 CFM.'),
  ('e0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Garbage Disposal', 'InSinkErator', 'Evolution Compact 3/4 HP', 'IS-EVC-5529913',
   null, '2021-06-18', '2025-06-18', 12, 'GOOD', null,
   'Under kitchen sink', null),
  ('e0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a',
   'Appliance', 'Clothes Washer', 'LG', 'WM4000HWA', 'LG-WM40-812SN04471',
   'White', '2022-09-30', '2023-09-30', 12, 'GOOD', null,
   'Laundry room', 'Front load. Braided stainless supply hoses installed at the same time.'),
  ('e0000000-0000-4000-8000-00000000001a', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a',
   'Appliance', 'Clothes Dryer', 'LG', 'DLEX4000W', 'LG-DLEX-812SN04512',
   'White', '2022-09-30', '2023-09-30', 13, 'GOOD', '2026-09-08',
   'Laundry room', 'Electric. Vent run cleaned at each fall visit.'),
  -- Structure / envelope
  ('e0000000-0000-4000-8000-00000000001b', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Roof', 'Architectural Shingle Roof', 'Owens Corning', 'Duration Storm — Estate Gray', null,
   'Estate Gray', '2016-08-15', '2046-08-15', 30, 'GOOD', '2026-09-08',
   'Whole house', 'SureNail technology. Transferable limited lifetime warranty — paperwork in Documents.'),
  ('e0000000-0000-4000-8000-00000000001c', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Vinyl Siding', 'CertainTeed', 'Monogram D4 — Sandstone Beige', null,
   'Sandstone Beige', '1998-05-01', null, 40, 'GOOD', null,
   'Whole house', null),
  ('e0000000-0000-4000-8000-00000000001d', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Gutters & Downspouts', null, '5 in. K-style seamless aluminum', null,
   'White', '2016-08-15', null, 25, 'FAIR', '2026-09-08',
   'Whole house perimeter', 'No gutter guards. Heavy maple leaf load in fall — see findings.'),
  ('e0000000-0000-4000-8000-00000000001e', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Windows', 'Double-Hung Windows (18)', 'Andersen', '400 Series Tilt-Wash', null,
   'White', '1998-05-01', null, 30, 'FAIR', null,
   'Whole house', '18 units. Several with failed seals — see findings.'),
  ('e0000000-0000-4000-8000-00000000001f', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Doors', 'Front Entry Door', 'Therma-Tru', 'Smooth-Star S200', null,
   'Hunter Green', '2016-08-15', '2031-08-15', 30, 'GOOD', null,
   'Front entry', 'Fiberglass with half-lite. Weatherstrip replaced 2024.'),
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c',
   'Garage', 'Garage Door Opener', 'LiftMaster', '87504-267 Secure View', 'LM-87504-771029384',
   null, '2023-11-04', '2028-11-04', 15, 'GOOD', '2026-09-08',
   'Garage ceiling', 'Belt drive, battery backup, camera. Photo-eye sensors tested each visit.')
on conflict (id) do nothing;

-- Two more to round out the record
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model, serial_number,
  install_date, expected_life_years, condition, last_serviced_at, location_notes, notes
) values
  ('e0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c',
   'Garage', 'Sectional Garage Door', 'Clopay', 'Gallery Collection GD2LU', null,
   '2016-08-15', 25, 'GOOD', '2026-09-08', 'Two-car opening', 'Insulated steel, R-9. Springs inspected each fall.'),
  ('e0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Rear Deck', null, 'Pressure-treated pine, 12x16', null,
   '2005-06-01', 20, 'POOR', '2026-09-08', 'Off the dining room slider',
   'Original structure sound; decking and rail weathered. Replacement is the headline Home Plan item.')
on conflict (id) do nothing;

-- Smoke / CO detectors tracked as one asset group
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model,
  install_date, expected_life_years, condition, last_serviced_at, location_notes, notes
) values
  ('e0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000001', null,
   'Life Safety', 'Smoke & CO Detectors (7)', 'Kidde', '21031373 Hardwired w/ Battery Backup',
   '2021-03-15', 10, 'GOOD', '2026-09-08', 'Each bedroom, both hallways, basement stair',
   'Hardwired and interconnected. Batteries changed each fall visit. Replace whole units 2031.'),
  ('e0000000-0000-4000-8000-000000000024', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Whole-House Water Shutoff Valve — Exterior Sillcocks (3)', 'Woodford', 'Model 17 Frost-Free',
   '1998-05-01', 30, 'GOOD', '2026-09-08', 'Front, rear, and garage side',
   'Frost-free hose bibbs. Must disconnect hoses each fall or they will split.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. Trade partners
-- ---------------------------------------------------------------------
insert into public.trade_partners (id, company_name, trade, contact_name, email, phone, license_number, notes) values
  ('f0000000-0000-4000-8000-000000000001', 'Keystone Comfort Heating & Air', 'HVAC', 'Mike Kreider',
   'dispatch@keystonecomfort.example', '(717) 555-0210', 'PA-HVAC-88213', 'Preferred HVAC partner. Same-day for members.'),
  ('f0000000-0000-4000-8000-000000000002', 'Susquehanna Plumbing Co.', 'Plumbing', 'Ray Hoover',
   'office@susqplumbing.example', '(717) 555-0222', 'PA-PLB-44190', 'Water heater and repipe work.'),
  ('f0000000-0000-4000-8000-000000000003', 'Lancaster Electric Works', 'Electrical', 'Janelle Stoltzfus',
   'service@lancelectric.example', '(717) 555-0233', 'PA-ELE-71204', 'Panel work and generator installs.'),
  ('f0000000-0000-4000-8000-000000000004', 'Conestoga Roofing & Exteriors', 'Roofing', 'Bud Martin',
   'estimates@conestogaroof.example', '(717) 555-0244', 'PA-154880', 'Gutter guards, roof repair.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Visits (2 completed)
-- ---------------------------------------------------------------------
insert into public.visits (
  id, property_id, tech_id, visit_type, status, scheduled_for,
  started_at, completed_at, title, summary, member_notes
) values
  ('11110000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'SEASONAL', 'COMPLETED',
   '2026-04-14 09:00:00-04', '2026-04-14 09:04:00-04', '2026-04-14 11:22:00-04',
   'Spring 2026 Seasonal Visit',
   'Full spring walkthrough. A/C started and verified, sump pump tested, exterior sillcocks opened, gutters checked. Two items raised for the Home Plan: deck decking is weathering badly and the hall bath toilet is running. Everything else in good order.',
   'Sarah asked about adding a battery backup to the sump pump before storm season. Quoted verbally, added to plan.'),
  ('11110000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'SEASONAL', 'COMPLETED',
   '2026-09-08 13:00:00-04', '2026-09-08 13:02:00-04', '2026-09-08 15:41:00-04',
   'Fall 2026 Seasonal Visit',
   'Heating season prep. Furnace filter and humidifier water panel replaced, dryer vent cleaned, detector batteries changed, garage door springs and photo-eyes checked, hoses disconnected from sillcocks. Water heater is showing its age — anode rod has never been serviced and there is light corrosion at the top fittings. Recommended replacement planning within 18 months.',
   'Tom mentioned the powder room toilet runs occasionally. Confirmed, logged as MONITOR.')
on conflict (id) do nothing;

-- Checklist items for the spring visit
insert into public.checklist_items (visit_id, category, label, result, notes, sort_order) values
  ('11110000-0000-4000-8000-000000000001', 'HVAC',      'Start and test A/C condenser',                'PASS',      'Cooling 18 deg delta-T. Charge good.', 10),
  ('11110000-0000-4000-8000-000000000001', 'HVAC',      'Replace furnace filter (16x25x5)',            'PASS',      null, 20),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Test sump pump float and discharge',          'PASS',      'Cycled three times. Discharge clear.', 30),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Open and test exterior sillcocks',            'PASS',      'All three, no leaks.', 40),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Check all toilets for running / leaks',       'ATTENTION', 'Hall bath flapper leaking by.', 50),
  ('11110000-0000-4000-8000-000000000001', 'Electrical','Panel inspection — thermal check',            'PASS',      'No hot spots. Six spare positions.', 60),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Gutter and downspout inspection',             'ATTENTION', 'Heavy maple debris, no guards.', 70),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Deck structure and surface inspection',       'FAIL',      'Decking cupped and splitting. Structure sound.', 80),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Roof visual from ground and ladder',          'PASS',      'No lifted shingles. Flashing intact.', 90),
  ('11110000-0000-4000-8000-000000000001', 'Appliance', 'Dishwasher and disposal operation check',     'PASS',      null, 100)
on conflict do nothing;

-- Checklist items for the fall visit
insert into public.checklist_items (visit_id, category, label, result, notes, sort_order) values
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Furnace start-up and combustion check',       'PASS',      'Clean ignition, no error codes.', 10),
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Replace humidifier water panel',              'PASS',      'Aprilaire 35 panel.', 20),
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Replace furnace filter (16x25x5)',            'PASS',      null, 30),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Water heater inspection',                     'ATTENTION', 'Light corrosion at top fittings. Anode never serviced.', 40),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Disconnect hoses from sillcocks',             'PASS',      'All three.', 50),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Water softener salt level',                   'PASS',      'Filled to two-thirds.', 60),
  ('11110000-0000-4000-8000-000000000002', 'Life Safety','Test smoke/CO detectors, change batteries',  'PASS',      'All 7 sounded and interconnected.', 70),
  ('11110000-0000-4000-8000-000000000002', 'Appliance', 'Clean dryer vent run',                        'PASS',      'Moderate lint. Run is 14 ft.', 80),
  ('11110000-0000-4000-8000-000000000002', 'Garage',    'Garage door springs, rollers, photo-eyes',    'PASS',      'Reversed correctly on obstruction.', 90),
  ('11110000-0000-4000-8000-000000000002', 'Exterior',  'Clean gutters for leaf season',               'ATTENTION', 'Cleaned. Guards strongly recommended.', 100)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. Findings — 12 across all five statuses
-- ---------------------------------------------------------------------
insert into public.findings (
  id, property_id, visit_id, room_id, asset_id, status, title, description,
  recommendation, priority, estimated_cost_low, estimated_cost_high, created_by, created_at
) values
  -- ACTION (red) x2
  ('22220000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-00000000000b',
   'ACTION', 'Water heater corrosion at top fittings',
   'Light rust staining visible at the cold inlet and hot outlet nipples. Unit is a 2019 Bradford White RG250T6N, now 7 years old, and the anode rod has never been pulled or replaced. Tank is still holding and there is no active leak.',
   'Plan replacement within 12-18 months rather than waiting for a failure in a finished basement. In the meantime, flush the tank and pull the anode rod to assess. Susquehanna Plumbing quoted a like-for-like swap.',
   'HIGH', 1850.00, 2400.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:05:00-04'),
  ('22220000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-000000000022',
   'ACTION', 'Deck decking and railing failing',
   'Pressure-treated decking from 2005 is cupped, splitting, and has several soft boards near the stair. Two railing balusters are loose. The framing, posts, and ledger are still sound and properly flashed.',
   'Re-deck over the existing frame with composite and replace the railing system. This is the headline item on the Home Plan for spring 2027.',
   'HIGH', 9500.00, 13500.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:40:00-04'),
  -- PLAN (amber) x2
  ('22220000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001d',
   'PLAN', 'No gutter guards — heavy leaf load',
   'Three mature silver maples overhang the rear and east elevations. Gutters filled twice between visits this year. Overflow is already staining the siding below the rear corner.',
   'Install micro-mesh gutter guards on the full perimeter. Conestoga Roofing can do this with the spring visit.',
   'MEDIUM', 1400.00, 2100.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:15:00-04'),
  ('22220000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-000000000011',
   'PLAN', 'Sump pump has no battery backup',
   'Single 1/3 HP Zoeller on a standard outlet. The basement sits below the water table during heavy spring rain and a power outage during a storm would leave the pit unprotected.',
   'Add a battery backup pump with its own float and alarm. Sarah asked about this directly at the spring visit.',
   'MEDIUM', 850.00, 1250.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 09:50:00-04'),
  -- MONITOR (blue) x3
  ('22220000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000008',
   'MONITOR', 'Hall bath toilet running intermittently',
   'Flapper is leaking by and the tank refills every few hours. Flapper was already replaced once in 2025, so the issue is likely the flush valve seat rather than the flapper itself.',
   'Replace the flush valve assembly at the next visit. Low cost, no urgency, but it is wasting water.',
   'LOW', 145.00, 260.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:05:00-04'),
  ('22220000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000009',
   'MONITOR', 'Powder room toilet is original to the house',
   'Kohler Wellworth installed at build in 1998, now 28 years old and past typical service life. Tom reports it runs occasionally. Bowl and tank are intact with no visible cracks or weeping at the base.',
   'No action needed yet. Watch for weeping at the closet flange. Budget a replacement in the next two to three years.',
   'LOW', 450.00, 700.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:30:00-04'),
  ('22220000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001e',
   'MONITOR', 'Failed window seals — 3 of 18 units',
   'Visible fogging between panes in the two dining room units and one bedroom 3 unit. Andersen 400 Series from 1998. The remaining 15 units are clear.',
   'Insulated glass units can be replaced individually without replacing the whole window. Monitor for additional failures and do them as a batch when it reaches five or six.',
   'LOW', 1200.00, 1900.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 15:05:00-04'),
  -- GOOD (green) x3
  ('22220000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-00000000000c',
   'GOOD', 'Furnace operating well for its age',
   'Carrier Infinity two-stage, 12 years old. Clean ignition on both stages, no error history in the control, heat exchanger visually clear, combustion looked correct. Filter and humidifier panel replaced at this visit.',
   'Stay on the twice-yearly service rhythm. Expect another 6-8 years of service life.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 13:35:00-04'),
  ('22220000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001b',
   'GOOD', 'Roof in excellent condition',
   'Owens Corning Duration Storm from 2016, 10 years into a 30-year expectation. No lifted or missing shingles, granule loss normal for age, step and valley flashing intact, boots and vent collars sound.',
   'Nothing needed. Re-inspect each fall.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:50:00-04'),
  ('22220000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005',
   'GOOD', 'Onyx shower system performing as new',
   'Four years in. No crazing, staining, or seam separation. Caulk joint at the base is intact and flexible. Delta TempAssure valve holding temperature correctly.',
   'Keep using non-abrasive cleaner only. No bleach, no scouring pads — that is what voids the finish warranty.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:20:00-04'),
  -- IMPROVEMENT (purple) x2
  ('22220000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000d', null,
   'IMPROVEMENT', 'Attic insulation could be topped up',
   'Blown-in cellulose measures roughly R-30 across the attic floor, which met code in 1998. Current recommendation for this climate zone is R-49 to R-60. Several spots near the eaves are thin where the baffles stop.',
   'Adding 6-8 inches would cut winter heating cost noticeably and is inexpensive while the attic is otherwise empty. Good candidate to pair with the spring visit.',
   'LOW', 1900.00, 2800.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 15:20:00-04'),
  ('22220000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-000000000010',
   'IMPROVEMENT', 'Panel has capacity for a generator interlock',
   'Square D 200A panel has six open positions and the service is sized with room to spare. A manual transfer interlock kit plus an inlet would let the Millers run the furnace, sump, fridge, and lights off a portable generator.',
   'Worth considering given the sump pump exposure during storm outages. Lancaster Electric Works quoted informally.',
   'LOW', 1600.00, 2400.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 11:00:00-04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. The Home Plan
-- ---------------------------------------------------------------------
insert into public.plan_items (
  id, property_id, finding_id, title, description, category,
  target_year, target_season, priority, status,
  estimated_cost_low, estimated_cost_high, sort_order
) values
  ('33330000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000004',
   'Add sump pump battery backup', 'Battery backup pump with independent float and high-water alarm. Protects the basement during storm outages.',
   'Plumbing', 2026, 'Fall', 'HIGH', 'APPROVED', 850.00, 1250.00, 10),
  ('33330000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000003',
   'Install gutter guards, full perimeter', 'Micro-mesh guards to stop the twice-a-year cleanout and the overflow staining on the rear elevation.',
   'Exterior', 2027, 'Spring', 'MEDIUM', 'PROPOSED', 1400.00, 2100.00, 20),
  ('33330000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000002',
   'Re-deck and re-rail rear deck', 'Composite decking and new railing over the existing frame. Structure, posts, and ledger stay.',
   'Exterior', 2027, 'Spring', 'HIGH', 'PROPOSED', 9500.00, 13500.00, 30),
  ('33330000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000001',
   'Replace water heater', 'Like-for-like 50 gal Bradford White before the current unit fails in a finished basement.',
   'Plumbing', 2027, 'Fall', 'HIGH', 'PROPOSED', 1850.00, 2400.00, 40),
  ('33330000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-00000000000b',
   'Top up attic insulation to R-49', 'Add 6-8 inches of blown-in cellulose and correct the thin spots at the eaves.',
   'Energy', 2027, 'Fall', 'MEDIUM', 'PROPOSED', 1900.00, 2800.00, 50),
  ('33330000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-00000000000c',
   'Generator interlock and inlet', 'Manual transfer interlock on the Square D panel plus exterior inlet for a portable generator.',
   'Electrical', 2028, 'Spring', 'LOW', 'PROPOSED', 1600.00, 2400.00, 60),
  ('33330000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000006',
   'Replace powder room toilet', 'Original 1998 Kohler Wellworth. Replace before it starts weeping at the flange.',
   'Plumbing', 2028, 'Spring', 'LOW', 'PROPOSED', 450.00, 700.00, 70)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9. Service requests (2, at different stages)
-- ---------------------------------------------------------------------
insert into public.service_requests (
  id, property_id, member_id, created_by, trade_partner_id, assigned_tech_id,
  stage, title, description, priority, estimate_amount,
  approved_at, scheduled_for, created_at
) values
  ('44440000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'SCHEDULED', 'Sump pump battery backup install',
   'Approved off the spring visit recommendation. Susquehanna Plumbing to supply and install a battery backup pump with high-water alarm.',
   'HIGH', 1095.00,
   '2026-09-12 10:15:00-04', '2026-10-02 08:00:00-04', '2026-09-09 08:12:00-04'),
  ('44440000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   null, null,
   'TRIAGE', 'Kitchen disposal humming but not spinning',
   'Submitted by Sarah through the member portal: "The disposal under the kitchen sink makes a humming noise when I flip the switch but nothing turns. It has not worked since Thursday."',
   'MEDIUM', null,
   null, null, '2026-09-18 19:44:00-04')
on conflict (id) do nothing;

-- Stage history for both requests
insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id, created_at) values
  ('44440000-0000-4000-8000-000000000001', null, 'NEW', 'Member approved the spring visit recommendation.', 'a0000000-0000-4000-8000-000000000003', '2026-09-09 08:12:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'NEW', 'TRIAGE', 'Confirmed scope against the spring finding.', 'a0000000-0000-4000-8000-000000000001', '2026-09-09 09:30:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'TRIAGE', 'DISPATCHED', 'Sent to Susquehanna Plumbing.', 'a0000000-0000-4000-8000-000000000001', '2026-09-09 09:35:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'DISPATCHED', 'ACCEPTED', 'Ray confirmed availability.', 'a0000000-0000-4000-8000-000000000001', '2026-09-10 07:50:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'ACCEPTED', 'ESTIMATING', 'Site photos sent for quote.', 'a0000000-0000-4000-8000-000000000002', '2026-09-10 11:20:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'ESTIMATING', 'AWAITING_APPROVAL', 'Quote of $1,095 sent to member.', 'a0000000-0000-4000-8000-000000000001', '2026-09-11 16:05:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'AWAITING_APPROVAL', 'APPROVED', 'Sarah approved by text.', 'a0000000-0000-4000-8000-000000000001', '2026-09-12 10:15:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'APPROVED', 'SCHEDULED', 'Booked for Oct 2, 8am. Dave to meet the crew.', 'a0000000-0000-4000-8000-000000000001', '2026-09-12 10:22:00-04'),
  ('44440000-0000-4000-8000-000000000002', null, 'NEW', 'Submitted through the member portal.', 'a0000000-0000-4000-8000-000000000003', '2026-09-18 19:44:00-04'),
  ('44440000-0000-4000-8000-000000000002', 'NEW', 'TRIAGE', 'Likely a jammed impeller. Dave to check on the next visit or sooner if needed.', 'a0000000-0000-4000-8000-000000000001', '2026-09-19 08:05:00-04')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10. Documents and reports
-- ---------------------------------------------------------------------
insert into public.documents (id, property_id, asset_id, title, doc_type, storage_path, mime_type, uploaded_by) values
  ('55550000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000001b',
   'Owens Corning roof warranty certificate', 'WARRANTY',
   'b0000000-0000-4000-8000-000000000001/demo/roof-warranty.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005',
   'Onyx Collection care and warranty guide', 'WARRANTY',
   'b0000000-0000-4000-8000-000000000001/demo/onyx-care-guide.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000000c',
   'Carrier Infinity furnace owner manual', 'MANUAL',
   'b0000000-0000-4000-8000-000000000001/demo/carrier-59tn6a-manual.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', null,
   '2022 primary bath remodel — final invoice', 'INVOICE',
   'b0000000-0000-4000-8000-000000000001/demo/2022-bath-remodel-invoice.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', null,
   'Township permit — 2021 kitchen remodel', 'PERMIT',
   'b0000000-0000-4000-8000-000000000001/demo/2021-kitchen-permit.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- status is set explicitly: migration 0004's backfill runs before this seed,
-- so a report inserted here would otherwise stay DRAFT and be invisible to
-- the demo member.
insert into public.reports (id, property_id, visit_id, title, report_type, period_start, period_end, storage_path, generated_by, generated_at, status, released_at) values
  ('66660000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001',
   'Spring 2026 Visit Summary', 'VISIT_SUMMARY', '2026-04-14', '2026-04-14',
   'b0000000-0000-4000-8000-000000000001/demo/spring-2026-visit.pdf', 'a0000000-0000-4000-8000-000000000001', '2026-04-14 16:00:00-04', 'RELEASED', '2026-04-14 16:00:00-04'),
  ('66660000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000002',
   'Fall 2026 Visit Summary', 'VISIT_SUMMARY', '2026-09-08', '2026-09-08',
   'b0000000-0000-4000-8000-000000000001/demo/fall-2026-visit.pdf', 'a0000000-0000-4000-8000-000000000001', '2026-09-08 18:30:00-04', 'RELEASED', '2026-09-08 18:30:00-04')
on conflict (id) do nothing;
