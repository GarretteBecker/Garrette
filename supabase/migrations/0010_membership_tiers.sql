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
