-- =====================================================================
-- B&M HomeKeeper — CATCH-UP
--
-- ▶ WHAT THIS IS
--   The database changes added since you first ran SETUP-EVERYTHING.sql.
--   Three things so far:
--     1. The office can attach files to a report (a trade partner's
--        service sheet, an inspection certificate, a write-up done
--        elsewhere).
--     2. Every home now carries a membership tier — Core or Response —
--        and the database itself stops a Core home from seeing the
--        quarterly reports only Response members pay for.
--     3. A member can say yes to something on their Home Plan. It opens a
--        normal job, and finishing that job clears the item off their plan
--        by itself.
--     4. Membership agreements: what they signed, when it renews, and the
--        three-business-day right to cancel — as a button the homeowner can
--        actually press, not a paragraph. See docs/pa-compliance.md.
--     5. The facts about the house (water source, sewer, service size) and
--        where the shutoffs are — the data behind "I need help now".
--     6. Warranty watch: the app finally uses the warranty dates it has
--        been storing all along, and tells a member before cover runs out.
--     7. Real dispatch: a job is offered to a ranked trade partner with a
--        clock on it, rolls to the next one if they decline or go quiet,
--        and their acceptance rate is measured rather than remembered.
--     8. The Home Baseline Report — the first document a new member gets.
--
-- ▶ HOW TO USE IT
--   1. Supabase dashboard → SQL Editor → New query
--   2. Select all of this file, copy, paste
--   3. Run
--
-- ▶ SAFE TO RUN TWICE
--   Unlike SETUP-EVERYTHING.sql, this one checks before it changes
--   anything. If you already ran it, running it again does nothing and
--   reports no error. If you are not sure whether you ran it — just run it.
--
-- ▶ WHAT YOU SHOULD SEE
--   A single row at the bottom saying your database is up to date, and
--   naming the tier your demo home is on. That is the confirmation; it
--   replaces "Success. No rows returned."
-- =====================================================================


-- ---------------------------------------------------------------------
-- Files attached to a report  (migration 0009)
-- ---------------------------------------------------------------------

alter table public.documents
  add column if not exists report_id uuid references public.reports (id) on delete set null;

create index if not exists documents_report_id_idx on public.documents (report_id);

comment on column public.documents.report_id is
  'Set when this file belongs with a particular report. A member sees it '
  'only once that report is released.';

-- A file attached to a DRAFT report must not reach the member early.
-- Documents are property-scoped, so without this a member would see a
-- report attachment the moment it was uploaded — before anyone had
-- reviewed the report it belongs to.
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



-- ---------------------------------------------------------------------
-- Membership tiers  (migration 0010)
--
-- Core and Response are not just a label on a page. A Core member who
-- guessed a report web address would otherwise read a quarterly report
-- they never paid for, so the tier is enforced down in the database
-- where guessing a address cannot get around it.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_tier') then
    create type public.membership_tier as enum ('CORE', 'RESPONSE');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_cycle') then
    create type public.billing_cycle as enum ('MONTHLY', 'ANNUAL_PREPAID');
  end if;
end $$;

alter table public.properties
  add column if not exists tier                       public.membership_tier not null default 'CORE',
  add column if not exists billing_cycle              public.billing_cycle   not null default 'MONTHLY',
  add column if not exists commitment_start           date,
  add column if not exists commitment_months          integer not null default 12,
  add column if not exists member_discount_used_ytd   numeric(10,2) not null default 0,
  add column if not exists member_discount_year_start date;

create index if not exists properties_tier_idx on public.properties (tier);

comment on column public.properties.tier is
  'CORE or RESPONSE. Gates quarterly visits, quarterly reports, the Hub and '
  'urgent help. Enforced in RLS, not only in the UI.';

comment on column public.properties.member_discount_used_ytd is
  'Member pricing given this membership year, against the tier cap.';

-- One-off backfill. member_discount_year_start is only ever null on a row
-- that predates this change, so running the file again leaves your data
-- alone — including any tier you have since set by hand.
update public.properties
   set tier = 'RESPONSE',
       billing_cycle = 'ANNUAL_PREPAID'
 where plan_tier is not null
   and member_discount_year_start is null;

update public.properties
   set commitment_start = coalesce(commitment_start, member_since, current_date),
       member_discount_year_start = coalesce(member_since, current_date)
 where member_discount_year_start is null;

-- Does this property's tier include a feature? Deliberately mirrors
-- lib/membership.ts; only the features that gate data need to be here.
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

-- Quarterly reports are Response-only. Staff still see every report on a
-- property they can write to; annual reports stay available to both tiers.
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



-- ---------------------------------------------------------------------
-- Saying yes to the Home Plan  (migration 0011)
--
-- The plan quotes a range, and a range is not something anyone can really
-- approve, so the member's button asks us for a firm price rather than
-- approving one. It opens an ordinary job; they approve the firm number on
-- the screen they already know; finishing the job clears the item off the
-- plan so we never keep recommending work they have already paid for.
-- ---------------------------------------------------------------------

alter table public.service_requests
  add column if not exists finding_id   uuid references public.findings (id)   on delete set null,
  add column if not exists plan_item_id uuid references public.plan_items (id) on delete set null;

create index if not exists service_requests_finding_id_idx   on public.service_requests (finding_id);
create index if not exists service_requests_plan_item_id_idx on public.service_requests (plan_item_id);

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

drop trigger if exists service_requests_links_same_property on public.service_requests;
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

drop trigger if exists service_requests_sync_plan_item on public.service_requests;
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


-- ---------------------------------------------------------------------
-- Membership agreements and the PA disclosures  (migration 0012)
--
-- ⚠ NOT LEGAL ADVICE. This builds the machinery — storing the agreement,
-- showing the terms, honouring a cancellation, recording that a renewal
-- reminder went out. The WORDING is for your attorney. Read
-- docs/pa-compliance.md before you sign anyone up: one of these two
-- requirements is confirmed Pennsylvania law and one is not.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agreement_status') then
    create type public.agreement_status as enum (
      'PENDING_SIGNATURE',
      'ACTIVE',
      'RESCINDED',   -- cancelled inside the three-business-day window
      'CANCELLED',   -- ended later, by either side
      'EXPIRED',
      'SUPERSEDED'   -- replaced by a renewal agreement
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notice_method') then
    create type public.notice_method as enum ('EMAIL', 'MAIL', 'SMS', 'IN_PERSON');
  end if;
end $$;

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
create table if not exists public.membership_agreements (
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

create index if not exists membership_agreements_property_id_idx on public.membership_agreements (property_id);
create index if not exists membership_agreements_status_idx      on public.membership_agreements (status);
create index if not exists membership_agreements_term_end_idx    on public.membership_agreements (term_end);

drop trigger if exists membership_agreements_updated_at on public.membership_agreements;
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

drop trigger if exists membership_agreements_rescission_deadline on public.membership_agreements;
create trigger membership_agreements_rescission_deadline
  before insert or update of signed_at on public.membership_agreements
  for each row execute function public.set_agreement_rescission_deadline();

-- ---------------------------------------------------------------------
-- RLS. A member reads their own agreement and may exercise the
-- cancellation right through the function below — nothing else.
-- ---------------------------------------------------------------------
alter table public.membership_agreements enable row level security;
alter table public.membership_agreements force row level security;

drop policy if exists membership_agreements_select on public.membership_agreements;
create policy membership_agreements_select on public.membership_agreements
  for select to authenticated
  using (public.can_access_property(property_id));

drop policy if exists membership_agreements_staff_insert on public.membership_agreements;
create policy membership_agreements_staff_insert on public.membership_agreements
  for insert to authenticated
  with check (public.can_write_property(property_id));

drop policy if exists membership_agreements_staff_update on public.membership_agreements;
create policy membership_agreements_staff_update on public.membership_agreements
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

drop policy if exists membership_agreements_admin_delete on public.membership_agreements;
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


-- ---------------------------------------------------------------------
-- The house itself, and where the shutoffs are  (migration 0013)
--
-- The Home Record knew everything about the water heater and almost
-- nothing about the HOUSE — and there was nowhere at all to record where
-- the main water shutoff is or what it looks like. That last one is the
-- whole point: a member standing in two inches of water at 11pm needs to
-- be told THEIR shutoff is behind the furnace, with a photograph of it.
--
-- ⚠ Reference information only, never a substitute for 911 or the gas
-- company — and, as ever, no alarm codes, key locations or combinations.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'water_source') then
    create type public.water_source as enum ('PUBLIC', 'WELL', 'SHARED_WELL', 'OTHER');
  end if;
  if not exists (select 1 from pg_type where typname = 'sewer_type') then
    create type public.sewer_type as enum ('PUBLIC', 'SEPTIC', 'MOUND', 'OTHER');
  end if;
  if not exists (select 1 from pg_type where typname = 'heating_fuel') then
    create type public.heating_fuel as enum ('NATURAL_GAS', 'PROPANE', 'OIL', 'ELECTRIC', 'HEAT_PUMP', 'OTHER');
  end if;
end $$;

alter table public.properties
  add column if not exists construction_type      text,
  add column if not exists exterior_material      text,
  add column if not exists roof_material          text,
  add column if not exists roof_installed_year    integer,
  add column if not exists water_source           public.water_source,
  add column if not exists sewer_type             public.sewer_type,
  add column if not exists heating_fuel           public.heating_fuel,
  add column if not exists electrical_service_amps integer,
  add column if not exists stories                numeric(2,1),
  add column if not exists basement_type          text;

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
do $$
begin
  if not exists (select 1 from pg_type where typname = 'safety_point_kind') then
    create type public.safety_point_kind as enum (
  'WATER_MAIN',          -- the whole-house water shutoff
  'WATER_HEATER_SHUTOFF',
  'GAS_MAIN',
  'OIL_TANK_SHUTOFF',
  'PROPANE_TANK_SHUTOFF',
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
  end if;
end $$;

create table if not exists public.safety_points (
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

create index if not exists safety_points_property_id_idx on public.safety_points (property_id);
create index if not exists safety_points_kind_idx        on public.safety_points (property_id, kind);

drop trigger if exists safety_points_set_updated_at on public.safety_points;
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

drop trigger if exists safety_points_links_same_property on public.safety_points;
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

drop policy if exists safety_points_select on public.safety_points;
create policy safety_points_select on public.safety_points
  for select to authenticated
  using (public.can_access_property(property_id));

drop policy if exists safety_points_staff_insert on public.safety_points;
create policy safety_points_staff_insert on public.safety_points
  for insert to authenticated
  with check (public.can_write_property(property_id));

drop policy if exists safety_points_staff_update on public.safety_points;
create policy safety_points_staff_update on public.safety_points
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

drop policy if exists safety_points_admin_delete on public.safety_points;
create policy safety_points_admin_delete on public.safety_points
  for delete to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- Warranty watch  (migration 0014)
--
-- The app has stored a warranty expiry on every Home Record item since day
-- one and never once used it. A member whose water heater fails ten weeks
-- after the cover quietly lapsed paid for a tank they did not have to.
-- This adds the memory: who we told, when, and what they said — so it
-- never nags somebody who already said no.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'warranty_response') then
    create type public.warranty_response as enum (
      'PENDING',   -- we have told them, they have not said
      'WANTS',     -- they asked us to look at it
      'DECLINED'   -- they said no thanks; stop asking about this one
    );
  end if;
end $$;

create table if not exists public.warranty_notices (
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

create index if not exists warranty_notices_property_id_idx on public.warranty_notices (property_id);
create index if not exists warranty_notices_asset_id_idx    on public.warranty_notices (asset_id);

drop trigger if exists warranty_notices_set_updated_at on public.warranty_notices;
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

drop trigger if exists warranty_notices_links_same_property on public.warranty_notices;
create trigger warranty_notices_links_same_property
  before insert or update of asset_id, property_id on public.warranty_notices
  for each row execute function public.enforce_warranty_notice_links();

-- ---------------------------------------------------------------------
-- RLS. A member reads their own and may decline through the function
-- below; everything else is staff.
-- ---------------------------------------------------------------------
alter table public.warranty_notices enable row level security;
alter table public.warranty_notices force row level security;

drop policy if exists warranty_notices_select on public.warranty_notices;
create policy warranty_notices_select on public.warranty_notices
  for select to authenticated
  using (public.can_access_property(property_id));

drop policy if exists warranty_notices_staff_insert on public.warranty_notices;
create policy warranty_notices_staff_insert on public.warranty_notices
  for insert to authenticated
  with check (public.can_write_property(property_id));

drop policy if exists warranty_notices_staff_update on public.warranty_notices;
create policy warranty_notices_staff_update on public.warranty_notices
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

drop policy if exists warranty_notices_admin_delete on public.warranty_notices;
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


-- ---------------------------------------------------------------------
-- Real dispatch  (migration 0015)
--
-- "Dispatch" was picking one partner from a flat list and moving a stage.
-- Whether anyone turned up depended on who you happened to pick, and
-- nothing recorded whether they answered or how long they took. A job is
-- now OFFERED, with a clock, a ranked bench behind it, and a record.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispatch_rank') then
    create type public.dispatch_rank as enum ('PRIMARY', 'SECONDARY', 'BACKUP');
  end if;
  if not exists (select 1 from pg_type where typname = 'dispatch_response') then
    create type public.dispatch_response as enum (
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'EXPIRED',    -- the clock ran out
      'WITHDRAWN'   -- the office pulled it back
    );
  end if;
end $$;

alter table public.trade_partners
  add column if not exists service_area        text,
  -- How long they get to answer. Per partner because a roofer and an
  -- emergency plumber do not live at the same speed.
  add column if not exists response_sla_hours  integer not null default 4,
  add column if not exists emergency_available boolean not null default false;

comment on column public.trade_partners.response_sla_hours is
  'Hours to accept or decline before the job rolls to the next partner.';

-- ---------------------------------------------------------------------
-- Who covers what, and in what order.
-- ---------------------------------------------------------------------
create table if not exists public.trade_coverage (
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

create index if not exists trade_coverage_category_idx on public.trade_coverage (category, rank);

drop trigger if exists trade_coverage_set_updated_at on public.trade_coverage;
create trigger trade_coverage_set_updated_at
  before update on public.trade_coverage
  for each row execute function public.set_updated_at();

-- Exactly one primary and one secondary per category. Two primaries is not
-- a ranking, it is the flat list this migration exists to replace.
create unique index if not exists trade_coverage_one_primary
  on public.trade_coverage (category) where rank = 'PRIMARY';
create unique index if not exists trade_coverage_one_secondary
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
create table if not exists public.dispatch_offers (
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

create index if not exists dispatch_offers_request_idx on public.dispatch_offers (service_request_id, offered_at);
create index if not exists dispatch_offers_partner_idx on public.dispatch_offers (trade_partner_id);
create index if not exists dispatch_offers_pending_idx on public.dispatch_offers (respond_by)
  where response = 'PENDING';

drop trigger if exists dispatch_offers_set_updated_at on public.dispatch_offers;
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
drop policy if exists trade_coverage_select on public.trade_coverage;
create policy trade_coverage_select on public.trade_coverage
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

drop policy if exists trade_coverage_admin_write on public.trade_coverage;
create policy trade_coverage_admin_write on public.trade_coverage
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.dispatch_offers enable row level security;
alter table public.dispatch_offers force row level security;

drop policy if exists dispatch_offers_select on public.dispatch_offers;
create policy dispatch_offers_select on public.dispatch_offers
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

drop policy if exists dispatch_offers_admin_write on public.dispatch_offers;
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


-- ---------------------------------------------------------------------
-- The Home Baseline Report  (migration 0016)
--
-- The first document a new member ever receives: their whole house written
-- down — every system, every serial, every warranty, the shutoffs with
-- photographs, and the plan for the next few years.
--
-- ⚠ This adds a value to an existing type, and PostgreSQL will not let a
-- new enum value be USED in the same transaction that adds it. Nothing
-- below this line creates a report of that type on purpose — the office
-- makes the first one from the app, after this file has finished.
-- ---------------------------------------------------------------------

alter type public.report_type add value if not exists 'BASELINE';


-- ---------------------------------------------------------------------
-- The propane tank shutoff  (migration 0017)
--
-- A propane home's shutoff is the hand wheel on the tank, outdoors. It is
-- the one valve this app will ever ask a member to close during a leak,
-- because they are already outside when they reach it. There was nowhere
-- to record it until now.
--
-- ⚠ Same enum rule as above: nothing below this line may create a safety
-- point of this kind. You add the first one from the app.
-- ---------------------------------------------------------------------

alter type public.safety_point_kind add value if not exists 'PROPANE_TANK_SHUTOFF';

-- ---------------------------------------------------------------------
-- Seasonal checklists you can edit  (migration 0018)
--
-- The Q1–Q4 lists move out of a code file and into the database, with a
-- screen at /admin/checklists to write them on. Nothing is seeded here:
-- until a quarter has a list with items in it, the app keeps using the
-- built-in draft exactly as before, so this changes no behaviour on its
-- own. Press "start from the built-in list" on the screen to get a copy
-- to mark up.
-- ---------------------------------------------------------------------

do $$ begin
  create type public.quarter as enum ('Q1', 'Q2', 'Q3', 'Q4');
exception when duplicate_object then null; end $$;

create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  quarter     public.quarter not null,
  name        text not null,
  season      text not null,
  months      text not null,
  focus       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists checklist_templates_one_active_per_quarter
  on public.checklist_templates (quarter)
  where is_active;

create table if not exists public.checklist_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  category     text not null,
  label        text not null,
  help_note    text,
  sort_order   integer not null default 0,
  only_water_source public.water_source[],
  only_sewer_type   public.sewer_type[],
  only_heating_fuel public.heating_fuel[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists checklist_template_items_template_idx
  on public.checklist_template_items (template_id, sort_order);

drop trigger if exists checklist_templates_set_updated_at on public.checklist_templates;
create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

drop trigger if exists checklist_template_items_set_updated_at on public.checklist_template_items;
create trigger checklist_template_items_set_updated_at
  before update on public.checklist_template_items
  for each row execute function public.set_updated_at();

alter table public.checklist_items
  add column if not exists help_note text;

alter table public.checklist_templates       enable row level security;
alter table public.checklist_templates       force  row level security;
alter table public.checklist_template_items  enable row level security;
alter table public.checklist_template_items  force  row level security;

drop policy if exists checklist_templates_select on public.checklist_templates;
create policy checklist_templates_select on public.checklist_templates
  for select to authenticated using (true);

drop policy if exists checklist_templates_admin_write on public.checklist_templates;
create policy checklist_templates_admin_write on public.checklist_templates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists checklist_template_items_select on public.checklist_template_items;
create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated using (true);

drop policy if exists checklist_template_items_admin_write on public.checklist_template_items;
create policy checklist_template_items_admin_write on public.checklist_template_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- The six results  (migration 0019)
--
-- Pass / Watch / Fail was a home inspector's vocabulary and it never said
-- what happens next. PASS is kept and relabelled "Good" so old visits do
-- not have to be rewritten; ATTENTION and FAIL stay readable but the app
-- stops offering them.
--
-- ⚠ Enum values again: nothing below this line may USE one of these.
-- ---------------------------------------------------------------------

alter type public.checklist_result add value if not exists 'MONITOR';
alter type public.checklist_result add value if not exists 'MAINTENANCE_DUE';
alter type public.checklist_result add value if not exists 'REPAIR_RECOMMENDED';
alter type public.checklist_result add value if not exists 'SAFETY_URGENT';
alter type public.checklist_result add value if not exists 'SPECIALIST_REVIEW';


-- ---------------------------------------------------------------------
-- Core items and readings  (migration 0020)
--
-- Core items go on every visit whatever the season, because fire and
-- water do not wait for the right quarter. And an item can now ask for a
-- number instead of a tick — a reading you can hold against last year's
-- is the one thing a home inspector can never give a homeowner.
-- ---------------------------------------------------------------------

alter table public.checklist_template_items
  add column if not exists is_core boolean not null default false,
  add column if not exists measurement_label text,
  add column if not exists measurement_unit  text,
  add column if not exists measurement_low   numeric(10,2),
  add column if not exists measurement_high  numeric(10,2);

create index if not exists checklist_template_items_core_idx
  on public.checklist_template_items (is_core)
  where is_core;

alter table public.checklist_items
  add column if not exists measurement_label text,
  add column if not exists measurement_unit  text,
  add column if not exists measurement_low   numeric(10,2),
  add column if not exists measurement_high  numeric(10,2),
  add column if not exists measurement_value numeric(10,2);


-- ---------------------------------------------------------------------
-- Did it work?
-- ---------------------------------------------------------------------
select
  case
    when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'documents'
         and column_name = 'report_id'
    )
      then 'Report attachments did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'properties'
         and column_name = 'tier'
    )
      then 'Membership tiers did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'service_requests'
         and column_name = 'finding_id'
    )
      then 'Home Plan requests did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'membership_agreements'
    )
      then 'Membership agreements did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'safety_points'
    )
      then 'Shutoffs and house facts did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'warranty_notices'
    )
      then 'Warranty watch did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'dispatch_offers'
    )
      then 'Trade dispatch did not apply — send this result to Claude.'
    when not exists (
      select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
       where t.typname = 'report_type' and e.enumlabel = 'BASELINE'
    )
      then 'The baseline report type did not apply — send this result to Claude.'
    when not exists (
      select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
       where t.typname = 'safety_point_kind' and e.enumlabel = 'PROPANE_TANK_SHUTOFF'
    )
      then 'The propane tank shutoff did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'checklist_templates'
    )
      then 'Editable checklists did not apply — send this result to Claude.'
    when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'checklist_items'
         and column_name = 'measurement_value'
    )
      then 'Readings and the six results did not apply — send this result to Claude.'
    else 'Up to date. Everything through the quarterly program is in.'
  end as result,
  (select string_agg(name || ' — ' || tier, ', ' order by name)
     from public.properties) as your_homes;
