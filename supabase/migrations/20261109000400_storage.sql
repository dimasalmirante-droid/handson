-- Handson · Phase 6 · Private file storage
--
-- Two private buckets. Files are stored under a folder named after their
-- owner's user ID:  <user_id>/<...>
--   documents : CV, transcripts, certificates, cover letters (max 10 MB)
--   avatars   : profile photos (max 2 MB)
--
-- Nothing is public. Students reach only their own folder; authorised
-- administrators can read files for verification. Downloads use short-lived
-- signed URLs created by the server. Requires 20261109000200_core_schema.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png'
  ]),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Students: their own folder in either bucket.
create policy "Students read their own files"
on storage.objects for select
to authenticated
using (
  bucket_id in ('documents', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Students upload to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('documents', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Students delete their own files"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('documents', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Administrators: read access for verification.
create policy "Admins read student files"
on storage.objects for select
to authenticated
using (bucket_id in ('documents', 'avatars') and public.is_admin());

-- The database must agree: a document row may only point at the owner's folder
-- (already enforced by documents_path_owned). Avatars follow the same rule.
alter table public.profiles
  add constraint profiles_photo_path_owned
  check (photo_path is null or photo_path like id::text || '/%');
