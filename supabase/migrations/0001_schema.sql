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
