-- =====================================================================
-- B&M HomeKeeper — 0002 Row Level Security
--
-- CLAUDE.md rule 2: "Members can never see another property's data.
-- Enforce with RLS, not just UI."
--
-- Model: RLS is ON for every table with a deny-by-default posture (no
-- policy = no access). Access is granted per role:
--   admin  — everything
--   tech   — only properties they are assigned to (public.property_techs)
--   member — only properties they are linked to (public.members), read-only
--            except for raising service requests
--   trade  — only the service requests dispatched to their company
--
-- The helper functions are SECURITY DEFINER so they can read profiles /
-- members / property_techs without tripping the policies on those same
-- tables (which would recurse infinitely).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- Can the current user SEE this property at all?
create or replace function public.can_access_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
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

-- Can the current user CHANGE data on this property?
-- Members are read-only on the Home Record; only staff write.
create or replace function public.can_write_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'tech' then exists (
      select 1 from public.property_techs pt
      where pt.property_id = target_property_id
        and pt.profile_id = auth.uid()
    )
    else false
  end
$$;

-- Is the current user the trade partner on this service request?
create or replace function public.is_trade_for_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    join public.trade_partners tp on tp.id = sr.trade_partner_id
    where sr.id = target_request_id
      and tp.profile_id = auth.uid()
      and tp.is_active
  )
$$;

-- The property a visit belongs to (used by checklist_items).
create or replace function public.visit_property_id(target_visit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select property_id from public.visits where id = target_visit_id
$$;

-- ---------------------------------------------------------------------
-- Turn RLS on everywhere. No table is exempt.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'properties', 'members', 'property_techs', 'trade_partners',
    'rooms', 'assets', 'visits', 'checklist_items', 'findings', 'plan_items',
    'service_requests', 'service_request_events', 'documents', 'photos', 'reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Staff names are effectively a company directory: a member is allowed to
-- know which B&M technician is coming to their house.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (role in ('admin', 'tech'));

-- A tech may see the profiles of members on properties they are assigned to.
create policy profiles_select_assigned_members on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'tech'
    and exists (
      select 1
      from public.members m
      join public.property_techs pt on pt.property_id = m.property_id
      where m.profile_id = public.profiles.id
        and pt.profile_id = auth.uid()
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Belt and braces: a user cannot promote themselves. Even though
-- profiles_update_self allows the row through, this trigger rejects any
-- role change that was not made by an admin.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin may change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------

create policy properties_select on public.properties
  for select to authenticated
  using (public.can_access_property(id));

create policy properties_admin_write on public.properties
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Techs may correct property details on their assigned properties, but may
-- not create or delete properties.
create policy properties_tech_update on public.properties
  for update to authenticated
  using (public.can_write_property(id))
  with check (public.can_write_property(id));

-- ---------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------

create policy members_select on public.members
  for select to authenticated
  using (public.can_access_property(property_id));

create policy members_admin_write on public.members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- property_techs — assignment table, admin-managed
-- ---------------------------------------------------------------------

create policy property_techs_select_self on public.property_techs
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy property_techs_admin_write on public.property_techs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- trade_partners — staff see the roster; a trade sees only itself
-- ---------------------------------------------------------------------

create policy trade_partners_select_staff on public.trade_partners
  for select to authenticated
  using (public.current_user_role() in ('admin', 'tech'));

create policy trade_partners_select_self on public.trade_partners
  for select to authenticated
  using (profile_id = auth.uid());

create policy trade_partners_admin_write on public.trade_partners
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Property-scoped tables: rooms, assets, visits, findings, plan_items,
-- documents, photos, reports
-- Read = anyone who can access the property (incl. the member).
-- Write = staff only (admin, or tech assigned to that property).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'rooms', 'assets', 'visits', 'findings', 'plan_items',
    'documents', 'photos', 'reports'
  ]
  loop
    execute format(
      'create policy %I_select on public.%I
         for select to authenticated
         using (public.can_access_property(property_id))', t, t);

    execute format(
      'create policy %I_staff_insert on public.%I
         for insert to authenticated
         with check (public.can_write_property(property_id))', t, t);

    execute format(
      'create policy %I_staff_update on public.%I
         for update to authenticated
         using (public.can_write_property(property_id))
         with check (public.can_write_property(property_id))', t, t);

    -- Deletes are admin-only: a tech should not be able to erase history.
    execute format(
      'create policy %I_admin_delete on public.%I
         for delete to authenticated
         using (public.is_admin())', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- checklist_items — scoped through the parent visit
-- ---------------------------------------------------------------------

create policy checklist_items_select on public.checklist_items
  for select to authenticated
  using (public.can_access_property(public.visit_property_id(visit_id)));

create policy checklist_items_staff_insert on public.checklist_items
  for insert to authenticated
  with check (public.can_write_property(public.visit_property_id(visit_id)));

create policy checklist_items_staff_update on public.checklist_items
  for update to authenticated
  using (public.can_write_property(public.visit_property_id(visit_id)))
  with check (public.can_write_property(public.visit_property_id(visit_id)));

create policy checklist_items_admin_delete on public.checklist_items
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- service_requests
-- Members may RAISE a request on their own property and may see their own.
-- Staff manage them. A trade partner sees only what was dispatched to them.
-- ---------------------------------------------------------------------

create policy service_requests_select on public.service_requests
  for select to authenticated
  using (
    public.can_access_property(property_id)
    or public.is_trade_for_request(id)
  );

-- A member can open a request, but only against their own property.
create policy service_requests_member_insert on public.service_requests
  for insert to authenticated
  with check (
    public.can_access_property(property_id)
    and (
      public.can_write_property(property_id)          -- staff
      or public.current_user_role() = 'member'        -- homeowner
    )
  );

create policy service_requests_staff_update on public.service_requests
  for update to authenticated
  using (public.can_write_property(property_id))
  with check (public.can_write_property(property_id));

-- A trade partner may move their own dispatched job along.
create policy service_requests_trade_update on public.service_requests
  for update to authenticated
  using (public.is_trade_for_request(id))
  with check (public.is_trade_for_request(id));

create policy service_requests_admin_delete on public.service_requests
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- service_request_events — stage history
-- ---------------------------------------------------------------------

create policy service_request_events_select on public.service_request_events
  for select to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (public.can_access_property(sr.property_id)
             or public.is_trade_for_request(sr.id))
    )
  );

create policy service_request_events_insert on public.service_request_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (public.can_write_property(sr.property_id)
             or public.is_trade_for_request(sr.id))
    )
  );

create policy service_request_events_admin_delete on public.service_request_events
  for delete to authenticated
  using (public.is_admin());
