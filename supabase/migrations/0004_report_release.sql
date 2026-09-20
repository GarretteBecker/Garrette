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
