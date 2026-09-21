-- =====================================================================
-- B&M HomeKeeper — 0021 the office
--
-- Until now there were four roles: admin, tech, member, trade. Everyone
-- in the office had to be an admin, which meant the person booking visits
-- also had the keys to pricing, membership terms and staff accounts.
--
-- "ops" is the office: members, scheduling, the request board, reports,
-- trade partners. Not pricing. Not user accounts. Not the checklists.
--
-- ⚠ ONE STATEMENT, ON PURPOSE. Same PostgreSQL rule as 0016, 0017 and
-- 0019: a new enum value cannot be USED in the transaction that adds it,
-- and the bundled scripts may run as one. Every function and policy that
-- mentions 'ops' is in 0022, which runs after this has committed.
-- =====================================================================

alter type public.user_role add value if not exists 'ops';
