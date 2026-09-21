-- =====================================================================
-- B&M HomeKeeper — 0020 core items, and readings instead of ticks
--
-- Two changes, both from Garrette's program spec.
--
-- 1. CORE ITEMS. Some checks never rotate out — life safety, water
--    leaks, moisture, electrical — because fire and water do not wait
--    for the right season. They belong to no quarter and go on every
--    visit. Until now every item belonged to exactly one quarter, so
--    "test the smoke alarms" had to be written four times and edited
--    four times.
--
-- 2. MEASUREMENTS. "Pass" tells a member nothing. A number tells them
--    something, and the same number next to last year's tells them what
--    is happening to their house. A home inspector sees a house once and
--    can never write "your temperature split has gone from 18° to 13°
--    over two years". A quarterly membership can, and that sentence is
--    the argument for the whole product.
--
--    So an item can ask for a reading, with a unit and the healthy band.
--    The visit stores the number, not a tick.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Core items
--
-- quarter stays NOT NULL on the template, so a core item needs somewhere
-- to live. It lives on the quarter it was written on and is flagged to
-- appear on all of them — which also means editing it once changes it
-- everywhere, the whole point.
-- ---------------------------------------------------------------------
alter table public.checklist_template_items
  add column is_core boolean not null default false;

create index checklist_template_items_core_idx
  on public.checklist_template_items (is_core)
  where is_core;

comment on column public.checklist_template_items.is_core is
  'Goes on every visit regardless of season. Fire, water and moisture do '
  'not wait for the right quarter.';

-- ---------------------------------------------------------------------
-- Measurements
--
-- A band rather than a pass mark. Outside it is not automatically a
-- failure — it is the technician''s prompt to look harder, and the
-- report''s reason to say something.
-- ---------------------------------------------------------------------
alter table public.checklist_template_items
  add column measurement_label text,
  add column measurement_unit  text,
  add column measurement_low   numeric(10,2),
  add column measurement_high  numeric(10,2);

comment on column public.checklist_template_items.measurement_unit is
  'Set this and the item asks for a number instead of a tick. Free text '
  'so the office is never blocked waiting for a unit to be added in code '
  '— °F, ppm, psi, %, A, pCi/L, in. w.c., mm.';

-- What the technician actually recorded, stamped alongside the item so
-- the visit owns its own history exactly as it owns the labels.
alter table public.checklist_items
  add column measurement_label text,
  add column measurement_unit  text,
  add column measurement_low   numeric(10,2),
  add column measurement_high  numeric(10,2),
  add column measurement_value numeric(10,2);

comment on column public.checklist_items.measurement_value is
  'The reading. The band is copied alongside it so a report written in '
  '2030 knows what counted as healthy in 2026.';
