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
