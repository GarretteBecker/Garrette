-- =====================================================================
-- RLS verification — proves CLAUDE.md rule 2 rather than asserting it.
--
-- HOW TO RUN: paste into the Supabase SQL Editor and hit Run, after the
-- migrations and seed. It is read-only in effect: every write it attempts
-- is rolled back, and the extra test property it creates is removed at the
-- end.
--
-- WHAT YOU SHOULD SEE: every "leak" count is 0, and the three attempts
-- marked MUST FAIL raise an error. An error from those is the test passing.
--
-- All of these were run against PostgreSQL 16 during the initial build and
-- passed. Re-run this any time you change a policy in 0002_rls.sql.
-- =====================================================================

-- A second property the Miller member must never be able to see.
insert into public.properties (id, name, address_line1, city, state, postal_code)
values ('b0000000-0000-4000-8000-0000000000ff', 'RLS TEST — Hershey Home', '9 Chocolate Ave', 'Hershey', 'PA', '17033')
on conflict (id) do nothing;

insert into public.rooms (id, property_id, name)
values ('d0000000-0000-4000-8000-0000000000ff', 'b0000000-0000-4000-8000-0000000000ff', 'RLS TEST — Secret Kitchen')
on conflict (id) do nothing;

insert into public.findings (id, property_id, status, title)
values ('22220000-0000-4000-8000-0000000000ff', 'b0000000-0000-4000-8000-0000000000ff', 'ACTION', 'RLS TEST — PRIVATE FINDING')
on conflict (id) do nothing;

insert into public.assets (id, property_id, category, name)
values ('e0000000-0000-4000-8000-0000000000ff', 'b0000000-0000-4000-8000-0000000000ff', 'HVAC', 'RLS TEST — PRIVATE FURNACE')
on conflict (id) do nothing;

-- An unreleased draft report on the Miller home.
insert into public.reports (id, property_id, title, report_type, status)
values ('66660000-0000-4000-8000-0000000000ff', 'b0000000-0000-4000-8000-000000000001',
        'RLS TEST — UNRELEASED DRAFT', 'VISIT_SUMMARY', 'DRAFT')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- TEST 1 — member sees only their own property
-- Expected: 1 property, every leak count 0
-- ---------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';

  select 'T1 properties visible (expect 1)'      as check, count(*) as n from public.properties;
  select 'T1 finding leak (expect 0)'            as check, count(*) as n from public.findings where title like 'RLS TEST%';
  select 'T1 asset leak (expect 0)'              as check, count(*) as n from public.assets   where name  like 'RLS TEST%';
  select 'T1 room leak (expect 0)'               as check, count(*) as n from public.rooms    where name  like 'RLS TEST%';
  select 'T1 unreleased draft leak (expect 0)'   as check, count(*) as n from public.reports  where title like 'RLS TEST%';
commit;

-- ---------------------------------------------------------------------
-- TEST 2 — tech sees only assigned properties, but does see drafts
-- ---------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';

  select 'T2 properties visible (expect 1)'      as check, count(*) as n from public.properties;
  select 'T2 finding leak (expect 0)'            as check, count(*) as n from public.findings where title like 'RLS TEST%';
  select 'T2 draft visible to staff (expect 1)'  as check, count(*) as n from public.reports  where title like 'RLS TEST%';
commit;

-- ---------------------------------------------------------------------
-- TEST 3 — admin sees everything
-- ---------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

  select 'T3 properties visible (expect 2)'      as check, count(*) as n from public.properties;
  select 'T3 test finding visible (expect 1)'    as check, count(*) as n from public.findings where title like 'RLS TEST%';
commit;

-- ---------------------------------------------------------------------
-- TEST 4 — anonymous sees nothing
-- ---------------------------------------------------------------------
begin;
  set local role anon;
  select 'T4 properties (expect 0)' as check, count(*) as n from public.properties;
  select 'T4 findings (expect 0)'   as check, count(*) as n from public.findings;
  select 'T4 assets (expect 0)'     as check, count(*) as n from public.assets;
commit;

-- ---------------------------------------------------------------------
-- TEST 5 — member cannot delete or escalate
-- Expected: 0 rows deletable
-- ---------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
  with d as (
    delete from public.findings
     where property_id = 'b0000000-0000-4000-8000-000000000001'
    returning 1
  )
  select 'T5 rows a tech can delete (expect 0)' as check, count(*) as n from d;
rollback;

-- ---------------------------------------------------------------------
-- TEST 6 — member cannot edit another user's profile
-- Expected: 0 rows changed
-- ---------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';
  with u as (
    update public.profiles set full_name = 'SHOULD NOT HAPPEN'
     where id = 'a0000000-0000-4000-8000-000000000001'
    returning 1
  )
  select 'T6 other profiles changed (expect 0)' as check, count(*) as n from u;
rollback;

-- =====================================================================
-- The three below MUST raise an error. Run each on its own — an error is
-- the test PASSING, and it will abort the rest of the script.
-- =====================================================================

-- MUST FAIL — member writing a finding (members are read-only):
--   begin;
--     set local role authenticated;
--     set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';
--     insert into public.findings (property_id, status, title)
--     values ('b0000000-0000-4000-8000-000000000001', 'ACTION', 'nope');
--   rollback;

-- MUST FAIL — tech writing to an unassigned property:
--   begin;
--     set local role authenticated;
--     set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
--     insert into public.findings (property_id, status, title)
--     values ('b0000000-0000-4000-8000-0000000000ff', 'ACTION', 'nope');
--   rollback;

-- MUST FAIL — member promoting themselves to admin:
--   begin;
--     set local role authenticated;
--     set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';
--     update public.profiles set role = 'admin' where id = auth.uid();
--   rollback;

-- ---------------------------------------------------------------------
-- Clean up the test fixtures.
-- ---------------------------------------------------------------------
delete from public.reports    where id = '66660000-0000-4000-8000-0000000000ff';
delete from public.findings   where id = '22220000-0000-4000-8000-0000000000ff';
delete from public.assets     where id = 'e0000000-0000-4000-8000-0000000000ff';
delete from public.rooms      where id = 'd0000000-0000-4000-8000-0000000000ff';
delete from public.properties where id = 'b0000000-0000-4000-8000-0000000000ff';
