-- Handson · Phase 8 · Maintenance
--
-- Orphaned files: uploads that were never recorded against a profile (for
-- example an interrupted upload). Super administrators can list and remove
-- them; files still referenced by a document or a profile photo can never be
-- deleted this way. Requires 20261109000500_admin.sql.

create or replace function public.admin_orphaned_files(p_min_age interval default interval '24 hours')
returns table (bucket_id text, name text, size_bytes bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('super_admin');
  return query
  select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
  from storage.objects o
  where o.bucket_id in ('documents', 'avatars')
    and o.created_at < now() - p_min_age
    and not exists (select 1 from public.documents d where d.storage_path = o.name)
    and not exists (select 1 from public.profiles p where p.photo_path = o.name)
  order by o.created_at
  limit 1000;
end;
$$;

create policy "Super admins delete orphaned files"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('documents', 'avatars')
  and public.has_admin_role('super_admin')
  and not exists (select 1 from public.documents d where d.storage_path = name)
  and not exists (select 1 from public.profiles p where p.photo_path = name)
);

revoke execute on function public.admin_orphaned_files(interval) from public, anon;
grant execute on function public.admin_orphaned_files(interval) to authenticated;
