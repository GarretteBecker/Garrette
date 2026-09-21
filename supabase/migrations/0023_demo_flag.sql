-- =====================================================================
-- B&M HomeKeeper — 0023 keeping the sales demo out of the books
--
-- There are two demos and only one of them was ever safe.
--
--   /demo  — hardcoded TypeScript, no database at all. Always was, always
--            will be. Nothing to worry about there.
--
--   The Miller Home in seed.sql — a REAL property row, in the real
--            database. SETUP-EVERYTHING.sql includes that seed, which
--            means the script somebody runs to set up production also
--            puts a fake member in it. Left alone, that fake member gets
--            counted in the member count, added to monthly recurring
--            revenue, and listed for renewal.
--
-- A flag rather than deletion, because a sales demo on a phone in
-- somebody's kitchen is genuinely useful and the data behind it has to be
-- real enough to click through. So it stays, and it is excluded from
-- every number that describes the business.
-- =====================================================================

alter table public.properties
  add column is_demo boolean not null default false;

create index properties_is_demo_idx on public.properties (is_demo) where is_demo;

comment on column public.properties.is_demo is
  'A sales-demo home. Excluded from member counts, MRR and renewals, and '
  'labelled everywhere it appears. Never a paying member.';

-- The seeded Miller Home is the demo, by the fixed uuid the seed uses.
update public.properties
   set is_demo = true
 where id = 'b0000000-0000-4000-8000-000000000001';
