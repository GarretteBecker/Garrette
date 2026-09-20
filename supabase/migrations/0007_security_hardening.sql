-- =====================================================================
-- B&M HomeKeeper — 0007 security hardening
--
-- Fixes found by the audit in SECURITY-REVIEW.md. Run this before any real
-- customer data goes in.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CRITICAL — privilege escalation through signup metadata.
--
-- handle_new_user trusted `raw_user_meta_data->>'role'`. That field is set
-- by whoever calls the signup endpoint, so anyone holding the (public,
-- by-design) anon key could call
--
--     supabase.auth.signUp({ email, password,
--                            options: { data: { role: 'admin' } } })
--
-- and land an admin profile — which reads every property. Verified
-- exploitable against a local build of this schema.
--
-- The fix: a new user is ALWAYS a member. Roles are granted afterwards by
-- an admin, which prevent_role_escalation already restricts.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deliberately ignores any role supplied in user metadata: that value is
  -- attacker-controlled. Least privilege on the way in; an admin promotes
  -- from the profiles table afterwards.
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'member',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates the profile for a new auth user. Always role=member — never trust '
  'a role from signup metadata, it is client-supplied.';

-- ---------------------------------------------------------------------
-- MEDIUM — a member could forge fields on a request they submit.
--
-- The insert policy checked the property but not the columns, so a member
-- could POST a row already marked APPROVED, with an estimate, a trade
-- partner and a completion write-up. No cross-property leak, but it puts
-- false history in the office's board.
--
-- Staff inserts are untouched.
-- ---------------------------------------------------------------------
create or replace function public.force_member_request_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'member' then
    new.stage                := 'NEW';
    new.estimate_amount      := null;
    new.approved_at          := null;
    new.scheduled_for        := null;
    new.completed_at         := null;
    new.closed_at            := null;
    new.trade_partner_id     := null;
    new.assigned_tech_id     := null;
    new.work_performed       := null;
    new.parts_used           := null;
    new.completion_model     := null;
    new.completion_serial    := null;
    new.completion_condition := null;
    new.completed_by         := null;
    new.record_updated_at    := null;
    -- The request is theirs, whatever they claimed.
    new.created_by           := auth.uid();
  end if;
  return new;
end;
$$;

create trigger service_requests_member_defaults
  before insert on public.service_requests
  for each row execute function public.force_member_request_defaults();

-- ---------------------------------------------------------------------
-- BUG — a member-raised request had no history.
--
-- The events policy is staff/trade only (correct: a member must not be able
-- to write their own stage history). But the app tried to insert the opening
-- "Submitted through the member portal" event as the member, which RLS
-- silently refused, leaving the member's own timeline empty.
--
-- The opening event is now written by the database itself, so it is always
-- present and never forgeable.
-- ---------------------------------------------------------------------
create or replace function public.log_service_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    new.id,
    null,
    new.stage,
    case when public.current_user_role() = 'member'
         then 'Submitted through the member portal.'
         else 'Raised by the office.' end,
    auth.uid()
  );
  return new;
end;
$$;

create trigger service_requests_log_created
  after insert on public.service_requests
  for each row execute function public.log_service_request_created();

-- ---------------------------------------------------------------------
-- HARDENING — pin search_path on the two remaining functions that lacked
-- it. Neither is SECURITY DEFINER so the risk was low, but a function
-- without a pinned search_path is a loose end in a security review.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.storage_property_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  return first_segment::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Follow-on from the above.
--
-- Making handle_new_user always create a member means the seed (and any
-- admin setting up staff accounts from the SQL editor) must be able to set
-- a role. prevent_role_escalation was blocking that, because a SQL-editor
-- session has no auth.uid() and therefore is not "an admin".
--
-- A null auth.uid() means the statement is NOT an end-user request: it is a
-- migration, the SQL editor, or a service-role job — all of which already
-- bypass RLS entirely, so this trigger was never the control protecting
-- them. Every request that comes through the app carries a uid, and those
-- still have to be an admin.
-- ---------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null      -- a real signed-in request
     and not public.is_admin()
  then
    raise exception 'Only an admin may change a user role';
  end if;
  return new;
end;
$$;
