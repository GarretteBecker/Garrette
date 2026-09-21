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
-- ## 0011_plan_to_request.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0011 the Home Plan becomes actionable
--
-- The Home Plan told a member what we recommend and roughly what it costs,
-- and then stopped. There was no way to say yes to any of it.
--
-- The member's button is "Get me a price", not "Approve": a plan item
-- carries a RANGE, and approving a range is not an approval — it is an
-- argument about the final invoice, deferred. So the button opens an
-- ordinary service request, pre-filled from the recommendation, and the
-- existing pipeline takes it from there: we price it firmly, they approve
-- that firm number with their member discount on it, we book it, we do it.
--
-- No new permission is opened. A member could already raise a request on
-- their own property, and force_member_request_defaults() already strips
-- anything they should not be setting.
-- =====================================================================

alter table public.service_requests
  add column finding_id   uuid references public.findings (id)   on delete set null,
  add column plan_item_id uuid references public.plan_items (id) on delete set null;

create index service_requests_finding_id_idx   on public.service_requests (finding_id);
create index service_requests_plan_item_id_idx on public.service_requests (plan_item_id);

comment on column public.service_requests.finding_id is
  'Set when this job came off the Home Plan. Completing the job resolves the '
  'finding, so the plan does not keep recommending work that is already done.';

-- ---------------------------------------------------------------------
-- A link must not cross a property boundary.
--
-- RLS already confines the request itself to the caller's own property, but
-- nothing stopped a hand-crafted insert naming another property's finding.
-- Nobody could READ that finding, so this is integrity rather than a leak —
-- but a request captioned with someone else's finding on our board is its
-- own kind of harm, and rule 2 says the database settles this, not the form.
-- ---------------------------------------------------------------------
create or replace function public.enforce_request_links_same_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finding_id is not null
     and not exists (
       select 1 from public.findings f
        where f.id = new.finding_id and f.property_id = new.property_id
     ) then
    raise exception 'finding % is not on property %', new.finding_id, new.property_id;
  end if;

  if new.plan_item_id is not null
     and not exists (
       select 1 from public.plan_items p
        where p.id = new.plan_item_id and p.property_id = new.property_id
     ) then
    raise exception 'plan item % is not on property %', new.plan_item_id, new.property_id;
  end if;

  return new;
end;
$$;

create trigger service_requests_links_same_property
  before insert or update of finding_id, plan_item_id, property_id
  on public.service_requests
  for each row execute function public.enforce_request_links_same_property();

-- ---------------------------------------------------------------------
-- The plan item follows its job.
--
-- Driven by a trigger rather than by each code path that moves a stage, so
-- the Home Plan cannot drift out of step with reality just because a stage
-- was changed somewhere we forgot to update. Same reasoning as completion
-- writing back to the Home Record.
-- ---------------------------------------------------------------------
create or replace function public.sync_plan_item_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped public.plan_item_status;
begin
  if new.plan_item_id is null then
    return new;
  end if;

  mapped := case new.stage
    when 'APPROVED'            then 'APPROVED'
    when 'SCHEDULED'           then 'SCHEDULED'
    when 'IN_PROGRESS'         then 'SCHEDULED'
    when 'COMPLETED'           then 'DONE'
    when 'HOME_RECORD_UPDATED' then 'DONE'
    when 'CLOSED'              then 'DONE'
    else null
  end;

  if mapped is not null then
    update public.plan_items
       set status = mapped, updated_at = now()
     where id = new.plan_item_id
       and status <> mapped;
  end if;

  return new;
end;
$$;

create trigger service_requests_sync_plan_item
  after insert or update of stage on public.service_requests
  for each row execute function public.sync_plan_item_from_request();

-- ---------------------------------------------------------------------
-- Completing plan work closes the finding that asked for it.
--
-- Without this the Home Plan would go on recommending a repair the member
-- has already paid for — the single most embarrassing thing this product
-- could do to them.
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
  actor   uuid := coalesce(p_actor, auth.uid());
  done_at timestamptz := now();
  req     public.service_requests;
  result  public.service_requests;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'service request % not found', target_request_id;
  end if;

  if coalesce(btrim(p_work_performed), '') = '' then
    raise exception 'work performed is required to complete a job';
  end if;

  update public.service_requests
     set stage                = 'COMPLETED',
         work_performed       = p_work_performed,
         parts_used           = p_parts_used,
         completion_model     = p_model,
         completion_serial    = p_serial,
         completion_condition = p_condition,
         completed_at         = done_at,
         completed_by         = actor
   where id = target_request_id;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (target_request_id, req.stage, 'COMPLETED', 'Work completed and written up.', actor);

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

  -- The plan told them this needed doing; it is done.
  if req.finding_id is not null then
    update public.findings
       set resolved_at = done_at,
           updated_at  = done_at
     where id = req.finding_id
       and resolved_at is null;
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
-- ## 0012_membership_agreements.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0012 membership agreements and the disclosures
--                       Pennsylvania requires
--
-- ⚠ NOT LEGAL ADVICE. This migration builds the MECHANISM — storing the
--   agreement, showing the terms, honouring a cancellation, tracking that
--   a renewal notice went out. The WORDING of every disclosure, and
--   whether a HomeKeeper membership is a "home improvement contract" at
--   all, must be settled by a Pennsylvania attorney. See
--   docs/pa-compliance.md for what was verified and what was not.
--
-- Two requirements are handled here, and they are not equally certain:
--
--   1. THE THREE-BUSINESS-DAY RIGHT TO CANCEL. Verified: Pennsylvania's
--      Home Improvement Consumer Protection Act (73 P.S. § 517.1 et seq.)
--      gives a homeowner three business days from signing to rescind, the
--      contract must SAY so, and a contract that does not conform is
--      unenforceable against the homeowner. B&M is a registered PA home
--      improvement contractor (#154223), so this is built to actually
--      work from the member's phone, not merely be described.
--
--   2. THE RENEWAL NOTICE. NOT verified as currently required. The spec
--      asks for a notice 10–20 days before renewal; Pennsylvania's own
--      automatic-renewal statute appears to be narrow (health clubs and
--      similar), with broader bills proposed but not enacted. The window
--      is therefore stored per agreement rather than hard-coded, so it
--      can be set to whatever counsel says — including "we do it anyway,
--      because a member who is surprised by a renewal is a member lost".
-- =====================================================================

create type public.agreement_status as enum (
  'PENDING_SIGNATURE',
  'ACTIVE',
  'RESCINDED',   -- cancelled inside the three-business-day window
  'CANCELLED',   -- ended later, by either side
  'EXPIRED',
  'SUPERSEDED'   -- replaced by a renewal agreement
);

create type public.notice_method as enum ('EMAIL', 'MAIL', 'SMS', 'IN_PERSON');

-- ---------------------------------------------------------------------
-- Business days.
--
-- ⚠ Weekends only. Pennsylvania legal holidays are NOT accounted for,
-- because that needs a maintained holiday table and getting it subtly
-- wrong is worse than not claiming it. The app therefore shows the
-- deadline as the EARLIEST it could be; where a holiday falls inside the
-- window the member has longer, never less. Erring toward the member is
-- the safe direction for a consumer-protection deadline.
-- ---------------------------------------------------------------------
create or replace function public.add_business_days(start_date date, n integer)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  d date := start_date;
  left_to_add integer := n;
begin
  while left_to_add > 0 loop
    d := d + 1;
    -- 6 = Saturday, 0 = Sunday
    if extract(dow from d) not in (0, 6) then
      left_to_add := left_to_add - 1;
    end if;
  end loop;
  return d;
end;
$$;

comment on function public.add_business_days is
  'Weekends only — PA legal holidays are deliberately not modelled. See '
  'docs/pa-compliance.md.';

-- ---------------------------------------------------------------------
-- The agreement itself.
--
-- Prices are copied in rather than read from the tier, because what the
-- member agreed to is a fact about that day. Putting the price up later
-- must never rewrite what somebody signed.
-- ---------------------------------------------------------------------
create table public.membership_agreements (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,

  tier                public.membership_tier not null,
  billing_cycle       public.billing_cycle   not null,
  price_monthly       numeric(10,2),
  price_annual        numeric(10,2),
  commitment_months   integer not null default 12,

  signed_at           timestamptz,
  signed_by_name      text,
  term_start          date not null,
  term_end            date not null,

  auto_renew          boolean not null default true,
  -- How many days before term_end we tell them it is about to renew.
  -- Two numbers, not one, because the spec asks for a window.
  renewal_notice_days_before_max integer not null default 20,
  renewal_notice_days_before_min integer not null default 10,
  renewal_notice_sent_at         timestamptz,
  renewal_notice_method          public.notice_method,
  renewal_notice_by              uuid references public.profiles (id) on delete set null,

  -- The statutory cancellation right. Stored, not computed on the fly, so
  -- the deadline a member was shown is the deadline they get.
  rescission_deadline date,
  rescinded_at        timestamptz,

  cancelled_at        timestamptz,
  cancellation_reason text,

  -- The signed document, as an ordinary Document so it also appears in the
  -- member's own Documents list. "Where is my contract?" should have an
  -- obvious answer.
  document_id         uuid references public.documents (id) on delete set null,

  status              public.agreement_status not null default 'PENDING_SIGNATURE',
  notes               text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index membership_agreements_property_id_idx on public.membership_agreements (property_id);
create index membership_agreements_status_idx      on public.membership_agreements (status);
create index membership_agreements_term_end_idx    on public.membership_agreements (term_end);

create trigger membership_agreements_updated_at
  before update on public.membership_agreements
  for each row execute function public.set_updated_at();

comment on table public.membership_agreements is
  'One row per signed membership term. Renewing writes a NEW row and marks '
  'the old one SUPERSEDED, so the history of what was agreed survives.';

comment on column public.membership_agreements.rescission_deadline is
  'End of the third business day after signing (PA HICPA). Weekends only — '
  'holidays are not modelled, so this is the earliest the right can end.';

-- ---------------------------------------------------------------------
-- The deadline is set by the database, from the signing date.
--
-- Not by the form: a three-business-day statutory right that depends on
-- whoever filled in the screen doing the arithmetic correctly is not a
-- right, it is a hope.
-- ---------------------------------------------------------------------
create or replace function public.set_agreement_rescission_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.signed_at is not null then
    new.rescission_deadline := public.add_business_days((new.signed_at at time zone 'America/New_York')::date, 3);
  else
    new.rescission_deadline := null;
  end if;
  return new;
end;
$$;

create trigger membership_agreements_rescission_deadline
  before insert or update of signed_at on public.membership_agreements
  for each row execute function public.set_agreement_rescission_deadline();

-- ---------------------------------------------------------------------
-- RLS. A member reads their own agreement and may exercise the
-- cancellation right through the function below — nothing else.
-- ---------------------------------------------------------------------
alter table public.membership_agreements enable row level security;
alter table public.membership_agreements force row level security;

create policy membership_agreements_select on public.membership_agreements
  for select to authenticated
  using (public.can_access_property(property_id));

create policy membership_agreements_staff_insert on public.membership_agreements
  for insert to authenticated
  with check (public.can_write_property(property_id));

create policy membership_agreements_staff_update on public.membership_agreements
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

create policy membership_agreements_admin_delete on public.membership_agreements
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- The member cancels, inside the window.
--
-- A statutory right that requires ringing the office during business
-- hours is a right with a handbrake on it. This is the same narrow
-- SECURITY DEFINER pattern as estimate approval: it re-checks the caller,
-- the property and the deadline, and it will not act outside the window.
-- ---------------------------------------------------------------------
create or replace function public.member_rescind_agreement(
  target_agreement_id uuid,
  p_reason text default null
)
returns public.membership_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  ag     public.membership_agreements;
  result public.membership_agreements;
  today  date := (now() at time zone 'America/New_York')::date;
begin
  select * into ag from public.membership_agreements where id = target_agreement_id;
  if not found then
    raise exception 'agreement not found';
  end if;

  if not public.can_access_property(ag.property_id) then
    raise exception 'not your agreement';
  end if;

  if public.current_user_role() <> 'member' then
    raise exception 'only the homeowner can use this route';
  end if;

  if ag.status not in ('PENDING_SIGNATURE', 'ACTIVE') then
    raise exception 'this agreement is already %', lower(ag.status::text);
  end if;

  if ag.rescission_deadline is null then
    raise exception 'this agreement has not been signed yet';
  end if;

  -- Inclusive: the right runs to the END of the third business day.
  if today > ag.rescission_deadline then
    raise exception 'the three-business-day window closed on %', ag.rescission_deadline;
  end if;

  update public.membership_agreements
     set status              = 'RESCINDED',
         rescinded_at        = now(),
         cancellation_reason = p_reason
   where id = target_agreement_id
  returning * into result;

  return result;
end;
$$;

comment on function public.member_rescind_agreement is
  'PA HICPA three-business-day right to rescind, exercised by the homeowner '
  'from their own phone. Refuses outside the window and for anyone else.';

-- ---------------------------------------------------------------------
-- Which agreements need a renewal notice today?
--
-- A view so the office has one place to look, and so "did we send it?"
-- has an answer that is not somebody's memory.
-- ---------------------------------------------------------------------
create or replace view public.renewal_notices_due
with (security_invoker = true) as
  select
    a.id,
    a.property_id,
    p.name as property_name,
    a.term_end,
    a.renewal_notice_days_before_max,
    a.renewal_notice_days_before_min,
    a.term_end - (now() at time zone 'America/New_York')::date as days_until_renewal,
    a.renewal_notice_sent_at
  from public.membership_agreements a
  join public.properties p on p.id = a.property_id
  where a.status = 'ACTIVE'
    and a.auto_renew
    and a.renewal_notice_sent_at is null
    and (now() at time zone 'America/New_York')::date
        >= a.term_end - a.renewal_notice_days_before_max
  order by a.term_end;

comment on view public.renewal_notices_due is
  'ACTIVE auto-renewing agreements inside the notice window with nothing '
  'sent yet. Stays listed after the window closes rather than disappearing '
  'quietly — a missed notice is the thing you most need to see.';


-- ####################################################################
-- ## 0013_home_facts_and_safety.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0013 the facts about the house, and where the
--                       shutoffs are
--
-- The Home Record knew everything about the water heater and almost
-- nothing about the HOUSE. No water source, no sewer type, no service
-- size — and, worst of all, nowhere to record where the main water
-- shutoff is or what it looks like.
--
-- That last one is the whole point. A member standing in two inches of
-- water at 11pm does not need an article about plumbing; they need to be
-- told that their shutoff is in the basement behind the furnace, with a
-- photograph of it. This migration is what makes that possible.
--
-- ⚠ SAFETY. Everything here is reference information captured by a
-- technician on a visit. It is not a substitute for 911, the gas company
-- or an electrician, and the app says so. See docs/emergency-help.md.
--
-- ⚠ CLAUDE.md rule 3 still holds: there is deliberately NO field here for
-- an alarm code, a gate code, a key location or a safe combination. A
-- shutoff location is not a security credential — it is a valve anyone
-- standing in the room can see. A key location is, so it stays out.
-- =====================================================================

create type public.water_source  as enum ('PUBLIC', 'WELL', 'SHARED_WELL', 'OTHER');
create type public.sewer_type    as enum ('PUBLIC', 'SEPTIC', 'MOUND', 'OTHER');
create type public.heating_fuel  as enum ('NATURAL_GAS', 'PROPANE', 'OIL', 'ELECTRIC', 'HEAT_PUMP', 'OTHER');

alter table public.properties
  add column construction_type      text,
  add column exterior_material      text,
  add column roof_material          text,
  add column roof_installed_year    integer,
  add column water_source           public.water_source,
  add column sewer_type             public.sewer_type,
  add column heating_fuel           public.heating_fuel,
  add column electrical_service_amps integer,
  add column stories                numeric(2,1),
  add column basement_type          text;

comment on column public.properties.water_source is
  'Public or well. Changes the emergency advice: a well home loses water '
  'pressure when the power goes out, a public home does not.';

comment on column public.properties.sewer_type is
  'Public or septic. A septic home with a backup needs different advice '
  'and a different trade than a home on a municipal line.';

-- ---------------------------------------------------------------------
-- Safety points: the things you need to find in a hurry.
--
-- A typed table rather than free-text assets, because the emergency
-- screen has to ask a precise question — "where is the WATER MAIN on
-- this property" — and get a reliable answer. A row named "Main Water
-- Shutoff" in a list of 36 assets cannot be looked up; this can.
-- ---------------------------------------------------------------------
create type public.safety_point_kind as enum (
  'WATER_MAIN',          -- the whole-house water shutoff
  'WATER_HEATER_SHUTOFF',
  'GAS_MAIN',
  'OIL_TANK_SHUTOFF',
  'PROPANE_TANK_SHUTOFF',  -- the valve on the tank, outdoors
  'ELECTRICAL_PANEL',    -- main panel / main breaker
  'SUB_PANEL',
  'SUMP_PUMP',
  'MAIN_CLEANOUT',       -- drain access for a backup
  'SEPTIC_ACCESS',
  'WELL_PUMP',
  'FLOOR_DRAIN',
  'OUTSIDE_SPIGOT_SHUTOFF',
  'SMOKE_CO_ALARM',
  'FIRE_EXTINGUISHER',
  'OTHER'
);

create table public.safety_points (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  kind          public.safety_point_kind not null,
  -- What to call it on screen. Blank falls back to a label for the kind.
  label         text,
  room_id       uuid references public.rooms (id)  on delete set null,
  asset_id      uuid references public.assets (id) on delete set null,
  -- "Basement, northeast corner, behind the furnace." Written for somebody
  -- who is frightened and holding a torch.
  location_note text,
  -- "Turn the red handle a quarter turn clockwise until it stops."
  how_to_note   text,
  photo_id      uuid references public.photos (id) on delete set null,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index safety_points_property_id_idx on public.safety_points (property_id);
create index safety_points_kind_idx        on public.safety_points (property_id, kind);

create trigger safety_points_set_updated_at
  before update on public.safety_points
  for each row execute function public.set_updated_at();

comment on table public.safety_points is
  'Shutoffs, panels and access points, captured on a visit so a member can '
  'be told where theirs is when it matters. Reference information only — '
  'never a substitute for 911 or the utility.';

-- A linked room, asset or photo must belong to the same property. Same
-- reasoning as migration 0011: RLS stops anyone READING across a property
-- boundary, but a row captioned with another house's room is its own harm.
create or replace function public.enforce_safety_point_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.property_id = new.property_id
  ) then
    raise exception 'room % is not on property %', new.room_id, new.property_id;
  end if;

  if new.asset_id is not null and not exists (
    select 1 from public.assets a where a.id = new.asset_id and a.property_id = new.property_id
  ) then
    raise exception 'asset % is not on property %', new.asset_id, new.property_id;
  end if;

  if new.photo_id is not null and not exists (
    select 1 from public.photos p where p.id = new.photo_id and p.property_id = new.property_id
  ) then
    raise exception 'photo % is not on property %', new.photo_id, new.property_id;
  end if;

  return new;
end;
$$;

create trigger safety_points_links_same_property
  before insert or update of room_id, asset_id, photo_id, property_id
  on public.safety_points
  for each row execute function public.enforce_safety_point_links();

-- ---------------------------------------------------------------------
-- RLS. Read by anyone who can see the property — INCLUDING the member,
-- on every tier.
--
-- The tier gates priority response, not safety information. Withholding
-- "here is where your water shutoff is" from a paying member because they
-- are on the cheaper plan is not a business model, it is a liability. See
-- docs/emergency-help.md.
-- ---------------------------------------------------------------------
alter table public.safety_points enable row level security;
alter table public.safety_points force row level security;

create policy safety_points_select on public.safety_points
  for select to authenticated
  using (public.can_access_property(property_id));

create policy safety_points_staff_insert on public.safety_points
  for insert to authenticated
  with check (public.can_write_property(property_id));

create policy safety_points_staff_update on public.safety_points
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

create policy safety_points_admin_delete on public.safety_points
  for delete to authenticated
  using (public.is_admin());


-- ####################################################################
-- ## 0014_warranty_watch.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0014 warranty watch
--
-- The app has stored a warranty expiry date on every Home Record item
-- since day one and never once used it. That is money sitting on the
-- floor: a member whose water heater fails ten weeks after the warranty
-- quietly lapsed paid for a tank they did not have to.
--
-- So: tell them before it ends. "Your water heater's warranty ends in 60
-- days — want us to look at it while it is still covered?" That message
-- costs nothing to send, can save a member two thousand dollars, and is
-- the most concrete possible answer to "what am I paying you for?"
--
-- This migration adds the RECORD of having told them. The dates were
-- already there; what was missing was memory — so the app does not nag a
-- member who has already said no, and the office can see who has been
-- spoken to and who has not.
-- =====================================================================

create type public.warranty_response as enum (
  'PENDING',   -- we have told them, they have not said
  'WANTS',     -- they asked us to look at it
  'DECLINED'   -- they said no thanks; stop asking about this one
);

create table public.warranty_notices (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties (id) on delete cascade,
  asset_id           uuid not null references public.assets (id) on delete cascade,

  -- The date we actually warned about, not a live lookup. If the expiry is
  -- later corrected, this still records what the member was told and when —
  -- and a genuinely new warranty period gets its own notice rather than
  -- being silenced by an old one.
  warranty_expires   date not null,

  notified_at        timestamptz,
  notified_method    public.notice_method,
  notified_by        uuid references public.profiles (id) on delete set null,

  response           public.warranty_response not null default 'PENDING',
  responded_at       timestamptz,
  service_request_id uuid references public.service_requests (id) on delete set null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- One notice per item per warranty period.
  unique (asset_id, warranty_expires)
);

create index warranty_notices_property_id_idx on public.warranty_notices (property_id);
create index warranty_notices_asset_id_idx    on public.warranty_notices (asset_id);

create trigger warranty_notices_set_updated_at
  before update on public.warranty_notices
  for each row execute function public.set_updated_at();

comment on table public.warranty_notices is
  'Memory for warranty watch: who we told, when, and what they said. Without '
  'it the app would either nag a member who already declined or forget it '
  'ever spoke to them.';

-- The asset must be on the same property. Same reasoning as 0011 and 0013.
create or replace function public.enforce_warranty_notice_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.assets a
     where a.id = new.asset_id and a.property_id = new.property_id
  ) then
    raise exception 'asset % is not on property %', new.asset_id, new.property_id;
  end if;
  return new;
end;
$$;

create trigger warranty_notices_links_same_property
  before insert or update of asset_id, property_id on public.warranty_notices
  for each row execute function public.enforce_warranty_notice_links();

-- ---------------------------------------------------------------------
-- RLS. A member reads their own and may decline through the function
-- below; everything else is staff.
-- ---------------------------------------------------------------------
alter table public.warranty_notices enable row level security;
alter table public.warranty_notices force row level security;

create policy warranty_notices_select on public.warranty_notices
  for select to authenticated
  using (public.can_access_property(property_id));

create policy warranty_notices_staff_insert on public.warranty_notices
  for insert to authenticated
  with check (public.can_write_property(property_id));

create policy warranty_notices_staff_update on public.warranty_notices
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

create policy warranty_notices_admin_delete on public.warranty_notices
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- "No thanks."
--
-- A member saying no must actually stop the asking, and must not need a
-- phone call to do it. Same narrow SECURITY DEFINER pattern as estimate
-- approval: re-checks the caller, the property and the item.
-- ---------------------------------------------------------------------
create or replace function public.member_decline_warranty(
  target_asset_id uuid
)
returns public.warranty_notices
language plpgsql
security definer
set search_path = public
as $$
declare
  a      public.assets;
  result public.warranty_notices;
begin
  select * into a from public.assets where id = target_asset_id;
  if not found then
    raise exception 'item not found';
  end if;

  if not public.can_access_property(a.property_id) then
    raise exception 'not your item';
  end if;

  if public.current_user_role() <> 'member' then
    raise exception 'only the homeowner can use this route';
  end if;

  if a.warranty_expires is null then
    raise exception 'that item has no warranty date recorded';
  end if;

  insert into public.warranty_notices
    (property_id, asset_id, warranty_expires, response, responded_at)
  values
    (a.property_id, target_asset_id, a.warranty_expires, 'DECLINED', now())
  on conflict (asset_id, warranty_expires) do update
    set response = 'DECLINED', responded_at = now()
  returning * into result;

  return result;
end;
$$;

comment on function public.member_decline_warranty is
  'The homeowner says no thanks to a warranty reminder, from their own '
  'phone. Stops that item being raised again for that warranty period.';

-- ---------------------------------------------------------------------
-- The office worklist.
--
-- Items whose warranty is running out and where nobody has been told, or
-- was told and has not answered. Sorted by how little time is left, so
-- the top of the list is the one that costs somebody money first.
--
-- "Lifetime" warranties (the far-future dates manufacturers like Delta
-- actually use) are excluded — matching warrantyInfo() in the app, which
-- treats anything from 2090 on as lifetime.
-- ---------------------------------------------------------------------
create or replace view public.warranty_watch
with (security_invoker = true) as
  select
    a.id                as asset_id,
    a.property_id,
    p.name              as property_name,
    a.name              as asset_name,
    a.manufacturer,
    a.model,
    a.serial_number,
    a.warranty_expires,
    (a.warranty_expires - (now() at time zone 'America/New_York')::date) as days_left,
    n.id                as notice_id,
    n.notified_at,
    n.response
  from public.assets a
  join public.properties p on p.id = a.property_id
  left join public.warranty_notices n
         on n.asset_id = a.id and n.warranty_expires = a.warranty_expires
  where a.warranty_expires is not null
    and extract(year from a.warranty_expires) < 2090
    and a.warranty_expires >= (now() at time zone 'America/New_York')::date
    and a.warranty_expires <= (now() at time zone 'America/New_York')::date + 120
    and coalesce(n.response, 'PENDING') <> 'DECLINED'
  order by a.warranty_expires;

comment on view public.warranty_watch is
  'Items coming out of warranty within 120 days that the member has not '
  'declined. 120 matches warrantyInfo() in lib/member/portal.ts — one '
  'definition of "ending soon", not two.';


-- ####################################################################
-- ## 0015_trade_dispatch.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0015 real dispatch
--
-- "Dispatch" was picking one partner from a flat list and moving a stage.
-- Whether anyone actually turned up depended on whoever you happened to
-- pick, and nothing recorded whether they answered, how long they took,
-- or whether they were any good.
--
-- What a member experiences is "somebody always comes, fast". That needs
-- four things this migration adds:
--
--   1. RANKING — a primary, a secondary and backups per category, so the
--      office is not choosing from memory at eight on a Friday.
--   2. AN OFFER WITH A CLOCK — a job is offered to one partner with a
--      deadline to answer, not silently assigned to them.
--   3. ROLLOVER — when they decline or the clock runs out, it goes to the
--      next one, and every step is on the record.
--   4. PERFORMANCE — acceptance rate and response time, measured rather
--      than remembered, so ranking can be based on something.
-- =====================================================================

create type public.dispatch_rank as enum ('PRIMARY', 'SECONDARY', 'BACKUP');

create type public.dispatch_response as enum (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',    -- the clock ran out
  'WITHDRAWN'   -- the office pulled it back
);

alter table public.trade_partners
  add column service_area        text,
  -- How long they get to answer. Per partner because a roofer and an
  -- emergency plumber do not live at the same speed.
  add column response_sla_hours  integer not null default 4,
  add column emergency_available boolean not null default false;

comment on column public.trade_partners.response_sla_hours is
  'Hours to accept or decline before the job rolls to the next partner.';

-- ---------------------------------------------------------------------
-- Who covers what, and in what order.
-- ---------------------------------------------------------------------
create table public.trade_coverage (
  id               uuid primary key default gen_random_uuid(),
  trade_partner_id uuid not null references public.trade_partners (id) on delete cascade,
  -- Free text, matching service_requests.category, which is also free text.
  category         text not null,
  rank             public.dispatch_rank not null default 'BACKUP',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (trade_partner_id, category)
);

create index trade_coverage_category_idx on public.trade_coverage (category, rank);

create trigger trade_coverage_set_updated_at
  before update on public.trade_coverage
  for each row execute function public.set_updated_at();

-- Exactly one primary and one secondary per category. Two primaries is not
-- a ranking, it is the flat list this migration exists to replace.
create unique index trade_coverage_one_primary
  on public.trade_coverage (category) where rank = 'PRIMARY';
create unique index trade_coverage_one_secondary
  on public.trade_coverage (category) where rank = 'SECONDARY';

comment on table public.trade_coverage is
  'Primary / secondary / backup per request category. One primary and one '
  'secondary each, enforced — anything else is not a ranking.';

-- ---------------------------------------------------------------------
-- The offer.
--
-- A job is OFFERED, not assigned. The difference is the whole feature:
-- an offer has a deadline, an answer and a next step.
-- ---------------------------------------------------------------------
create table public.dispatch_offers (
  id                 uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  trade_partner_id   uuid not null references public.trade_partners (id) on delete cascade,
  rank               public.dispatch_rank,

  offered_at         timestamptz not null default now(),
  respond_by         timestamptz not null,
  offered_by         uuid references public.profiles (id) on delete set null,

  response           public.dispatch_response not null default 'PENDING',
  responded_at       timestamptz,
  decline_reason     text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index dispatch_offers_request_idx on public.dispatch_offers (service_request_id, offered_at);
create index dispatch_offers_partner_idx on public.dispatch_offers (trade_partner_id);
create index dispatch_offers_pending_idx on public.dispatch_offers (respond_by)
  where response = 'PENDING';

create trigger dispatch_offers_set_updated_at
  before update on public.dispatch_offers
  for each row execute function public.set_updated_at();

comment on table public.dispatch_offers is
  'Every offer of a job to a trade partner, with the deadline to answer and '
  'what they said. The chain of offers on a request is its dispatch history.';

-- ---------------------------------------------------------------------
-- A trade partner acting as themselves.
-- ---------------------------------------------------------------------
create or replace function public.is_trade_partner(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trade_partners tp
     where tp.id = target_partner_id
       and tp.profile_id = auth.uid()
       and tp.is_active
  )
$$;

-- A trade must be able to see a job they have been OFFERED, not only one
-- already assigned to them — otherwise they cannot decide whether to take
-- it. Extends the existing helper rather than replacing its meaning.
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
  or exists (
    select 1
    from public.dispatch_offers o
    join public.trade_partners tp on tp.id = o.trade_partner_id
    where o.service_request_id = target_request_id
      and tp.profile_id = auth.uid()
      and tp.is_active
      and o.response in ('PENDING', 'ACCEPTED')
  )
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.trade_coverage enable row level security;
alter table public.trade_coverage force row level security;

-- Staff manage coverage. A partner may see their own, and nobody else's —
-- who else B&M uses is not their business.
create policy trade_coverage_select on public.trade_coverage
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

create policy trade_coverage_admin_write on public.trade_coverage
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.dispatch_offers enable row level security;
alter table public.dispatch_offers force row level security;

create policy dispatch_offers_select on public.dispatch_offers
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

create policy dispatch_offers_admin_write on public.dispatch_offers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Offer the job to the next partner in line.
--
-- Expires whatever is outstanding first, so the chain reads honestly: a
-- primary who never answered shows as EXPIRED, not as though they were
-- skipped. Returns null when the bench is empty, which the app surfaces
-- rather than failing silently.
-- ---------------------------------------------------------------------
create or replace function public.dispatch_next(
  target_request_id uuid,
  p_partner_id uuid default null   -- override the ranking by hand
)
returns public.dispatch_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  req     public.service_requests;
  partner public.trade_partners;
  chosen  uuid;
  chosen_rank public.dispatch_rank;
  result  public.dispatch_offers;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'service request not found';
  end if;

  if not public.can_write_property(req.property_id) then
    raise exception 'only staff can dispatch';
  end if;

  -- Anything still outstanding has had its chance.
  update public.dispatch_offers
     set response = 'EXPIRED', responded_at = now()
   where service_request_id = target_request_id
     and response = 'PENDING';

  if p_partner_id is not null then
    chosen := p_partner_id;
    select rank into chosen_rank
      from public.trade_coverage
     where trade_partner_id = chosen and category = req.category;
  else
    -- Next by rank, skipping anyone already offered this job.
    select c.trade_partner_id, c.rank into chosen, chosen_rank
      from public.trade_coverage c
      join public.trade_partners tp on tp.id = c.trade_partner_id
     where c.category = req.category
       and tp.is_active
       and not exists (
         select 1 from public.dispatch_offers o
          where o.service_request_id = target_request_id
            and o.trade_partner_id = c.trade_partner_id
       )
     order by case c.rank
                when 'PRIMARY' then 1
                when 'SECONDARY' then 2
                else 3
              end,
              tp.company_name
     limit 1;
  end if;

  if chosen is null then
    return null;   -- nobody left; the app says so rather than pretending
  end if;

  select * into partner from public.trade_partners where id = chosen;

  insert into public.dispatch_offers
    (service_request_id, trade_partner_id, rank, respond_by, offered_by)
  values
    (target_request_id, chosen, chosen_rank,
     now() + make_interval(hours => coalesce(partner.response_sla_hours, 4)),
     auth.uid())
  returning * into result;

  update public.service_requests
     set trade_partner_id = chosen, stage = 'DISPATCHED'
   where id = target_request_id;

  insert into public.service_request_events
    (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    target_request_id, req.stage, 'DISPATCHED',
    'Offered to ' || partner.company_name ||
    coalesce(' (' || lower(chosen_rank::text) || ')', '') ||
    ' — ' || coalesce(partner.response_sla_hours, 4) || 'h to respond.',
    auth.uid()
  );

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- The trade partner answers.
--
-- Theirs to press, from their own phone. Declining clears the assignment
-- so the job can roll on; it does not sit in limbo pointing at somebody
-- who already said no.
-- ---------------------------------------------------------------------
create or replace function public.trade_respond_to_offer(
  target_offer_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns public.dispatch_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.dispatch_offers;
  partner public.trade_partners;
  result  public.dispatch_offers;
begin
  select * into o from public.dispatch_offers where id = target_offer_id;
  if not found then
    raise exception 'offer not found';
  end if;

  if not public.is_trade_partner(o.trade_partner_id) then
    raise exception 'not your job to answer';
  end if;

  if o.response <> 'PENDING' then
    raise exception 'this offer is already %', lower(o.response::text);
  end if;

  if now() > o.respond_by then
    update public.dispatch_offers
       set response = 'EXPIRED', responded_at = now()
     where id = target_offer_id;
    raise exception 'the time to answer this ran out at %', o.respond_by;
  end if;

  select * into partner from public.trade_partners where id = o.trade_partner_id;

  update public.dispatch_offers
     set response       = (case when p_accept then 'ACCEPTED' else 'DECLINED' end)
                            ::public.dispatch_response,
         responded_at   = now(),
         decline_reason = case when p_accept then null else p_reason end
   where id = target_offer_id
  returning * into result;

  if p_accept then
    update public.service_requests
       set stage = 'ACCEPTED', trade_partner_id = o.trade_partner_id
     where id = o.service_request_id;

    insert into public.service_request_events
      (service_request_id, from_stage, to_stage, note, actor_id)
    values (o.service_request_id, 'DISPATCHED', 'ACCEPTED',
            partner.company_name || ' accepted the job.', auth.uid());
  else
    -- Back to the office's court, with nobody assigned.
    update public.service_requests
       set trade_partner_id = null, stage = 'TRIAGE'
     where id = o.service_request_id;

    insert into public.service_request_events
      (service_request_id, from_stage, to_stage, note, actor_id)
    values (o.service_request_id, 'DISPATCHED', 'TRIAGE',
            partner.company_name || ' declined' ||
            coalesce(': ' || p_reason, '.'), auth.uid());
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Are they any good?
--
-- Acceptance rate and response time, measured rather than remembered.
-- EXPIRED counts against a partner on purpose: not answering is a worse
-- failure than declining, because it costs the member the whole clock.
-- ---------------------------------------------------------------------
create or replace view public.trade_performance
with (security_invoker = true) as
  select
    tp.id                as trade_partner_id,
    tp.company_name,
    tp.trade,
    tp.is_active,
    tp.response_sla_hours,
    count(o.id)                                          as offers,
    count(o.id) filter (where o.response = 'ACCEPTED')    as accepted,
    count(o.id) filter (where o.response = 'DECLINED')    as declined,
    count(o.id) filter (where o.response = 'EXPIRED')     as expired,
    count(o.id) filter (where o.response = 'PENDING')     as pending,
    case when count(o.id) filter (where o.response <> 'PENDING') > 0
         then round(
           100.0 * count(o.id) filter (where o.response = 'ACCEPTED')
                 / count(o.id) filter (where o.response <> 'PENDING'))
         else null end                                   as accept_rate,
    round(avg(
      extract(epoch from (o.responded_at - o.offered_at)) / 60
    ) filter (where o.responded_at is not null
                and o.response in ('ACCEPTED', 'DECLINED')))
                                                         as avg_response_minutes,
    (select count(*) from public.service_requests sr
      where sr.trade_partner_id = tp.id
        and sr.stage in ('COMPLETED', 'HOME_RECORD_UPDATED', 'CLOSED'))
                                                         as jobs_completed
  from public.trade_partners tp
  left join public.dispatch_offers o on o.trade_partner_id = tp.id
  group by tp.id, tp.company_name, tp.trade, tp.is_active, tp.response_sla_hours;

comment on view public.trade_performance is
  'Acceptance rate and response time per partner. EXPIRED counts against '
  'them deliberately — silence costs the member the whole clock.';


-- ####################################################################
-- ## 0016_baseline_report.sql
-- ####################################################################

-- =====================================================================
-- B&M HomeKeeper — 0016 the Home Baseline Report
--
-- The first document a new member ever receives. Today their first one is
-- a routine quarterly report three months in, which means their first
-- impression of the product is "we did a visit" rather than "we now know
-- your house better than you do".
--
-- The baseline is the other thing: every system, every serial, every
-- warranty, where the shutoffs are with photographs of them, the condition
-- of the house on the day we took it on, and the plan for the next few
-- years. It is the artifact somebody shows their spouse to justify the
-- spend, and the one a buyer's agent asks for when they sell.
--
-- ⚠ ONE STATEMENT, ON PURPOSE.
--
-- PostgreSQL will not let a newly added enum value be USED in the same
-- transaction that adds it ("unsafe use of new value"). The whole of
-- CATCH-UP.sql may run as one transaction in the Supabase SQL editor, so
-- nothing in this migration — or anywhere downstream of it in those
-- bundled scripts — may insert a report of this type. The office creates
-- the first baseline from the app, after this has committed.
-- =====================================================================

alter type public.report_type add value if not exists 'BASELINE';


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

-- ---------------------------------------------------------------------
-- 11. The facts about the house, and where the shutoffs are
--
-- This is the data behind "I need help now". The gas main is deliberately
-- absent so the demo also shows the honest "we have not recorded yours
-- yet" state — a prospect should see both.
-- ---------------------------------------------------------------------
update public.properties
   set construction_type      = 'Two-story colonial, wood frame',
       exterior_material      = 'Vinyl siding',
       roof_material          = 'Architectural shingle',
       roof_installed_year    = 2016,
       water_source           = 'PUBLIC',
       sewer_type             = 'PUBLIC',
       heating_fuel           = 'NATURAL_GAS',
       electrical_service_amps = 200,
       stories                = 2,
       basement_type          = 'Full, unfinished — mechanicals live here'
 where id = 'b0000000-0000-4000-8000-000000000001';

insert into public.safety_points
  (id, property_id, kind, label, room_id, location_note, how_to_note, sort_order)
values
  ('88880000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'WATER_MAIN', 'Main water shutoff', 'd0000000-0000-4000-8000-00000000000b',
   'Basement, northwest corner, on the wall just past the stairs where the line comes in through the foundation.',
   'Red lever. Turn it a quarter turn so it sits across the pipe rather than along it.', 10),
  ('88880000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'ELECTRICAL_PANEL', 'Main electrical panel', 'd0000000-0000-4000-8000-00000000000b',
   'Basement, south wall beside the workbench. 200 amp Square D, 40 space.',
   'Main breaker is the large one at the top. Furnace is breaker 14, sump is 22.', 20),
  ('88880000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'WATER_HEATER_SHUTOFF', 'Water heater shutoff', 'd0000000-0000-4000-8000-00000000000b',
   'On the cold inlet at the top of the Bradford White, northeast corner of the basement.',
   'Blue handle on the right-hand pipe. Quarter turn.', 30),
  ('88880000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   'SUMP_PUMP', 'Sump pump', 'd0000000-0000-4000-8000-00000000000b',
   'Basement, northwest pit under the plywood cover.',
   'Zoeller M53. Lift the float by hand to test it — it should start straight away.', 40),
  ('88880000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   'MAIN_CLEANOUT', 'Main drain cleanout', 'd0000000-0000-4000-8000-00000000000b',
   'Basement floor, three feet from the base of the soil stack. Black cap, flush with the slab.',
   null, 50)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 12. Two warranties genuinely running out
--
-- Relative to today rather than fixed dates, so warranty watch is never
-- dead on the demo home. Without this the feature would look broken the
-- moment the seed's hard-coded dates went stale — which they already had.
-- ---------------------------------------------------------------------
update public.assets
   set warranty_expires = current_date + 58
 where id = 'e0000000-0000-4000-8000-00000000000f';   -- ecobee thermostat

update public.assets
   set warranty_expires = current_date + 112
 where id = 'e0000000-0000-4000-8000-000000000012';   -- Culligan water softener

-- ---------------------------------------------------------------------
-- 13. Who covers what, and in what order
--
-- The bench behind real dispatch. A job goes to the primary with a clock
-- on it; if they decline or go quiet it rolls to the secondary.
-- ---------------------------------------------------------------------
update public.trade_partners set response_sla_hours = 2, emergency_available = true
 where trade in ('Plumbing', 'HVAC');

insert into public.trade_coverage (trade_partner_id, category, rank) values
  ('f0000000-0000-4000-8000-000000000002', 'Plumbing',            'PRIMARY'),
  ('f0000000-0000-4000-8000-000000000002', 'Water damage or leak','PRIMARY'),
  ('f0000000-0000-4000-8000-000000000001', 'Heating & cooling',   'PRIMARY'),
  ('f0000000-0000-4000-8000-000000000003', 'Electrical',          'PRIMARY'),
  ('f0000000-0000-4000-8000-000000000004', 'Roof & gutters',      'PRIMARY'),
  ('f0000000-0000-4000-8000-000000000004', 'Exterior & siding',   'PRIMARY'),
  ('f0000000-0000-4000-8000-000000000003', 'Appliance',           'SECONDARY'),
  ('f0000000-0000-4000-8000-000000000001', 'Appliance',           'PRIMARY')
on conflict (trade_partner_id, category) do nothing;

-- =====================================================================
-- Seasonal checklists you can edit  (migration 0018)
--
-- The Q1-Q4 lists live here rather than in a code file, edited at
-- /admin/checklists. Deliberately empty: until a quarter has items the
-- app uses the built-in draft, and the screen offers to copy it in.
-- =====================================================================
create type public.quarter as enum ('Q1', 'Q2', 'Q3', 'Q4');

create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  quarter     public.quarter not null,
  -- What the visit is called on the calendar and on the report.
  name        text not null,
  season      text not null,
  months      text not null,
  -- One line on why this quarter looks the way it does. It prints on the
  -- report, so a member can see the visit had a point.
  focus       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One live list per quarter. Older ones can be kept, deactivated, for the
-- record — a report from 2026 should still be explainable in 2029.
create unique index checklist_templates_one_active_per_quarter
  on public.checklist_templates (quarter)
  where is_active;

create table public.checklist_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  category     text not null,
  label        text not null,
  -- What "good" looks like, for a technician who has not done this one
  -- before. Shows on the field screen, never on the member's report.
  help_note    text,
  sort_order   integer not null default 0,

  -- Only put this item on the list when the house matches. NULL means
  -- every house. A septic item on a public-sewer home is noise, and noise
  -- is how a checklist stops being read.
  only_water_source public.water_source[],
  only_sewer_type   public.sewer_type[],
  only_heating_fuel public.heating_fuel[],

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index checklist_template_items_template_idx
  on public.checklist_template_items (template_id, sort_order);

create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

create trigger checklist_template_items_set_updated_at
  before update on public.checklist_template_items
  for each row execute function public.set_updated_at();

comment on table public.checklist_templates is
  'The seasonal visit lists, owned and edited by the office rather than by '
  'a developer. Until a quarter has an active row with items, the app uses '
  'the built-in draft in lib/checklist-templates.ts.';

comment on column public.checklist_template_items.only_sewer_type is
  'Restricts the item to matching houses. NULL means every house. Keeps a '
  'septic item off a public-sewer list — a checklist with items that do not '
  'apply is a checklist people stop reading.';

-- ---------------------------------------------------------------------
-- RLS.
--
-- Readable by everyone signed in, including members. "Here is exactly what
-- we check, every quarter" is the product — it is not property data, and
-- there is nothing about one member's home in it.
--
-- Written by admin only. A tech changing the standard mid-visit is not a
-- feature; a tech logging a finding is.
-- ---------------------------------------------------------------------
alter table public.checklist_templates       enable row level security;
alter table public.checklist_templates       force  row level security;
alter table public.checklist_template_items  enable row level security;
alter table public.checklist_template_items  force  row level security;

create policy checklist_templates_select on public.checklist_templates
  for select to authenticated using (true);

create policy checklist_templates_admin_write on public.checklist_templates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated using (true);

create policy checklist_template_items_admin_write on public.checklist_template_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- The note travels with the visit, not just with the template.
--
-- A visit takes its own copy of the list when it starts, and it has to
-- keep the whole thing — including the "what good looks like" note. The
-- field app works offline off the stamped rows, and a report written in
-- 2029 should be explainable by what the technician was actually shown in
-- 2026, not by whatever the template says by then.
--
-- Member-facing screens never render this column. It is written for a
-- technician, in a technician's voice.
-- ---------------------------------------------------------------------
alter table public.checklist_items
  add column help_note text;

comment on column public.checklist_items.help_note is
  'Copied from the template when the visit starts. Field app only — never '
  'shown to a member.';

