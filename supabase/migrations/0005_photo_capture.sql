-- =====================================================================
-- B&M HomeKeeper — 0005 capture & scan
--
-- Photos become first-class: every photo can carry a note, can be typed
-- (a data plate vs a general shot vs before/after), and can hold the
-- result of a data-plate scan.
--
-- The scan result is stored separately from the asset record on purpose.
-- A scan is a *claim* read off a photo by a model; it only becomes part of
-- the Home Record when a human accepts it (scan_applied_at). That keeps a
-- misread serial number out of the record, and keeps the photo as the
-- evidence behind whatever is in there.
-- =====================================================================

create type public.photo_kind as enum (
  'GENERAL',
  'DATA_PLATE',   -- the placard/nameplate on a piece of equipment
  'DOCUMENT',     -- a page held up to the camera
  'BEFORE',
  'AFTER'
);

create type public.scan_status as enum (
  'NOT_REQUESTED',
  'PENDING',      -- queued; the phone may still be offline
  'DONE',
  'FAILED'
);

alter table public.photos
  add column kind            public.photo_kind  not null default 'GENERAL',
  add column note            text,
  add column scan_status     public.scan_status not null default 'NOT_REQUESTED',
  add column scan_data       jsonb,
  add column scan_error      text,
  add column scan_applied_at timestamptz,
  add column scan_applied_by uuid references public.profiles (id) on delete set null;

create index photos_scan_status_idx on public.photos (scan_status)
  where scan_status = 'PENDING';

create index photos_kind_idx on public.photos (kind);

comment on column public.photos.scan_data is
  'Fields read off a data plate by the vision model. A CLAIM, not a fact: '
  'it is not part of the Home Record until a human accepts it, which sets '
  'scan_applied_at.';

-- Photos are currently insert/update-able by staff only (policies in 0002
-- cover the whole property-scoped set), which is what we want here too:
-- a tech attaches and scans, a member reads.

-- ---------------------------------------------------------------------
-- Keep an asset's own record in step when a scan is accepted.
-- Only fills blanks; never silently overwrites something a human typed.
-- ---------------------------------------------------------------------
create or replace function public.apply_scan_to_asset(
  target_photo_id uuid,
  overwrite boolean default false
)
returns public.assets
language plpgsql
security invoker           -- runs as the caller, so RLS still applies
set search_path = public
as $$
declare
  photo   public.photos;
  data    jsonb;
  result  public.assets;
begin
  select * into photo from public.photos where id = target_photo_id;
  if photo is null then
    raise exception 'Photo not found';
  end if;
  if photo.asset_id is null then
    raise exception 'That photo is not attached to an item';
  end if;
  if photo.scan_data is null then
    raise exception 'That photo has no scan to apply';
  end if;

  data := photo.scan_data;

  update public.assets a
     set manufacturer = case
           when overwrite or a.manufacturer is null
           then coalesce(nullif(data ->> 'manufacturer', ''), a.manufacturer)
           else a.manufacturer end,
         model = case
           when overwrite or a.model is null
           then coalesce(nullif(data ->> 'model', ''), a.model)
           else a.model end,
         serial_number = case
           when overwrite or a.serial_number is null
           then coalesce(nullif(data ->> 'serial_number', ''), a.serial_number)
           else a.serial_number end,
         install_date = case
           when overwrite or a.install_date is null
           then coalesce((nullif(data ->> 'install_date', ''))::date, a.install_date)
           else a.install_date end
   where a.id = photo.asset_id
  returning * into result;

  update public.photos
     set scan_applied_at = now(),
         scan_applied_by = auth.uid()
   where id = target_photo_id;

  return result;
end;
$$;
