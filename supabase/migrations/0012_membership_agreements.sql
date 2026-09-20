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
