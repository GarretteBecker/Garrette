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
    else 'Up to date. Report attachments, membership tiers, Home Plan requests and membership agreements are all in.'
  end as result,
  (select string_agg(name || ' — ' || tier, ', ' order by name)
     from public.properties) as your_homes;
