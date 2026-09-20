-- =====================================================================
-- B&M HomeKeeper — CATCH-UP
--
-- ▶ WHAT THIS IS
--   The database changes added since you first ran SETUP-EVERYTHING.sql.
--   Two things so far:
--     1. The office can attach files to a report (a trade partner's
--        service sheet, an inspection certificate, a write-up done
--        elsewhere).
--     2. Every home now carries a membership tier — Core or Response —
--        and the database itself stops a Core home from seeing the
--        quarterly reports only Response members pay for.
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
    else 'Up to date. You can attach files to a report, and every home now has a membership tier.'
  end as result,
  (select string_agg(name || ' — ' || tier, ', ' order by name)
     from public.properties) as your_homes;
