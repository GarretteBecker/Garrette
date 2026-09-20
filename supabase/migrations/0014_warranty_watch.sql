-- =====================================================================
-- B&M HomeKeeper — 0014 warranty watch
--
-- The app has stored a warranty expiry date on every Home Record item
-- since day one and never once used it. That is money sitting on the
-- floor: a member whose water heater fails ten weeks after the warranty
-- quietly lapsed paid for a tank they did not have to.
--
-- So: tell them before it ends. "Your water heater's warranty ends in 60
-- days — want us to look at it while it is still covered?" That message
-- costs nothing to send, can save a member two thousand dollars, and is
-- the most concrete possible answer to "what am I paying you for?"
--
-- This migration adds the RECORD of having told them. The dates were
-- already there; what was missing was memory — so the app does not nag a
-- member who has already said no, and the office can see who has been
-- spoken to and who has not.
-- =====================================================================

create type public.warranty_response as enum (
  'PENDING',   -- we have told them, they have not said
  'WANTS',     -- they asked us to look at it
  'DECLINED'   -- they said no thanks; stop asking about this one
);

create table public.warranty_notices (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties (id) on delete cascade,
  asset_id           uuid not null references public.assets (id) on delete cascade,

  -- The date we actually warned about, not a live lookup. If the expiry is
  -- later corrected, this still records what the member was told and when —
  -- and a genuinely new warranty period gets its own notice rather than
  -- being silenced by an old one.
  warranty_expires   date not null,

  notified_at        timestamptz,
  notified_method    public.notice_method,
  notified_by        uuid references public.profiles (id) on delete set null,

  response           public.warranty_response not null default 'PENDING',
  responded_at       timestamptz,
  service_request_id uuid references public.service_requests (id) on delete set null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- One notice per item per warranty period.
  unique (asset_id, warranty_expires)
);

create index warranty_notices_property_id_idx on public.warranty_notices (property_id);
create index warranty_notices_asset_id_idx    on public.warranty_notices (asset_id);

create trigger warranty_notices_set_updated_at
  before update on public.warranty_notices
  for each row execute function public.set_updated_at();

comment on table public.warranty_notices is
  'Memory for warranty watch: who we told, when, and what they said. Without '
  'it the app would either nag a member who already declined or forget it '
  'ever spoke to them.';

-- The asset must be on the same property. Same reasoning as 0011 and 0013.
create or replace function public.enforce_warranty_notice_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.assets a
     where a.id = new.asset_id and a.property_id = new.property_id
  ) then
    raise exception 'asset % is not on property %', new.asset_id, new.property_id;
  end if;
  return new;
end;
$$;

create trigger warranty_notices_links_same_property
  before insert or update of asset_id, property_id on public.warranty_notices
  for each row execute function public.enforce_warranty_notice_links();

-- ---------------------------------------------------------------------
-- RLS. A member reads their own and may decline through the function
-- below; everything else is staff.
-- ---------------------------------------------------------------------
alter table public.warranty_notices enable row level security;
alter table public.warranty_notices force row level security;

create policy warranty_notices_select on public.warranty_notices
  for select to authenticated
  using (public.can_access_property(property_id));

create policy warranty_notices_staff_insert on public.warranty_notices
  for insert to authenticated
  with check (public.can_write_property(property_id));

create policy warranty_notices_staff_update on public.warranty_notices
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

create policy warranty_notices_admin_delete on public.warranty_notices
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- "No thanks."
--
-- A member saying no must actually stop the asking, and must not need a
-- phone call to do it. Same narrow SECURITY DEFINER pattern as estimate
-- approval: re-checks the caller, the property and the item.
-- ---------------------------------------------------------------------
create or replace function public.member_decline_warranty(
  target_asset_id uuid
)
returns public.warranty_notices
language plpgsql
security definer
set search_path = public
as $$
declare
  a      public.assets;
  result public.warranty_notices;
begin
  select * into a from public.assets where id = target_asset_id;
  if not found then
    raise exception 'item not found';
  end if;

  if not public.can_access_property(a.property_id) then
    raise exception 'not your item';
  end if;

  if public.current_user_role() <> 'member' then
    raise exception 'only the homeowner can use this route';
  end if;

  if a.warranty_expires is null then
    raise exception 'that item has no warranty date recorded';
  end if;

  insert into public.warranty_notices
    (property_id, asset_id, warranty_expires, response, responded_at)
  values
    (a.property_id, target_asset_id, a.warranty_expires, 'DECLINED', now())
  on conflict (asset_id, warranty_expires) do update
    set response = 'DECLINED', responded_at = now()
  returning * into result;

  return result;
end;
$$;

comment on function public.member_decline_warranty is
  'The homeowner says no thanks to a warranty reminder, from their own '
  'phone. Stops that item being raised again for that warranty period.';

-- ---------------------------------------------------------------------
-- The office worklist.
--
-- Items whose warranty is running out and where nobody has been told, or
-- was told and has not answered. Sorted by how little time is left, so
-- the top of the list is the one that costs somebody money first.
--
-- "Lifetime" warranties (the far-future dates manufacturers like Delta
-- actually use) are excluded — matching warrantyInfo() in the app, which
-- treats anything from 2090 on as lifetime.
-- ---------------------------------------------------------------------
create or replace view public.warranty_watch
with (security_invoker = true) as
  select
    a.id                as asset_id,
    a.property_id,
    p.name              as property_name,
    a.name              as asset_name,
    a.manufacturer,
    a.model,
    a.serial_number,
    a.warranty_expires,
    (a.warranty_expires - (now() at time zone 'America/New_York')::date) as days_left,
    n.id                as notice_id,
    n.notified_at,
    n.response
  from public.assets a
  join public.properties p on p.id = a.property_id
  left join public.warranty_notices n
         on n.asset_id = a.id and n.warranty_expires = a.warranty_expires
  where a.warranty_expires is not null
    and extract(year from a.warranty_expires) < 2090
    and a.warranty_expires >= (now() at time zone 'America/New_York')::date
    and a.warranty_expires <= (now() at time zone 'America/New_York')::date + 120
    and coalesce(n.response, 'PENDING') <> 'DECLINED'
  order by a.warranty_expires;

comment on view public.warranty_watch is
  'Items coming out of warranty within 120 days that the member has not '
  'declined. 120 matches warrantyInfo() in lib/member/portal.ts — one '
  'definition of "ending soon", not two.';
