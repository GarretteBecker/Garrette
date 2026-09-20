-- =====================================================================
-- B&M HomeKeeper — 0013 the facts about the house, and where the
--                       shutoffs are
--
-- The Home Record knew everything about the water heater and almost
-- nothing about the HOUSE. No water source, no sewer type, no service
-- size — and, worst of all, nowhere to record where the main water
-- shutoff is or what it looks like.
--
-- That last one is the whole point. A member standing in two inches of
-- water at 11pm does not need an article about plumbing; they need to be
-- told that their shutoff is in the basement behind the furnace, with a
-- photograph of it. This migration is what makes that possible.
--
-- ⚠ SAFETY. Everything here is reference information captured by a
-- technician on a visit. It is not a substitute for 911, the gas company
-- or an electrician, and the app says so. See docs/emergency-help.md.
--
-- ⚠ CLAUDE.md rule 3 still holds: there is deliberately NO field here for
-- an alarm code, a gate code, a key location or a safe combination. A
-- shutoff location is not a security credential — it is a valve anyone
-- standing in the room can see. A key location is, so it stays out.
-- =====================================================================

create type public.water_source  as enum ('PUBLIC', 'WELL', 'SHARED_WELL', 'OTHER');
create type public.sewer_type    as enum ('PUBLIC', 'SEPTIC', 'MOUND', 'OTHER');
create type public.heating_fuel  as enum ('NATURAL_GAS', 'PROPANE', 'OIL', 'ELECTRIC', 'HEAT_PUMP', 'OTHER');

alter table public.properties
  add column construction_type      text,
  add column exterior_material      text,
  add column roof_material          text,
  add column roof_installed_year    integer,
  add column water_source           public.water_source,
  add column sewer_type             public.sewer_type,
  add column heating_fuel           public.heating_fuel,
  add column electrical_service_amps integer,
  add column stories                numeric(2,1),
  add column basement_type          text;

comment on column public.properties.water_source is
  'Public or well. Changes the emergency advice: a well home loses water '
  'pressure when the power goes out, a public home does not.';

comment on column public.properties.sewer_type is
  'Public or septic. A septic home with a backup needs different advice '
  'and a different trade than a home on a municipal line.';

-- ---------------------------------------------------------------------
-- Safety points: the things you need to find in a hurry.
--
-- A typed table rather than free-text assets, because the emergency
-- screen has to ask a precise question — "where is the WATER MAIN on
-- this property" — and get a reliable answer. A row named "Main Water
-- Shutoff" in a list of 36 assets cannot be looked up; this can.
-- ---------------------------------------------------------------------
create type public.safety_point_kind as enum (
  'WATER_MAIN',          -- the whole-house water shutoff
  'WATER_HEATER_SHUTOFF',
  'GAS_MAIN',
  'OIL_TANK_SHUTOFF',
  'ELECTRICAL_PANEL',    -- main panel / main breaker
  'SUB_PANEL',
  'SUMP_PUMP',
  'MAIN_CLEANOUT',       -- drain access for a backup
  'SEPTIC_ACCESS',
  'WELL_PUMP',
  'FLOOR_DRAIN',
  'OUTSIDE_SPIGOT_SHUTOFF',
  'SMOKE_CO_ALARM',
  'FIRE_EXTINGUISHER',
  'OTHER'
);

create table public.safety_points (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  kind          public.safety_point_kind not null,
  -- What to call it on screen. Blank falls back to a label for the kind.
  label         text,
  room_id       uuid references public.rooms (id)  on delete set null,
  asset_id      uuid references public.assets (id) on delete set null,
  -- "Basement, northeast corner, behind the furnace." Written for somebody
  -- who is frightened and holding a torch.
  location_note text,
  -- "Turn the red handle a quarter turn clockwise until it stops."
  how_to_note   text,
  photo_id      uuid references public.photos (id) on delete set null,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index safety_points_property_id_idx on public.safety_points (property_id);
create index safety_points_kind_idx        on public.safety_points (property_id, kind);

create trigger safety_points_set_updated_at
  before update on public.safety_points
  for each row execute function public.set_updated_at();

comment on table public.safety_points is
  'Shutoffs, panels and access points, captured on a visit so a member can '
  'be told where theirs is when it matters. Reference information only — '
  'never a substitute for 911 or the utility.';

-- A linked room, asset or photo must belong to the same property. Same
-- reasoning as migration 0011: RLS stops anyone READING across a property
-- boundary, but a row captioned with another house's room is its own harm.
create or replace function public.enforce_safety_point_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.property_id = new.property_id
  ) then
    raise exception 'room % is not on property %', new.room_id, new.property_id;
  end if;

  if new.asset_id is not null and not exists (
    select 1 from public.assets a where a.id = new.asset_id and a.property_id = new.property_id
  ) then
    raise exception 'asset % is not on property %', new.asset_id, new.property_id;
  end if;

  if new.photo_id is not null and not exists (
    select 1 from public.photos p where p.id = new.photo_id and p.property_id = new.property_id
  ) then
    raise exception 'photo % is not on property %', new.photo_id, new.property_id;
  end if;

  return new;
end;
$$;

create trigger safety_points_links_same_property
  before insert or update of room_id, asset_id, photo_id, property_id
  on public.safety_points
  for each row execute function public.enforce_safety_point_links();

-- ---------------------------------------------------------------------
-- RLS. Read by anyone who can see the property — INCLUDING the member,
-- on every tier.
--
-- The tier gates priority response, not safety information. Withholding
-- "here is where your water shutoff is" from a paying member because they
-- are on the cheaper plan is not a business model, it is a liability. See
-- docs/emergency-help.md.
-- ---------------------------------------------------------------------
alter table public.safety_points enable row level security;
alter table public.safety_points force row level security;

create policy safety_points_select on public.safety_points
  for select to authenticated
  using (public.can_access_property(property_id));

create policy safety_points_staff_insert on public.safety_points
  for insert to authenticated
  with check (public.can_write_property(property_id));

create policy safety_points_staff_update on public.safety_points
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

create policy safety_points_admin_delete on public.safety_points
  for delete to authenticated
  using (public.is_admin());
