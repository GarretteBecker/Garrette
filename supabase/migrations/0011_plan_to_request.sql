-- =====================================================================
-- B&M HomeKeeper — 0011 the Home Plan becomes actionable
--
-- The Home Plan told a member what we recommend and roughly what it costs,
-- and then stopped. There was no way to say yes to any of it.
--
-- The member's button is "Get me a price", not "Approve": a plan item
-- carries a RANGE, and approving a range is not an approval — it is an
-- argument about the final invoice, deferred. So the button opens an
-- ordinary service request, pre-filled from the recommendation, and the
-- existing pipeline takes it from there: we price it firmly, they approve
-- that firm number with their member discount on it, we book it, we do it.
--
-- No new permission is opened. A member could already raise a request on
-- their own property, and force_member_request_defaults() already strips
-- anything they should not be setting.
-- =====================================================================

alter table public.service_requests
  add column finding_id   uuid references public.findings (id)   on delete set null,
  add column plan_item_id uuid references public.plan_items (id) on delete set null;

create index service_requests_finding_id_idx   on public.service_requests (finding_id);
create index service_requests_plan_item_id_idx on public.service_requests (plan_item_id);

comment on column public.service_requests.finding_id is
  'Set when this job came off the Home Plan. Completing the job resolves the '
  'finding, so the plan does not keep recommending work that is already done.';

-- ---------------------------------------------------------------------
-- A link must not cross a property boundary.
--
-- RLS already confines the request itself to the caller's own property, but
-- nothing stopped a hand-crafted insert naming another property's finding.
-- Nobody could READ that finding, so this is integrity rather than a leak —
-- but a request captioned with someone else's finding on our board is its
-- own kind of harm, and rule 2 says the database settles this, not the form.
-- ---------------------------------------------------------------------
create or replace function public.enforce_request_links_same_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finding_id is not null
     and not exists (
       select 1 from public.findings f
        where f.id = new.finding_id and f.property_id = new.property_id
     ) then
    raise exception 'finding % is not on property %', new.finding_id, new.property_id;
  end if;

  if new.plan_item_id is not null
     and not exists (
       select 1 from public.plan_items p
        where p.id = new.plan_item_id and p.property_id = new.property_id
     ) then
    raise exception 'plan item % is not on property %', new.plan_item_id, new.property_id;
  end if;

  return new;
end;
$$;

create trigger service_requests_links_same_property
  before insert or update of finding_id, plan_item_id, property_id
  on public.service_requests
  for each row execute function public.enforce_request_links_same_property();

-- ---------------------------------------------------------------------
-- The plan item follows its job.
--
-- Driven by a trigger rather than by each code path that moves a stage, so
-- the Home Plan cannot drift out of step with reality just because a stage
-- was changed somewhere we forgot to update. Same reasoning as completion
-- writing back to the Home Record.
-- ---------------------------------------------------------------------
create or replace function public.sync_plan_item_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped public.plan_item_status;
begin
  if new.plan_item_id is null then
    return new;
  end if;

  mapped := case new.stage
    when 'APPROVED'            then 'APPROVED'
    when 'SCHEDULED'           then 'SCHEDULED'
    when 'IN_PROGRESS'         then 'SCHEDULED'
    when 'COMPLETED'           then 'DONE'
    when 'HOME_RECORD_UPDATED' then 'DONE'
    when 'CLOSED'              then 'DONE'
    else null
  end;

  if mapped is not null then
    update public.plan_items
       set status = mapped, updated_at = now()
     where id = new.plan_item_id
       and status <> mapped;
  end if;

  return new;
end;
$$;

create trigger service_requests_sync_plan_item
  after insert or update of stage on public.service_requests
  for each row execute function public.sync_plan_item_from_request();

-- ---------------------------------------------------------------------
-- Completing plan work closes the finding that asked for it.
--
-- Without this the Home Plan would go on recommending a repair the member
-- has already paid for — the single most embarrassing thing this product
-- could do to them.
-- ---------------------------------------------------------------------
create or replace function public.complete_service_request(
  target_request_id uuid,
  p_work_performed  text,
  p_parts_used      text default null,
  p_model           text default null,
  p_serial          text default null,
  p_condition       public.asset_condition default null,
  p_actor           uuid default null
)
returns public.service_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor   uuid := coalesce(p_actor, auth.uid());
  done_at timestamptz := now();
  req     public.service_requests;
  result  public.service_requests;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'service request % not found', target_request_id;
  end if;

  if coalesce(btrim(p_work_performed), '') = '' then
    raise exception 'work performed is required to complete a job';
  end if;

  update public.service_requests
     set stage                = 'COMPLETED',
         work_performed       = p_work_performed,
         parts_used           = p_parts_used,
         completion_model     = p_model,
         completion_serial    = p_serial,
         completion_condition = p_condition,
         completed_at         = done_at,
         completed_by         = actor
   where id = target_request_id;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (target_request_id, req.stage, 'COMPLETED', 'Work completed and written up.', actor);

  -- Write back to the Home Record, when we know which item this was about.
  if req.asset_id is not null then
    update public.assets a
       set last_serviced_at = done_at::date,
           condition        = coalesce(p_condition, a.condition),
           -- Only fill a blank; a human-entered model is not overwritten by
           -- a number typed in a hurry at the end of a job.
           model            = case when a.model is null
                                   then nullif(btrim(coalesce(p_model, '')), '')
                                   else a.model end,
           serial_number    = case when a.serial_number is null
                                   then nullif(btrim(coalesce(p_serial, '')), '')
                                   else a.serial_number end,
           notes            = btrim(
                                coalesce(a.notes || E'\n\n', '') ||
                                to_char(done_at, 'Mon DD, YYYY') || ': ' || p_work_performed ||
                                case when coalesce(btrim(p_parts_used), '') <> ''
                                     then ' Parts: ' || p_parts_used else '' end
                              )
     where a.id = req.asset_id;

    -- The photos taken on the job belong with the equipment from now on.
    update public.photos
       set asset_id = req.asset_id
     where service_request_id = target_request_id
       and asset_id is null;
  end if;

  -- The plan told them this needed doing; it is done.
  if req.finding_id is not null then
    update public.findings
       set resolved_at = done_at,
           updated_at  = done_at
     where id = req.finding_id
       and resolved_at is null;
  end if;

  update public.service_requests
     set stage             = 'HOME_RECORD_UPDATED',
         record_updated_at = done_at
   where id = target_request_id
  returning * into result;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    target_request_id, 'COMPLETED', 'HOME_RECORD_UPDATED',
    case when req.asset_id is null
         then 'No linked item — nothing to update in the Home Record.'
         else 'Home Record updated from the completed work.' end,
    actor
  );

  return result;
end;
$$;
