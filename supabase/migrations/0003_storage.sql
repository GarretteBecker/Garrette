-- =====================================================================
-- B&M HomeKeeper — 0003 Storage buckets + policies
--
-- Two private buckets. Neither is public: every read goes through a signed
-- URL issued only after RLS has approved it.
--
-- Path convention (the first folder is ALWAYS the property id):
--   property-photos/<property_id>/<visit_id|misc>/<uuid>.jpg
--   property-docs/<property_id>/<uuid>-<filename>.pdf
--
-- That convention is what the policies below key on, so do not change it
-- without changing these policies too.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-photos', 'property-photos', false,
    10485760, -- 10 MB ceiling; the client compresses well below this (rule 4)
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'property-docs', 'property-docs', false,
    26214400, -- 25 MB
    array['application/pdf', 'image/jpeg', 'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
on conflict (id) do nothing;

-- Safely pull the property id out of a storage path. Returns null rather
-- than raising if the first path segment is not a uuid, which makes the
-- policies fail closed.
create or replace function public.storage_property_id(object_name text)
returns uuid
language plpgsql
immutable
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

-- --------------------------- reads -----------------------------------
create policy "hk property files are readable by that property's people"
  on storage.objects
  for select to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_access_property(public.storage_property_id(name))
  );

-- --------------------------- writes ----------------------------------
-- Only staff (admin, or the tech assigned to that property) may upload.
create policy "hk staff upload property files"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  );

create policy "hk staff update property files"
  on storage.objects
  for update to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  )
  with check (
    bucket_id in ('property-photos', 'property-docs')
    and public.can_write_property(public.storage_property_id(name))
  );

-- Deleting evidence is admin-only.
create policy "hk admins delete property files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('property-photos', 'property-docs')
    and public.is_admin()
  );
