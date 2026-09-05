-- ============================================================================
-- Course content, and progress a driver can pause
-- ============================================================================
-- A course was a title and a number of minutes. There was nothing to open, so
-- "training" could only ever mean a driver ticking a box. Two things are added:
-- somewhere for the material to live, and somewhere for time already spent to
-- be remembered.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Time already spent
-- ---------------------------------------------------------------------------
-- started_at alone cannot answer "has this driver spent ten minutes on it".
-- A driver reads for four minutes, locks the phone, and finishes the next
-- morning; wall-clock since started_at would say sixteen hours, and a client
-- side counter would say zero because the app was killed in between.
--
-- The column is written on pause and on leaving the screen, so the answer
-- survives the app being closed. It is seconds rather than minutes because a
-- driver who pauses three times would otherwise lose most of a minute to
-- rounding each time.

alter table public.course_assignments
  add column if not exists seconds_spent integer not null default 0;

alter table public.course_assignments
  drop constraint if exists course_assignments_seconds_spent_sane;

alter table public.course_assignments
  add constraint course_assignments_seconds_spent_sane
  -- Negative is meaningless. The upper bound is a typo guard, not a rule:
  -- 24 hours on one course is a bug in whatever wrote it.
  check (seconds_spent >= 0 and seconds_spent <= 86400);

comment on column public.course_assignments.seconds_spent is
  'Seconds this driver has actually had the course open, accumulated across pauses. Used to gate completion; not proof of attention.';


-- ---------------------------------------------------------------------------
-- Where the material lives
-- ---------------------------------------------------------------------------
--   <org_id>/<course_id>/<uuid>-<filename>
--
-- The documents bucket could not be reused: its policies are written around
-- <org>/<kind>/<owner>, where the owner is a driver or a vehicle. Course
-- material has no owner — every driver who is assigned it reads the same file.
--
-- Private, like documents. A safety video is not secret, but a bucket that is
-- public is public forever and to everyone, and this one will end up holding
-- whatever the office decides is training.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training',
  'training',
  false,
  -- 100 MB. A slide deck exported to PDF is a few MB; a short phone-shot
  -- toolbox-talk video is 30-60. Past this the office should be linking to a
  -- video host, not uploading.
  104857600,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- Office staff: their own organisation's material
-- ---------------------------------------------------------------------------
-- Replacing is allowed because that is how a corrected slide gets filed.
-- Deleting is allowed here, unlike documents: an unpublished course's material
-- is a draft, not a record, and nothing in an audit points at it.

drop policy if exists training_office_read on storage.objects;
create policy training_office_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'training'
    and (
      (select public.is_super_admin())
      or public.storage_segment_uuid(name, 1) in (select public.current_org_ids())
    )
  );

drop policy if exists training_office_write on storage.objects;
create policy training_office_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'training'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  );

drop policy if exists training_office_update on storage.objects;
create policy training_office_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'training'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  )
  with check (
    bucket_id = 'training'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  );

drop policy if exists training_office_delete on storage.objects;
create policy training_office_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'training'
    and (select public.has_org_role(public.storage_segment_uuid(name, 1), array['fleet_admin']))
  );


-- ---------------------------------------------------------------------------
-- Drivers: material for a course they can already see
-- ---------------------------------------------------------------------------
-- The second path segment is the course id, so the policy can ask the same
-- question the courses table already answers: is this course published, in my
-- organisation, and either open to my depot or assigned to me. Reusing that
-- test rather than restating it means a draft course's file stays unreadable
-- for the same reason the draft course itself does.
--
-- The bare exists() is not a no-op: a policy's subquery is not security
-- definer, so courses_select_driver is enforced inside it. If the driver
-- cannot select the course row, the file is denied. Do not "tighten" this by
-- adding status/org checks here -- that would duplicate a rule that already
-- lives in one place, and the two copies would drift.

drop policy if exists training_driver_read on storage.objects;
create policy training_driver_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'training'
    and exists (
      select 1
      from public.courses c
      where c.id = public.storage_segment_uuid(name, 2)
    )
  );
