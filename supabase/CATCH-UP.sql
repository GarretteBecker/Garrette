-- =====================================================================
-- B&M HomeKeeper — CATCH-UP
--
-- ▶ WHAT THIS IS
--   The database changes added since you first ran SETUP-EVERYTHING.sql.
--   Right now that is one thing: letting the office attach files to a
--   report (a trade partner's service sheet, an inspection certificate,
--   a write-up done elsewhere).
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
--   A single row at the bottom saying your database is up to date.
--   That is the confirmation; it replaces "Success. No rows returned."
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
-- Did it work?
-- ---------------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'documents'
         and column_name  = 'report_id'
    )
    then 'Up to date. You can now attach files to a report.'
    else 'Something did not apply — send this result to Claude.'
  end as result;
