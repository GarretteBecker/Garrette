-- =====================================================================
-- B&M HomeKeeper — 0022 what the office can do, and invite-only access
--
-- Three things:
--   1. Give 'ops' the right reach: every property, everything operational,
--      nothing to do with money or accounts.
--   2. Make sign-up invite-only, enforced in the database rather than by
--      a checkbox in a dashboard somebody can untick.
--   3. Certificates of insurance on trade partners, because an expired
--      COI on a partner working in a member's home is B&M's problem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The office
--
-- is_staff() is the new "anyone who works here" test. is_admin() keeps
-- meaning the owner alone, and every policy that guards pricing,
-- membership terms, user accounts or the checklist standard keeps using
-- it — so adding ops widens nothing it should not.
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- ::text on purpose. Comparing against an enum LITERAL would make this
  -- function unusable in the same transaction that added 'ops' — and the
  -- catch-up script runs as one transaction. Casting to text sidesteps the
  -- literal entirely, so 0021 and this file can apply together.
  select coalesce(public.current_user_role()::text in ('admin', 'ops'), false)
$$;

comment on function public.is_staff is
  'Owner or office. NOT the same as is_admin, which stays owner-only and '
  'still guards pricing, membership terms and user accounts.';

-- The office sees every property, same as the owner. A tech still sees
-- only what they are assigned; a member still sees only their own home.
create or replace function public.can_access_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()::text   -- ::text: see is_staff above
    when 'admin' then true
    when 'ops' then true
    when 'tech' then exists (
      select 1 from public.property_techs pt
      where pt.property_id = target_property_id
        and pt.profile_id = auth.uid()
    )
    when 'member' then exists (
      select 1 from public.members m
      where m.property_id = target_property_id
        and m.profile_id = auth.uid()
    )
    else false
  end
$$;

-- The office writes the Home Record, books visits, runs requests.
create or replace function public.can_write_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()::text   -- ::text: see is_staff above
    when 'admin' then true
    when 'ops' then true
    when 'tech' then exists (
      select 1 from public.property_techs pt
      where pt.property_id = target_property_id
        and pt.profile_id = auth.uid()
    )
    else false
  end
$$;

-- Creating and deleting properties is still the owner's alone; the office
-- edits the ones that exist through can_write_property above.
-- (properties_admin_write is unchanged on purpose.)

-- The office needs the staff directory to assign visits, and needs to see
-- members to run the office. It does NOT get profiles_admin_write, so it
-- cannot change anybody's role.
drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (role::text in ('admin', 'ops', 'tech') or public.is_staff());

-- Trade partners: the office maintains the bench, the owner still owns
-- who is on it. The original select policy named admin and tech only, so
-- an ops user saw an empty trade board — they could dispatch to nobody.
drop policy if exists trade_partners_select_staff on public.trade_partners;
create policy trade_partners_select_staff on public.trade_partners
  for select to authenticated
  using (public.current_user_role()::text in ('admin', 'ops', 'tech'));

drop policy if exists trade_partners_staff_update on public.trade_partners;
create policy trade_partners_staff_update on public.trade_partners
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists trade_coverage_ops_write on public.trade_coverage;
create policy trade_coverage_ops_write on public.trade_coverage
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 2. Invite only
--
-- A row here is permission to exist. handle_new_user refuses any sign-up
-- whose email has no unexpired invite, which means invite-only survives
-- somebody toggling "allow signups" in the Supabase dashboard, and
-- survives anyone finding the public anon key — which is public by design.
--
-- The role comes from THIS table, written by an admin, never from the
-- sign-up metadata. That was the 0007 lesson and it still holds: metadata
-- is attacker-controlled.
-- ---------------------------------------------------------------------
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  role         public.user_role not null,
  -- For a member invite: the home they are being given access to.
  property_id  uuid references public.properties (id) on delete cascade,
  full_name    text,
  note         text,
  invited_by   uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Email is the identity here, so normalise it. Two invites for the same
-- person with different roles is an argument nobody wants to have at 8am.
create unique index invites_email_open_idx
  on public.invites (lower(email))
  where accepted_at is null;

create index invites_email_idx on public.invites (lower(email));

comment on table public.invites is
  'Permission to create an account. handle_new_user refuses any sign-up '
  'without an unexpired row here, so access is invite-only in the '
  'database rather than by a dashboard setting.';

alter table public.invites enable row level security;
alter table public.invites force  row level security;

-- Only the owner invites. The office can see who is outstanding.
create policy invites_select_staff on public.invites
  for select to authenticated using (public.is_staff());

create policy invites_admin_write on public.invites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv
    from public.invites
   where lower(email) = lower(new.email)
     and accepted_at is null
     and expires_at > now()
   order by created_at desc
   limit 1;

  -- No invite, no account. This is the whole of "no public signup": it
  -- holds whatever the dashboard says and whoever has the anon key.
  if inv.id is null then
    raise exception 'This email has not been invited to B&M HomeKeeper.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The role comes from the invite, written by an admin — never from
  -- new.raw_user_meta_data, which the person signing up controls.
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    inv.role,
    coalesce(inv.full_name, new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  -- A member invite also links them to their home, so they land on their
  -- own Home Record rather than an empty portal.
  if inv.role = 'member' and inv.property_id is not null then
    update public.members
       set profile_id = new.id
     where property_id = inv.property_id
       and profile_id is null
       and lower(coalesce(email, '')) = lower(new.email);
  end if;

  update public.invites set accepted_at = now() where id = inv.id;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Invite-only. Refuses any sign-up with no unexpired invite, and takes '
  'the role from the invite rather than from client-supplied metadata.';

-- ---------------------------------------------------------------------
-- 3. Certificates of insurance
--
-- An expired COI on a partner standing in a member''s kitchen is B&M''s
-- problem, not theirs. Recording the date is what makes it visible before
-- it matters.
-- ---------------------------------------------------------------------
alter table public.trade_partners
  add column coi_expires        date,
  add column coi_carrier        text,
  add column workers_comp_expires date;

comment on column public.trade_partners.coi_expires is
  'General liability certificate expiry. Surfaced on the trade board so an '
  'expired partner is obvious before they are dispatched, not after.';
