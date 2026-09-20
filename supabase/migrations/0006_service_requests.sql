-- =====================================================================
-- B&M HomeKeeper — 0006 request service, end to end
--
-- A member raises a request against a room and (where they know it) a
-- specific item in their Home Record. The office triages it, dispatches a
-- trade partner, and moves it along the stages in CLAUDE.md. When the work
-- is done, what was actually done flows back into the Home Record by
-- itself — that write-back is the whole point, because a service history
-- that depends on someone remembering to update it separately is a service
-- history that rots.
-- =====================================================================

alter table public.service_requests
  -- What and where
  add column category  text,
  add column room_id   uuid references public.rooms (id)  on delete set null,
  add column asset_id  uuid references public.assets (id) on delete set null,
  -- What was done, captured at completion and pushed to the asset
  add column work_performed       text,
  add column parts_used           text,
  add column completion_model     text,
  add column completion_serial    text,
  add column completion_condition public.asset_condition,
  add column completed_by         uuid references public.profiles (id) on delete set null,
  add column record_updated_at    timestamptz;

create index service_requests_asset_id_idx on public.service_requests (asset_id);
create index service_requests_room_id_idx  on public.service_requests (room_id);

comment on column public.service_requests.asset_id is
  'The Home Record item this request concerns, when the member or the office '
  'can identify one. Completion details are written back to it.';

-- ---------------------------------------------------------------------
-- Media on a request. Photos already carry nullable FKs per parent; add
-- one for requests, and a mime type so a video is distinguishable.
-- ---------------------------------------------------------------------
alter table public.photos
  add column service_request_id uuid references public.service_requests (id) on delete cascade,
  add column mime_type text;

create index photos_service_request_id_idx on public.photos (service_request_id);

-- Members attach video from a phone, so widen the bucket. The size ceiling
-- goes up for video; the client still compresses stills (rule 4).
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'video/mp4', 'video/quicktime', 'video/webm'
       ],
       file_size_limit = 104857600   -- 100 MB, for a short clip
 where id = 'property-photos';

-- ---------------------------------------------------------------------
-- A member may attach media to their OWN request.
--
-- Until now photo writes were staff-only. This opens exactly one door:
-- a member, on their own property, attaching media to a request that
-- belongs to that property. They still cannot touch anything else.
-- ---------------------------------------------------------------------
create policy photos_member_insert_on_own_request on public.photos
  for insert to authenticated
  with check (
    public.current_user_role() = 'member'
    and public.can_access_property(property_id)
    and service_request_id is not null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and sr.property_id = photos.property_id
    )
  );

-- The matching storage rule. Member uploads are confined to the
-- <property_id>/requests/ prefix so they cannot write over a tech's
-- visit photos.
create policy "hk members upload request media"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and public.current_user_role() = 'member'
    and public.can_access_property(public.storage_property_id(name))
    and split_part(name, '/', 2) = 'requests'
  );

-- ---------------------------------------------------------------------
-- Completion → Home Record.
--
-- Called when the office closes out the work. It records what was done,
-- updates the linked item, carries the request's media across to that item
-- so the photos live with the equipment, and advances the stage to
-- HOME RECORD UPDATED.
--
-- security invoker: RLS still applies, so only staff on that property can
-- run it.
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
  req      public.service_requests;
  actor    uuid := coalesce(p_actor, auth.uid());
  done_at  timestamptz := now();
  result   public.service_requests;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'Service request not found';
  end if;
  if coalesce(btrim(p_work_performed), '') = '' then
    raise exception 'Say what work was done before closing this out';
  end if;

  update public.service_requests
     set work_performed       = p_work_performed,
         parts_used           = p_parts_used,
         completion_model     = p_model,
         completion_serial    = p_serial,
         completion_condition = p_condition,
         completed_by         = actor,
         completed_at         = coalesce(completed_at, done_at),
         stage                = 'COMPLETED'
   where id = target_request_id;

  insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id)
  values (target_request_id, req.stage, 'COMPLETED', p_work_performed, actor);

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
