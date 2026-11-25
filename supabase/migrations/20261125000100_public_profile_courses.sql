-- Handson · Public profile · Completed Handson courses (badges)
--
-- Students can show the Handson courses they completed on their public
-- profile, as a new optional section 'courses'. Off unless the student ticks it,
-- like every other section.
--
--   1. public_sections accepts 'courses'.
--   2. set_public_profile(): same signature and checks; also accepts 'courses'.
--   3. public_profile(): same signature and output; adds 'courses' (title,
--      badge, completion date) when that section is chosen.
--
-- Requires 20261123000300_lms_results.sql.

alter table public.profiles drop constraint profiles_public_sections_check;
alter table public.profiles add constraint profiles_public_sections_check check (
  public_sections <@ array['photo', 'headline', 'summary', 'location', 'education',
                           'experience', 'skills', 'languages', 'linkedin', 'courses']::text[]
);

create or replace function public.set_public_profile(
  p_enabled boolean,
  p_slug text,
  p_sections text[],
  p_version text default '2026-11'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_slug text := nullif(lower(trim(p_slug)), '');
  v_sections text[];
  v_was boolean;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select public_profile_enabled into v_was from public.profiles where id = uid;
  if not found then
    raise exception 'Create a student profile first' using errcode = 'P0002';
  end if;
  if not public.account_is_active() then
    raise exception 'Account suspended' using errcode = '42501';
  end if;
  if p_enabled and v_slug is null then
    raise exception 'Choose a profile address' using errcode = '22023';
  end if;
  if v_slug is not null and (
    char_length(v_slug) not between 3 and 40
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or v_slug = any (array['admin', 'api', 'app', 'auth', 'dashboard', 'employer', 'employers', 'handson', 'help',
                           'invite', 'legal', 'login', 'onboarding', 'p', 'privacy', 'register', 'settings',
                           'start', 'support', 'terms', 'workspaces'])
  ) then
    raise exception 'This profile address is not available' using errcode = '22023';
  end if;
  if v_slug is not null and exists (select 1 from public.profiles where public_slug = v_slug and id <> uid) then
    raise exception 'This profile address is already taken' using errcode = '23505';
  end if;

  select coalesce(array_agg(distinct s order by s), '{}') into v_sections
  from unnest(coalesce(p_sections, '{}')) s
  where s = any (array['photo', 'headline', 'summary', 'location', 'education', 'experience', 'skills', 'languages', 'linkedin', 'courses']);

  update public.profiles
     set public_slug = v_slug,
         public_sections = v_sections,
         public_profile_enabled = p_enabled
   where id = uid;

  if v_was is distinct from p_enabled then
    insert into public.consent_records (user_id, consent_type, granted, version, source)
    values (uid, 'public_profile', p_enabled, left(coalesce(p_version, '2026-11'), 50), 'app');
  end if;
  return v_slug;
end;
$$;

create or replace function public.public_profile(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  s text[];
  result jsonb;
begin
  select pr.* into p
  from public.profiles pr
  join public.accounts a on a.user_id = pr.id
  where pr.public_slug = lower(trim(p_slug))
    and pr.public_profile_enabled
    and a.status = 'active'
    and pr.account_status = 'active';
  if not found then
    return null;
  end if;
  s := p.public_sections;

  result := jsonb_build_object(
    'slug', p.public_slug,
    'first_name', p.first_name,
    'surname', p.surname,
    'verified', p.verification_status = 'verified',
    'sections', to_jsonb(s)
  );

  if 'photo' = any (s) then
    result := result || jsonb_build_object('photo_path', p.photo_path);
  end if;
  if 'headline' = any (s) then
    result := result || jsonb_build_object('headline', p.headline);
  end if;
  if 'summary' = any (s) then
    result := result || jsonb_build_object('summary', p.summary);
  end if;
  if 'linkedin' = any (s) then
    result := result || jsonb_build_object('linkedin_url', p.linkedin_url);
  end if;
  if 'location' = any (s) then
    result := result || jsonb_build_object('location', jsonb_build_object(
      'country_code', p.country_code,
      'province_en', (select name_en from public.provinces where id = p.province_id),
      'province_pt', (select name_pt from public.provinces where id = p.province_id),
      'district', (select name from public.districts where id = p.district_id),
      'city', p.city
    ));
  end if;
  if 'education' = any (s) then
    result := result || jsonb_build_object('education', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institution', coalesce(i.name, e.institution_name_other),
        'qualification_en', q.name_en,
        'qualification_pt', q.name_pt,
        'qualification_name', e.qualification_name,
        'field_en', coalesce(f.name_en, e.field_of_study_other),
        'field_pt', coalesce(f.name_pt, e.field_of_study_other),
        'status', e.academic_status,
        'start_year', e.start_year,
        'end_year', e.end_year,
        'verified', e.verification_status = 'verified'
      ) order by e.start_year desc)
      from public.education_records e
      join public.qualification_types q on q.id = e.qualification_type_id
      left join public.institutions i on i.id = e.institution_id
      left join public.fields_of_study f on f.id = e.field_of_study_id
      where e.profile_id = p.id
    ), '[]'::jsonb));
  end if;
  if 'experience' = any (s) then
    result := result || jsonb_build_object('experience', coalesce((
      select jsonb_agg(jsonb_build_object(
        'organisation', x.organisation,
        'role_title', x.role_title,
        'type', x.experience_type,
        'location', x.location,
        'start_date', x.start_date,
        'end_date', x.end_date,
        'is_current', x.is_current,
        'description', x.description
      ) order by x.is_current desc, x.start_date desc)
      from public.experiences x
      where x.profile_id = p.id
    ), '[]'::jsonb));
  end if;
  if 'skills' = any (s) then
    result := result || jsonb_build_object('skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name_en', coalesce(c.name_en, k.custom_skill_name),
        'name_pt', coalesce(c.name_pt, k.custom_skill_name),
        'proficiency', k.proficiency
      ) order by k.proficiency desc, coalesce(c.name_pt, k.custom_skill_name))
      from public.student_skills k
      left join public.skill_catalogue c on c.id = k.skill_id
      where k.profile_id = p.id
    ), '[]'::jsonb));
  end if;
  if 'languages' = any (s) then
    result := result || jsonb_build_object('languages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name_en', l.name_en,
        'name_pt', l.name_pt,
        'level', sl.level
      ) order by sl.level desc, l.sort_order)
      from public.student_languages sl
      join public.languages l on l.id = sl.language_id
      where sl.profile_id = p.id
    ), '[]'::jsonb));
  end if;

  if 'courses' = any (s) then
    result := result || jsonb_build_object('courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', c.title,
        'badge_name', c.badge_name,
        'completed_at', cc.completed_at
      ) order by cc.completed_at desc)
      from public.course_completions cc
      join public.courses c on c.id = cc.course_id
      where cc.user_id = p.id
    ), '[]'::jsonb));
  end if;

  return result;
end;
$$;

revoke execute on function public.set_public_profile(boolean, text, text[], text) from public, anon, authenticated;
grant execute on function public.set_public_profile(boolean, text, text[], text) to authenticated;
revoke execute on function public.public_profile(text) from public, anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
