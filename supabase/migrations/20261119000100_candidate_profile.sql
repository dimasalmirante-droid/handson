-- Handson · Candidate basics · Database
--
-- Adds what the candidate-facing features need:
--   1. Portuguese as the default language for new profiles.
--   2. A district catalogue for Mozambique (reference data, admin-managed).
--   3. Profile headline, summary and district.
--   4. Languages with a level (catalogue + student-owned records).
--   5. Profile completion: a district or a typed city counts as location.
--   6. Public profile: an opt-in, shareable page at /p/<slug> showing only the
--      sections the student chooses. Contact details are never public.
--
-- Additive only: no existing column, policy or function signature is removed.
-- Requires 20261115000400_company_team_management.sql.

-- ===========================================================================
-- 1. Portuguese first
-- ===========================================================================
-- New profiles default to Portuguese. Existing profiles keep their stored value.
alter table public.profiles alter column preferred_locale set default 'pt';

-- ===========================================================================
-- 2. Districts (Mozambique)
-- ===========================================================================
create table public.districts (
  id           smallint generated always as identity primary key,
  province_id  smallint not null references public.provinces (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 100),
  is_active    boolean not null default true,
  sort_order   smallint not null default 0,
  unique (province_id, name)
);
create index districts_province_idx on public.districts (province_id) where is_active;

comment on table public.districts is
  'Districts and city districts per province. Starter list; administrators correct and extend it.';

alter table public.districts enable row level security;
create policy "Signed-in users can read districts" on public.districts
  for select to authenticated using (true);
create policy "Admins can manage districts" on public.districts
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));
revoke all on public.districts from anon, authenticated;
grant select, insert, update, delete on public.districts to authenticated;

insert into public.districts (province_id, name)
select p.id, v.name
from (values
  ('NIA', 'Cidade de Lichinga'), ('NIA', 'Chimbunila'), ('NIA', 'Cuamba'), ('NIA', 'Lago'), ('NIA', 'Majune'),
  ('NIA', 'Mandimba'), ('NIA', 'Marrupa'), ('NIA', 'Maúa'), ('NIA', 'Mavago'), ('NIA', 'Mecanhelas'),
  ('NIA', 'Mecula'), ('NIA', 'Metarica'), ('NIA', 'Muembe'), ('NIA', 'N''gauma'), ('NIA', 'Nipepe'), ('NIA', 'Sanga'),

  ('CAB', 'Cidade de Pemba'), ('CAB', 'Ancuabe'), ('CAB', 'Balama'), ('CAB', 'Chiúre'), ('CAB', 'Ibo'),
  ('CAB', 'Macomia'), ('CAB', 'Mecúfi'), ('CAB', 'Meluco'), ('CAB', 'Metuge'), ('CAB', 'Mocímboa da Praia'),
  ('CAB', 'Montepuez'), ('CAB', 'Mueda'), ('CAB', 'Muidumbe'), ('CAB', 'Namuno'), ('CAB', 'Nangade'),
  ('CAB', 'Palma'), ('CAB', 'Quissanga'),

  ('NAM', 'Cidade de Nampula'), ('NAM', 'Cidade de Nacala'), ('NAM', 'Angoche'), ('NAM', 'Eráti'),
  ('NAM', 'Ilha de Moçambique'), ('NAM', 'Lalaua'), ('NAM', 'Larde'), ('NAM', 'Liúpo'), ('NAM', 'Malema'),
  ('NAM', 'Meconta'), ('NAM', 'Mecubúri'), ('NAM', 'Memba'), ('NAM', 'Mogincual'), ('NAM', 'Mogovolas'),
  ('NAM', 'Moma'), ('NAM', 'Monapo'), ('NAM', 'Mossuril'), ('NAM', 'Muecate'), ('NAM', 'Murrupula'),
  ('NAM', 'Nacala-a-Velha'), ('NAM', 'Nacarôa'), ('NAM', 'Rapale'), ('NAM', 'Ribáuè'),

  ('ZAM', 'Cidade de Quelimane'), ('ZAM', 'Alto Molócuè'), ('ZAM', 'Chinde'), ('ZAM', 'Derre'), ('ZAM', 'Gilé'),
  ('ZAM', 'Gurué'), ('ZAM', 'Ile'), ('ZAM', 'Inhassunge'), ('ZAM', 'Luabo'), ('ZAM', 'Lugela'),
  ('ZAM', 'Maganja da Costa'), ('ZAM', 'Milange'), ('ZAM', 'Mocuba'), ('ZAM', 'Mocubela'), ('ZAM', 'Molumbo'),
  ('ZAM', 'Mopeia'), ('ZAM', 'Morrumbala'), ('ZAM', 'Mulevala'), ('ZAM', 'Namacurra'), ('ZAM', 'Namarrói'),
  ('ZAM', 'Nicoadala'), ('ZAM', 'Pebane'),

  ('TET', 'Cidade de Tete'), ('TET', 'Angónia'), ('TET', 'Cahora Bassa'), ('TET', 'Changara'), ('TET', 'Chifunde'),
  ('TET', 'Chiuta'), ('TET', 'Dôa'), ('TET', 'Macanga'), ('TET', 'Mágoè'), ('TET', 'Marara'), ('TET', 'Marávia'),
  ('TET', 'Moatize'), ('TET', 'Mutarara'), ('TET', 'Tsangano'), ('TET', 'Zumbo'),

  ('MAN', 'Cidade de Chimoio'), ('MAN', 'Bárue'), ('MAN', 'Gondola'), ('MAN', 'Guro'), ('MAN', 'Macate'),
  ('MAN', 'Machaze'), ('MAN', 'Macossa'), ('MAN', 'Manica'), ('MAN', 'Mossurize'), ('MAN', 'Sussundenga'),
  ('MAN', 'Tambara'), ('MAN', 'Vanduzi'),

  ('SOF', 'Cidade da Beira'), ('SOF', 'Búzi'), ('SOF', 'Caia'), ('SOF', 'Chemba'), ('SOF', 'Cheringoma'),
  ('SOF', 'Chibabava'), ('SOF', 'Dondo'), ('SOF', 'Gorongosa'), ('SOF', 'Machanga'), ('SOF', 'Maríngué'),
  ('SOF', 'Marromeu'), ('SOF', 'Muanza'), ('SOF', 'Nhamatanda'),

  ('INH', 'Cidade de Inhambane'), ('INH', 'Cidade da Maxixe'), ('INH', 'Funhalouro'), ('INH', 'Govuro'),
  ('INH', 'Homoíne'), ('INH', 'Inharrime'), ('INH', 'Inhassoro'), ('INH', 'Jangamo'), ('INH', 'Mabote'),
  ('INH', 'Massinga'), ('INH', 'Morrumbene'), ('INH', 'Panda'), ('INH', 'Vilankulo'), ('INH', 'Zavala'),

  ('GAZ', 'Cidade de Xai-Xai'), ('GAZ', 'Bilene'), ('GAZ', 'Chibuto'), ('GAZ', 'Chicualacuala'), ('GAZ', 'Chigubo'),
  ('GAZ', 'Chókwè'), ('GAZ', 'Chongoene'), ('GAZ', 'Guijá'), ('GAZ', 'Limpopo'), ('GAZ', 'Mabalane'),
  ('GAZ', 'Mandlakazi'), ('GAZ', 'Mapai'), ('GAZ', 'Massangena'), ('GAZ', 'Massingir'),

  ('MPT', 'Cidade da Matola'), ('MPT', 'Boane'), ('MPT', 'Magude'), ('MPT', 'Manhiça'), ('MPT', 'Marracuene'),
  ('MPT', 'Matutuíne'), ('MPT', 'Moamba'), ('MPT', 'Namaacha'),

  ('MPM', 'KaMpfumo'), ('MPM', 'Nlhamankulu'), ('MPM', 'KaMaxakeni'), ('MPM', 'KaMavota'), ('MPM', 'KaMubukwana'),
  ('MPM', 'KaTembe'), ('MPM', 'KaNyaka')
) as v(province_code, name)
join public.provinces p on p.country_code = 'MZ' and p.code = v.province_code;

-- ===========================================================================
-- 3. Profile: headline, summary and district
-- ===========================================================================
alter table public.profiles
  add column headline     text check (char_length(headline) between 2 and 120),
  add column summary      text check (char_length(summary) between 2 and 600),
  add column district_id  smallint references public.districts (id) on delete set null;

create index profiles_district_idx on public.profiles (district_id);

-- A district must belong to the profile's province.
create or replace function public.profiles_district_matches_province()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.district_id is not null and not exists (
    select 1 from public.districts d
    where d.id = new.district_id and d.province_id is not distinct from new.province_id
  ) then
    raise exception 'The district does not belong to the selected province' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_district_province
before insert or update of district_id, province_id on public.profiles
for each row execute function public.profiles_district_matches_province();

grant update (headline, summary, district_id) on public.profiles to authenticated;

-- ===========================================================================
-- 4. Languages
-- ===========================================================================
create type public.language_level as enum ('basic', 'intermediate', 'advanced', 'fluent', 'native');

create table public.languages (
  id          smallint generated always as identity primary key,
  code        text not null unique check (code ~ '^[a-z][a-z0-9_]{1,19}$'),
  name_en     text not null,
  name_pt     text not null,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0
);

alter table public.languages enable row level security;
create policy "Signed-in users can read languages" on public.languages
  for select to authenticated using (true);
create policy "Admins can manage languages" on public.languages
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));
revoke all on public.languages from anon, authenticated;
grant select, insert, update, delete on public.languages to authenticated;

insert into public.languages (code, name_en, name_pt, sort_order) values
  ('pt',        'Portuguese',                    'Português',                     1),
  ('en',        'English',                       'Inglês',                        2),
  ('fr',        'French',                        'Francês',                       3),
  ('es',        'Spanish',                       'Espanhol',                      4),
  ('sw',        'Swahili',                       'Suaíli',                        5),
  ('zh',        'Chinese (Mandarin)',            'Chinês (Mandarim)',             6),
  ('ar',        'Arabic',                        'Árabe',                         7),
  ('vmw',       'Emakhuwa',                      'Emakhuwa',                      10),
  ('ts',        'Xichangana',                    'Xichangana',                    11),
  ('seh',       'Cisena',                        'Cisena',                        12),
  ('ngl',       'Elomwe',                        'Elomwe',                        13),
  ('chw',       'Echuwabo',                      'Echuwabo',                      14),
  ('ny',        'Cinyanja',                      'Cinyanja',                      15),
  ('rng',       'Xironga',                       'Xironga',                       16),
  ('tsc',       'Citshwa',                       'Citshwa',                       17),
  ('ndc',       'Cindau',                        'Cindau',                        18),
  ('kde',       'Shimakonde',                    'Shimakonde',                    19),
  ('yao',       'Ciyao',                         'Ciyao',                         20),
  ('nyu',       'Cinyungwe',                     'Cinyungwe',                     21),
  ('toh',       'Gitonga',                       'Gitonga',                       22),
  ('cce',       'Cicopi',                        'Cicopi',                        23),
  ('mwe',       'Kimwani',                       'Kimwani',                       24),
  ('koti',      'Ekoti',                         'Ekoti',                         25),
  ('mzy',       'Mozambican Sign Language',      'Língua de Sinais de Moçambique', 30);

create table public.student_languages (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  language_id  smallint not null references public.languages (id) on delete cascade,
  level        public.language_level not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_id, language_id)
);
create index student_languages_language_idx on public.student_languages (language_id);

create trigger student_languages_set_updated_at before update on public.student_languages
  for each row execute function public.set_updated_at();
create trigger student_languages_row_limit before insert on public.student_languages
  for each row execute function public.enforce_row_limit('15');

alter table public.student_languages enable row level security;
create policy "Students manage their own student_languages" on public.student_languages
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id and public.account_is_active());
create policy "Admins can read student_languages" on public.student_languages
  for select to authenticated using (public.is_admin());
revoke all on public.student_languages from anon, authenticated;
grant select, insert, update, delete on public.student_languages to authenticated;

-- ===========================================================================
-- 5. Profile completion
-- ===========================================================================
-- Same signature, weights, sections and results as before for existing data.
-- The only change: location ('city') is satisfied by either a district or a
-- typed city. (The headline is required by the application, not scored, so
-- the deployed application's completion results stay identical.)
create or replace function public.profile_completion(p_profile_id uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  pid uuid := coalesce(p_profile_id, (select auth.uid()));
  p public.profiles%rowtype;
  i public.professional_interests%rowtype;
  missing text[];
  required int;
  personal numeric; education numeric; skills numeric; interests numeric; experience numeric; documents numeric;
  personal_missing text[]; education_missing text[]; skills_missing text[];
  interests_missing text[]; experience_missing text[]; documents_missing text[];
  n int;
begin
  select * into p from public.profiles where id = pid;
  if not found then
    return null;
  end if;

  -- Personal information: 7 required fields (6 outside Mozambique)
  missing := array_remove(array[
    case when p.first_name is null then 'first_name' end,
    case when p.surname is null then 'surname' end,
    case when p.date_of_birth is null then 'date_of_birth' end,
    case when p.nationality_code is null then 'nationality' end,
    case when p.country_code = 'MZ' and p.province_id is null then 'province' end,
    case when p.city is null and p.district_id is null then 'city' end,
    case when p.phone is null then 'phone' end
  ], null);
  required := case when p.country_code = 'MZ' then 7 else 6 end;
  personal := round(15.0 * (required - cardinality(missing)) / required, 2);
  personal_missing := missing;

  select count(*) into n from public.education_records where profile_id = pid;
  education := case when n > 0 then 20 else 0 end;
  education_missing := case when n > 0 then '{}'::text[] else array['education_record'] end;

  select count(*) into n from public.student_skills where profile_id = pid;
  skills := round(15.0 * least(n, 3) / 3, 2);
  skills_missing := case when n >= 3 then '{}'::text[] else array['skills_min_3'] end;

  select * into i from public.professional_interests where profile_id = pid;
  missing := '{}';
  if not found then
    missing := array['industries', 'job_functions', 'work_arrangements', 'availability', 'preferred_locations'];
  else
    if not exists (select 1 from public.interest_industries where profile_id = pid) then missing := missing || 'industries'::text; end if;
    if not exists (select 1 from public.interest_job_functions where profile_id = pid) then missing := missing || 'job_functions'::text; end if;
    if cardinality(i.work_arrangements) = 0 then missing := missing || 'work_arrangements'::text; end if;
    if i.availability is null then missing := missing || 'availability'::text; end if;
    if not exists (select 1 from public.interest_locations where profile_id = pid) then missing := missing || 'preferred_locations'::text; end if;
  end if;
  interests := round(15.0 * (5 - cardinality(missing)) / 5, 2);
  interests_missing := missing;

  select count(*) into n from public.experiences where profile_id = pid;
  experience := case when n > 0 then 15 else 0 end;
  experience_missing := case when n > 0 then '{}'::text[] else array['experience_record'] end;

  missing := '{}';
  if not exists (select 1 from public.documents where profile_id = pid and document_type = 'cv') then missing := missing || 'cv'::text; end if;
  if not exists (select 1 from public.documents where profile_id = pid and document_type = 'transcript') then missing := missing || 'transcript'::text; end if;
  documents := 20 - 10 * cardinality(missing);
  documents_missing := missing;

  return jsonb_build_object(
    'total', round(personal + education + skills + interests + experience + documents),
    'sections', jsonb_build_object(
      'personal',   jsonb_build_object('weight', 15, 'score', personal,   'missing', to_jsonb(personal_missing)),
      'education',  jsonb_build_object('weight', 20, 'score', education,  'missing', to_jsonb(education_missing)),
      'skills',     jsonb_build_object('weight', 15, 'score', skills,     'missing', to_jsonb(skills_missing)),
      'interests',  jsonb_build_object('weight', 15, 'score', interests,  'missing', to_jsonb(interests_missing)),
      'experience', jsonb_build_object('weight', 15, 'score', experience, 'missing', to_jsonb(experience_missing)),
      'documents',  jsonb_build_object('weight', 20, 'score', documents,  'missing', to_jsonb(documents_missing))
    )
  );
end;
$$;

-- ===========================================================================
-- 6. Public profile
-- ===========================================================================
alter type public.consent_type add value if not exists 'public_profile';

alter table public.profiles
  add column public_slug             text check (
                                       char_length(public_slug) between 3 and 40
                                       and public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                                     ),
  add column public_profile_enabled  boolean not null default false,
  add column public_sections         text[] not null default '{}' check (
                                       public_sections <@ array['photo', 'headline', 'summary', 'location', 'education',
                                                                'experience', 'skills', 'languages', 'linkedin']::text[]
                                     ),
  add constraint profiles_public_needs_slug check (not public_profile_enabled or public_slug is not null);

create unique index profiles_public_slug_key on public.profiles (public_slug) where public_slug is not null;

comment on column public.profiles.public_profile_enabled is
  'False by default. Changes only through set_public_profile(), which records consent.';
comment on column public.profiles.public_sections is
  'Sections shown on the public profile. Name is always shown when enabled; email and phone never are.';

-- Turn the public profile on or off, and choose its address and sections.
-- Records a consent entry whenever the on/off state changes.
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
  where s = any (array['photo', 'headline', 'summary', 'location', 'education', 'experience', 'skills', 'languages', 'linkedin']);

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

-- The public view of one profile: only for enabled profiles of active
-- accounts, and only the chosen sections. Returns null otherwise.
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

  return result;
end;
$$;

revoke execute on function public.set_public_profile(boolean, text, text[], text) from public, anon, authenticated;
grant execute on function public.set_public_profile(boolean, text, text[], text) to authenticated;
revoke execute on function public.public_profile(text) from public, anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;

-- Profile photos on public profiles: anyone may read the photo of an enabled
-- public profile that shows it, so the page can display it. Only that one
-- file; every other file stays private. (Supabase already grants the anon
-- role table access to storage.objects; Row Level Security decides.)
create or replace function public.is_public_photo(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'avatars' and exists (
    select 1
    from public.profiles pr
    join public.accounts a on a.user_id = pr.id
    where pr.photo_path = p_name
      and pr.public_profile_enabled
      and 'photo' = any (pr.public_sections)
      and a.status = 'active'
  );
$$;

revoke execute on function public.is_public_photo(text, text) from public, anon, authenticated;
grant execute on function public.is_public_photo(text, text) to anon, authenticated;

create policy "Anyone reads photos shown on public profiles"
on storage.objects for select
to anon, authenticated
using (public.is_public_photo(bucket_id, name));
