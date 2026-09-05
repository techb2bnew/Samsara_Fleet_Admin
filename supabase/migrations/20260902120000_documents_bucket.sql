-- ============================================================================
-- Storage for the files documents rows point at
-- ============================================================================
-- The documents table has always had a storage_path column and there has never
-- been a bucket behind it. Every row could name a file that did not exist, and
-- the download button had nothing to sign a URL against.
--
-- Private, not public. A driving licence, a medical certificate and a delivery
-- note are all personal or commercial documents; a public bucket would make
-- every one of them readable by anyone with the URL, forever. Files are reached
-- through short-lived signed URLs instead.
--
-- ---------------------------------------------------------------------------
-- The path convention, and why the policies need one
-- ---------------------------------------------------------------------------
--   <org_id>/<kind>/<owner_id>/<uuid>-<filename>
--
--   kind = driver    a driver's compliance paperwork
--   kind = vehicle   a vehicle's paperwork
--   kind = trip      trip paperwork, owned by the driver who uploaded it
--
-- Storage has no foreign keys, so a policy can only reason about the path.
-- Putting the organisation first makes tenant isolation a prefix check, and
-- putting the owner third lets a driver be given access to their own files
-- without being given access to the whole depot's.
--
-- The uuid in the filename stops two people uploading "licence.jpg" from
-- overwriting each other.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  -- 25 MB. A phone photo of a delivery note is about 3 MB; a multi-page
  -- scanned PDF can be 15. Anything past this is a mistake, not a document.
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Reading the path safely
-- ---------------------------------------------------------------------------
-- A cast straight to uuid would raise on any object whose first segment is not
-- one — including a stray file uploaded to the bucket root — and an error
-- inside a policy is a denial nobody can debug. This returns null instead.

create or replace function public.storage_segment_uuid(object_name text, segment int)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[segment] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(object_name))[segment])::uuid
  end
$$;

comment on function public.storage_segment_uuid is
  'One path segment of a storage object as a uuid, or null if it is not one. Used by the documents bucket policies, which can only see the path.';


-- ---------------------------------------------------------------------------
-- Office staff: their own organisation's files
-- ---------------------------------------------------------------------------

create policy documents_office_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select public.is_super_admin())
      or public.storage_segment_uuid(name, 1) in (select public.current_org_ids())
    )
  );

create policy documents_office_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  );

-- Replacing a file is how a renewed licence is filed, so update is allowed.
-- Deleting is not: a document row can be soft-deleted, and the file behind an
-- expired licence is part of what an audit asks for.
create policy documents_office_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  )
  with check (
    bucket_id = 'documents'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  );


-- ---------------------------------------------------------------------------
-- Drivers: their own files, and trip paperwork they upload
-- ---------------------------------------------------------------------------
-- A driver reads what belongs to them and writes trip paperwork under their own
-- id. They cannot read another driver's licence, and they cannot write their
-- own compliance documents — a driver who could replace their own medical
-- certificate is the whole reason that paperwork exists.

create policy documents_driver_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] in ('driver', 'trip')
    and public.storage_segment_uuid(name, 3) = (select public.current_driver_id())
  );

create policy documents_driver_write_trip on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'trip'
    and public.storage_segment_uuid(name, 3) = (select public.current_driver_id())
  );
