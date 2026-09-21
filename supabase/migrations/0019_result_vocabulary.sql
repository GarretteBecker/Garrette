-- =====================================================================
-- B&M HomeKeeper — 0019 the six results
--
-- Pass / Watch / Fail was a home inspector's vocabulary, and it does not
-- say what happens next. Garrette's program needs the result to carry the
-- action, because the whole promise is "market-ready all year" rather than
-- "nothing is broken today":
--
--   Good                 no current action
--   Maintenance due      routine work recommended
--   Monitor              not failing yet, but track it
--   Repair recommended   plan the repair
--   Safety / urgent      address immediately
--   Specialist review    electrician, plumber, roofer, engineer, WDI…
--
-- PASS is kept and relabelled "Good" rather than replaced, so five
-- years of history does not have to be rewritten to change a word.
--
-- ATTENTION and FAIL stay in the type so old rows still read, but the
-- app stops offering them: "Watch" becomes the new MONITOR, and "Fail"
-- splits into
-- the three results that say what to do about it. MONITOR is a new
-- value here — it existed on finding_status, never on this type.
-- See lib/types/finding-status.ts.
--
-- ⚠ NOT the finding statuses. CLAUDE.md fixes those at GOOD / MONITOR /
-- PLAN / ACTION / IMPROVEMENT and this does not touch them. A checklist
-- result is what a technician saw at one item; a finding is what B&M has
-- decided to tell the member about it. They overlap and they are not the
-- same axis.
--
-- ⚠ ONE STATEMENT PER VALUE, AND NOTHING DOWNSTREAM MAY USE THEM.
-- Same PostgreSQL rule as 0016 and 0017: a new enum value cannot be used
-- in the transaction that adds it, and the bundled scripts may run as one.
-- =====================================================================

alter type public.checklist_result add value if not exists 'MONITOR';
alter type public.checklist_result add value if not exists 'MAINTENANCE_DUE';
alter type public.checklist_result add value if not exists 'REPAIR_RECOMMENDED';
alter type public.checklist_result add value if not exists 'SAFETY_URGENT';
alter type public.checklist_result add value if not exists 'SPECIALIST_REVIEW';
