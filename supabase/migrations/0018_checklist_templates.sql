-- =====================================================================
-- B&M HomeKeeper — 0018 the seasonal checklists, editable by you
--
-- The Q1–Q4 lists have lived in a TypeScript file since the first build.
-- That was always wrong for this product: Garrette is the one who knows
-- what B&M checks, and every change to a list has meant a code change by
-- somebody else. A checklist you cannot edit is somebody else's checklist.
--
-- So the lists move into the database, with a screen to write them on.
--
-- ⚠ NOTHING IS SEEDED HERE ON PURPOSE. Until a quarter has an active
-- template with items, the app keeps using the built-in draft in
-- lib/checklist-templates.ts exactly as it does today — so this migration
-- changes no behaviour on its own. The admin screen has a "start from the
-- built-in list" button that copies that draft in as a starting point to
-- mark up. One source of truth for the draft, and it stays in one place.
-- =====================================================================

create type public.quarter as enum ('Q1', 'Q2', 'Q3', 'Q4');

create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  quarter     public.quarter not null,
  -- What the visit is called on the calendar and on the report.
  name        text not null,
  season      text not null,
  months      text not null,
  -- One line on why this quarter looks the way it does. It prints on the
  -- report, so a member can see the visit had a point.
  focus       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One live list per quarter. Older ones can be kept, deactivated, for the
-- record — a report from 2026 should still be explainable in 2029.
create unique index checklist_templates_one_active_per_quarter
  on public.checklist_templates (quarter)
  where is_active;

create table public.checklist_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  category     text not null,
  label        text not null,
  -- What "good" looks like, for a technician who has not done this one
  -- before. Shows on the field screen, never on the member's report.
  help_note    text,
  sort_order   integer not null default 0,

  -- Only put this item on the list when the house matches. NULL means
  -- every house. A septic item on a public-sewer home is noise, and noise
  -- is how a checklist stops being read.
  only_water_source public.water_source[],
  only_sewer_type   public.sewer_type[],
  only_heating_fuel public.heating_fuel[],

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index checklist_template_items_template_idx
  on public.checklist_template_items (template_id, sort_order);

create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

create trigger checklist_template_items_set_updated_at
  before update on public.checklist_template_items
  for each row execute function public.set_updated_at();

comment on table public.checklist_templates is
  'The seasonal visit lists, owned and edited by the office rather than by '
  'a developer. Until a quarter has an active row with items, the app uses '
  'the built-in draft in lib/checklist-templates.ts.';

comment on column public.checklist_template_items.only_sewer_type is
  'Restricts the item to matching houses. NULL means every house. Keeps a '
  'septic item off a public-sewer list — a checklist with items that do not '
  'apply is a checklist people stop reading.';

-- ---------------------------------------------------------------------
-- RLS.
--
-- Readable by everyone signed in, including members. "Here is exactly what
-- we check, every quarter" is the product — it is not property data, and
-- there is nothing about one member's home in it.
--
-- Written by admin only. A tech changing the standard mid-visit is not a
-- feature; a tech logging a finding is.
-- ---------------------------------------------------------------------
alter table public.checklist_templates       enable row level security;
alter table public.checklist_templates       force  row level security;
alter table public.checklist_template_items  enable row level security;
alter table public.checklist_template_items  force  row level security;

create policy checklist_templates_select on public.checklist_templates
  for select to authenticated using (true);

create policy checklist_templates_admin_write on public.checklist_templates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated using (true);

create policy checklist_template_items_admin_write on public.checklist_template_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- The note travels with the visit, not just with the template.
--
-- A visit takes its own copy of the list when it starts, and it has to
-- keep the whole thing — including the "what good looks like" note. The
-- field app works offline off the stamped rows, and a report written in
-- 2029 should be explainable by what the technician was actually shown in
-- 2026, not by whatever the template says by then.
--
-- Member-facing screens never render this column. It is written for a
-- technician, in a technician's voice.
-- ---------------------------------------------------------------------
alter table public.checklist_items
  add column help_note text;

comment on column public.checklist_items.help_note is
  'Copied from the template when the visit starts. Field app only — never '
  'shown to a member.';
