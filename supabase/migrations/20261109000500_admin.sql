-- Handson · Phase 7 · Administration
--
-- Server-side functions for the admin portal. Every function checks the
-- caller's role in administrator_roles and writes sensitive actions to the
-- audit log. Nothing here can be reached by students.
--
-- Permissions
--   reviewer    : search, view profiles and documents, verify or reject
--   admin       : + suspend / reactivate accounts, export
--   super_admin : + manage administrators, read the audit log
--
-- Requires 20261109000400_storage.sql.

-- ===========================================================================
-- 1. Suspended accounts cannot change data
-- ===========================================================================
create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select account_status = 'active' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['education_records', 'student_skills', 'professional_interests', 'experiences', 'documents',
                           'interest_industries', 'interest_job_functions', 'interest_locations']
  loop
    execute format('drop policy "Students manage their own %1$s" on public.%1$I', t);
    execute format(
      'create policy "Students manage their own %1$s" on public.%1$I for all to authenticated
         using ((select auth.uid()) = profile_id)
         with check ((select auth.uid()) = profile_id and public.account_is_active())', t);
  end loop;
end;
$$;

drop policy "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and public.account_is_active());

drop policy "Students upload to their own folder" on storage.objects;
create policy "Students upload to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('documents', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.account_is_active()
);

-- ===========================================================================
-- 2. Helpers
-- ===========================================================================
create or replace function public.require_admin_role(p_min public.admin_role)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(p_min) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
end;
$$;

-- ===========================================================================
-- 3. Search
-- ===========================================================================
-- Filtered, paginated list of students with their latest education and
-- completion score. `total_count` repeats the full match count on each row.
create or replace function public.admin_search_students(
  p_query           text default null,
  p_institution     uuid default null,
  p_qualification   smallint default null,
  p_field           smallint default null,
  p_province        smallint default null,
  p_skill           integer default null,
  p_grad_year       smallint default null,
  p_verification    public.verification_status default null,
  p_account_status  public.account_status default null,
  p_visible         boolean default null,
  p_min_completion  integer default null,
  p_max_completion  integer default null,
  p_sort            text default 'newest',
  p_limit           integer default 25,
  p_offset          integer default 0
)
returns table (
  id                      uuid,
  first_name              text,
  surname                 text,
  email                   text,
  phone                   text,
  province                text,
  city                    text,
  institution             text,
  qualification           text,
  field_of_study          text,
  graduation_year         smallint,
  completion              integer,
  verification_status     public.verification_status,
  account_status          public.account_status,
  employer_visibility     boolean,
  onboarding_completed_at timestamptz,
  created_at              timestamptz,
  total_count             bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  q text := nullif(trim(p_query), '');
begin
  perform public.require_admin_role('reviewer');

  return query
  with base as (
    select
      p.id, p.first_name, p.surname, p.email::text as email, p.phone, pr.name_en as province, p.city,
      coalesce(i.name, e.institution_name_other) as institution,
      coalesce(e.qualification_name, qt.name_en) as qualification,
      coalesce(fs.name_en, e.field_of_study_other) as field_of_study,
      e.end_year as graduation_year,
      coalesce((public.profile_completion(p.id) ->> 'total')::integer, 0) as completion,
      p.verification_status, p.account_status, p.employer_visibility, p.onboarding_completed_at, p.created_at
    from public.profiles p
    left join public.provinces pr on pr.id = p.province_id
    left join lateral (
      select er.* from public.education_records er
      where er.profile_id = p.id
      order by er.start_year desc, er.created_at desc
      limit 1
    ) e on true
    left join public.institutions i on i.id = e.institution_id
    left join public.qualification_types qt on qt.id = e.qualification_type_id
    left join public.fields_of_study fs on fs.id = e.field_of_study_id
    where not exists (select 1 from public.administrator_roles ar where ar.user_id = p.id and ar.revoked_at is null)
      and (q is null or (coalesce(p.first_name, '') || ' ' || coalesce(p.surname, '') || ' ' || p.email::text || ' ' || coalesce(p.phone, ''))
             ilike '%' || q || '%')
      and (p_province is null or p.province_id = p_province)
      and (p_verification is null or p.verification_status = p_verification)
      and (p_account_status is null or p.account_status = p_account_status)
      and (p_visible is null or p.employer_visibility = p_visible)
      and (p_institution is null or exists (select 1 from public.education_records x where x.profile_id = p.id and x.institution_id = p_institution))
      and (p_qualification is null or exists (select 1 from public.education_records x where x.profile_id = p.id and x.qualification_type_id = p_qualification))
      and (p_field is null or exists (select 1 from public.education_records x where x.profile_id = p.id and x.field_of_study_id = p_field))
      and (p_grad_year is null or exists (select 1 from public.education_records x where x.profile_id = p.id and x.end_year = p_grad_year))
      and (p_skill is null or exists (select 1 from public.student_skills s where s.profile_id = p.id and s.skill_id = p_skill))
  ),
  filtered as (
    select * from base b
    where (p_min_completion is null or b.completion >= p_min_completion)
      and (p_max_completion is null or b.completion <= p_max_completion)
  )
  select f.*, count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'name' then lower(coalesce(f.surname, '') || ' ' || coalesce(f.first_name, '')) end asc,
    case when p_sort = 'completion' then f.completion end desc,
    case when p_sort = 'oldest' then f.created_at end asc,
    f.created_at desc
  limit least(greatest(p_limit, 1), 5000)
  offset greatest(p_offset, 0);
end;
$$;

-- ===========================================================================
-- 4. Overview figures
-- ===========================================================================
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_admin_role('reviewer');
  with students as (
    select p.* from public.profiles p
    where not exists (select 1 from public.administrator_roles ar where ar.user_id = p.id and ar.revoked_at is null)
  )
  select jsonb_build_object(
    'total',              (select count(*) from students),
    'onboarded',          (select count(*) from students where onboarding_completed_at is not null),
    'verified',           (select count(*) from students where verification_status = 'verified'),
    'pending',            (select count(*) from students where verification_status = 'pending'),
    'visible',            (select count(*) from students where employer_visibility),
    'suspended',          (select count(*) from students where account_status = 'suspended'),
    'new_7_days',         (select count(*) from students where created_at >= now() - interval '7 days'),
    'new_30_days',        (select count(*) from students where created_at >= now() - interval '30 days'),
    'documents_to_review',(select count(*) from public.documents d join students s on s.id = d.profile_id where d.verification_status in ('unverified', 'pending')),
    'by_province', coalesce((
      select jsonb_agg(jsonb_build_object('province', coalesce(pr.name_en, 'Not set'), 'count', c) order by c desc)
      from (select province_id, count(*) c from students group by province_id) g
      left join public.provinces pr on pr.id = g.province_id
    ), '[]'::jsonb),
    'by_institution_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', t, 'count', c) order by c desc)
      from (
        select e.institution_type::text t, count(distinct e.profile_id) c
        from public.education_records e join students s on s.id = e.profile_id
        group by e.institution_type
      ) g
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ===========================================================================
-- 5. Verification
-- ===========================================================================
create or replace function public.admin_set_profile_verification(
  p_profile uuid,
  p_status public.verification_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('reviewer');
  update public.profiles
     set verification_status = p_status,
         verified_at = case when p_status = 'verified' then now() end,
         verified_by = case when p_status = 'verified' then (select auth.uid()) end
   where id = p_profile;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;

  if p_status in ('verified', 'rejected') then
    insert into public.notifications (profile_id, type, title, body, link)
    values (
      p_profile,
      'profile.' || p_status,
      case when p_status = 'verified' then 'Your profile has been verified' else 'Your profile needs changes' end,
      coalesce(left(p_note, 1000), case when p_status = 'verified'
        then 'Handson has reviewed and verified your profile.'
        else 'Some information could not be verified. Please review your profile.' end),
      '/dashboard'
    );
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), 'profile.verification_set', 'profiles', p_profile::text,
          jsonb_build_object('status', p_status, 'note', left(p_note, 500)));
end;
$$;

create or replace function public.admin_set_record_verification(
  p_table text,
  p_id uuid,
  p_status public.verification_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  label text;
begin
  perform public.require_admin_role('reviewer');
  if p_table not in ('education_records', 'documents') then
    raise exception 'Unsupported record type' using errcode = '22023';
  end if;

  execute format(
    'update public.%I set verification_status = $1,
       verified_at = case when $1 = ''verified'' then now() end,
       verified_by = case when $1 = ''verified'' then $2 end
     where id = $3 returning profile_id', p_table)
    into owner using p_status, (select auth.uid()), p_id;
  if owner is null then raise exception 'Record not found' using errcode = 'P0002'; end if;

  label := case p_table when 'documents' then 'document' else 'qualification' end;
  if p_status = 'rejected' then
    insert into public.notifications (profile_id, type, title, body, link)
    values (owner, label || '.rejected', 'A ' || label || ' needs your attention',
            coalesce(left(p_note, 1000), 'Handson could not verify one of your ' || label || 's. Please check and update it.'),
            case p_table when 'documents' then '/dashboard/documents' else '/dashboard/education' end);
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), label || '.verification_set', p_table, p_id::text,
          jsonb_build_object('status', p_status, 'profile_id', owner, 'note', left(p_note, 500)));
end;
$$;

-- ===========================================================================
-- 6. Account management (admin and above)
-- ===========================================================================
create or replace function public.admin_set_account_status(
  p_profile uuid,
  p_status public.account_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('admin');
  if p_profile = (select auth.uid()) then
    raise exception 'You cannot change your own account status' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.profiles set account_status = p_status where id = p_profile;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), 'account.' || case when p_status = 'suspended' then 'suspended' else 'reactivated' end,
          'profiles', p_profile::text, jsonb_build_object('reason', left(p_reason, 500)));
end;
$$;

-- ===========================================================================
-- 7. Administrator management (super admin only)
-- ===========================================================================
-- Grant a role to the account with this email, or revoke it (p_role null).
create or replace function public.admin_set_role(p_email text, p_role public.admin_role, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  perform public.require_admin_role('super_admin');
  select id into target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target is null then
    raise exception 'No Handson account uses this email. Ask the person to sign up first.' using errcode = 'P0002';
  end if;

  if p_role is null then
    if target = (select auth.uid()) then
      raise exception 'You cannot remove your own administrator access' using errcode = '22023';
    end if;
    update public.administrator_roles set revoked_at = now() where user_id = target and revoked_at is null;
  else
    insert into public.administrator_roles (user_id, role, granted_by, note)
    values (target, p_role, (select auth.uid()), left(p_note, 500))
    on conflict (user_id) do update
      set role = excluded.role, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null, note = excluded.note;
  end if;
  return target;
end;
$$;

-- List of current administrators with their emails (super admin only).
create or replace function public.admin_list_team()
returns table (user_id uuid, email text, role public.admin_role, granted_at timestamptz, granted_by_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('super_admin');
  return query
  select r.user_id, u.email::text, r.role, r.granted_at, g.email::text
  from public.administrator_roles r
  join auth.users u on u.id = r.user_id
  left join auth.users g on g.id = r.granted_by
  where r.revoked_at is null
  order by r.role desc, u.email;
end;
$$;

-- Audit log with actor emails (super admin only).
create or replace function public.admin_audit_log(p_target text default null, p_limit integer default 100, p_offset integer default 0)
returns table (id bigint, created_at timestamptz, actor_email text, action text, target_table text, target_id text, metadata jsonb, total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('super_admin');
  return query
  select a.id, a.created_at, u.email::text, a.action, a.target_table, a.target_id, a.metadata, count(*) over ()
  from public.audit_logs a
  left join auth.users u on u.id = a.actor_id
  where p_target is null or a.target_id = p_target or a.metadata ->> 'profile_id' = p_target
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end;
$$;

-- ===========================================================================
-- 8. Privileges
-- ===========================================================================
revoke execute on function
  public.account_is_active(),
  public.require_admin_role(public.admin_role),
  public.admin_search_students(text, uuid, smallint, smallint, smallint, integer, smallint, public.verification_status, public.account_status, boolean, integer, integer, text, integer, integer),
  public.admin_stats(),
  public.admin_set_profile_verification(uuid, public.verification_status, text),
  public.admin_set_record_verification(text, uuid, public.verification_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_set_role(text, public.admin_role, text),
  public.admin_list_team(),
  public.admin_audit_log(text, integer, integer)
from public, anon;

grant execute on function
  public.account_is_active(),
  public.require_admin_role(public.admin_role),
  public.admin_search_students(text, uuid, smallint, smallint, smallint, integer, smallint, public.verification_status, public.account_status, boolean, integer, integer, text, integer, integer),
  public.admin_stats(),
  public.admin_set_profile_verification(uuid, public.verification_status, text),
  public.admin_set_record_verification(text, uuid, public.verification_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_set_role(text, public.admin_role, text),
  public.admin_list_team(),
  public.admin_audit_log(text, integer, integer)
to authenticated;
