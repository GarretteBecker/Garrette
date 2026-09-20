-- =====================================================================
-- B&M HomeKeeper — 0008 member approves or declines an estimate
--
-- Members are read-only on service_requests by design (the staff update
-- policy is the only one), and that stays true. This adds exactly one
-- narrow, audited door instead of widening that policy:
--
--   a member may move THEIR OWN request from AWAITING APPROVAL to APPROVED,
--   or send it back to TRIAGE with a decline note. Nothing else.
--
-- SECURITY DEFINER because the update policy rightly refuses members. Every
-- precondition is re-checked inside, so the elevated privilege cannot be
-- used for anything but this one transition.
-- =====================================================================

create or replace function public.member_respond_to_estimate(
  target_request_id uuid,
  p_approve         boolean,
  p_note            text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req    public.service_requests;
  uid    uuid := auth.uid();
  result public.service_requests;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  -- The caller must be a member OF THIS PROPERTY. Checked directly against
  -- the members table rather than trusting anything passed in.
  if not exists (
    select 1 from public.members m
     where m.property_id = req.property_id
       and m.profile_id = uid
  ) then
    raise exception 'Not your request';
  end if;

  -- Staff have their own controls; this door is for members only, so a
  -- compromised staff session gains nothing here.
  if public.current_user_role() <> 'member' then
    raise exception 'This is the member approval route';
  end if;

  -- Only ever from the one stage where the ball is genuinely with them.
  if req.stage <> 'AWAITING_APPROVAL' then
    raise exception 'This request is not waiting on your approval';
  end if;

  if p_approve then
    update public.service_requests
       set stage = 'APPROVED',
           approved_at = now()
     where id = target_request_id
    returning * into result;

    insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
    values (target_request_id, 'AWAITING_APPROVAL', 'APPROVED',
            coalesce(nullif(btrim(p_note), ''), 'Approved by the homeowner.'), uid);
  else
    -- Back to the office to talk it through. The stage list has no
    -- "declined", and inventing one would put the pipeline out of step with
    -- the brief, so a decline returns it to TRIAGE with the reason attached.
    update public.service_requests
       set stage = 'TRIAGE',
           approved_at = null
     where id = target_request_id
    returning * into result;

    insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
    values (target_request_id, 'AWAITING_APPROVAL', 'TRIAGE',
            'Homeowner declined the estimate'
              || case when coalesce(btrim(p_note), '') <> ''
                      then ': ' || p_note else '.' end,
            uid);
  end if;

  return result;
end;
$$;

comment on function public.member_respond_to_estimate is
  'The only route by which a member may change a request stage. Confined to '
  'AWAITING APPROVAL -> APPROVED or -> TRIAGE, on their own property.';
