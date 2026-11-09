-- Handson · Phase 3 · Core schema
--
-- Student data, reference catalogues, consent records, administrator roles and
-- the audit log. Requires 20261109000100_profiles.sql.
--
-- Security model
--   * Row Level Security on every table.
--   * Students read and write only their own rows (profile_id = auth.uid()).
--   * Verification, account status and visibility fields cannot be set by
--     students: column-level grants exclude them; they change only through
--     security-definer functions (admin actions arrive in Phase 7).
--   * Administrators are identified server-side from administrator_roles.
--     Nothing on the client can grant a role.
--   * Consent records and audit logs are append-only.

create extension if not exists pg_trgm with schema extensions;

-- ===========================================================================
-- 1. Types
-- ===========================================================================
create type public.institution_type as enum ('university', 'polytechnic', 'tvet', 'secondary', 'other');
create type public.academic_status as enum ('enrolled', 'graduated', 'deferred', 'discontinued');
create type public.proficiency_level as enum ('beginner', 'intermediate', 'advanced', 'expert');
create type public.experience_type as enum (
  'internship', 'part_time', 'full_time', 'volunteering', 'university_project',
  'extracurricular', 'freelance', 'other'
);
create type public.work_arrangement as enum ('on_site', 'hybrid', 'remote');
create type public.start_availability as enum (
  'immediately', 'within_1_month', 'within_3_months', 'after_graduation', 'specific_date'
);
create type public.internship_duration as enum ('up_to_3_months', '3_to_6_months', '6_to_12_months', 'over_12_months', 'flexible');
create type public.gender as enum ('female', 'male', 'other', 'prefer_not_to_say');
create type public.document_type as enum ('cv', 'transcript', 'certificate', 'cover_letter', 'portfolio', 'other');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.account_status as enum ('active', 'suspended');
create type public.consent_type as enum ('terms', 'privacy', 'employer_visibility', 'marketing');
create type public.admin_role as enum ('reviewer', 'admin', 'super_admin');

-- ===========================================================================
-- 2. Administrator roles and helpers (defined first: policies depend on them)
-- ===========================================================================
create table public.administrator_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.admin_role not null,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  note        text check (char_length(note) <= 500)
);
comment on table public.administrator_roles is 'Administrator role assignments. Managed only by super admins via server-side functions; never writable from the client.';

-- True if the current user holds an active administrator role at or above p_min.
-- Hierarchy: reviewer < admin < super_admin.
create or replace function public.has_admin_role(p_min public.admin_role default 'reviewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administrator_roles r
    where r.user_id = (select auth.uid())
      and r.revoked_at is null
      and r.role >= p_min
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_admin_role('reviewer');
$$;

-- ===========================================================================
-- 3. Audit log (append-only)
-- ===========================================================================
create table public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null check (char_length(action) between 3 and 100),
  target_table  text check (char_length(target_table) <= 100),
  target_id     text check (char_length(target_id) <= 100),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
comment on table public.audit_logs is 'Record of sensitive administrator actions. Insert-only through log_admin_action(); no updates or deletes.';

-- Record an administrator action. Callable only by administrators.
create or replace function public.log_admin_action(
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), p_action, p_target_table, p_target_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

-- Role changes are always audited, however they are made.
create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    (select auth.uid()),
    'admin_role.' || lower(tg_op),
    'administrator_roles',
    coalesce(new.user_id, old.user_id)::text,
    jsonb_build_object(
      'old_role', case when tg_op <> 'INSERT' then old.role end,
      'new_role', case when tg_op <> 'DELETE' then new.role end,
      'revoked_at', case when tg_op <> 'DELETE' then new.revoked_at end
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger administrator_roles_audit
after insert or update or delete on public.administrator_roles
for each row execute function public.audit_role_change();

-- ===========================================================================
-- 4. Reference catalogues
-- ===========================================================================
create table public.provinces (
  id            smallint generated always as identity primary key,
  country_code  char(2) not null default 'MZ',
  code          text not null,
  name_en       text not null,
  name_pt       text not null,
  sort_order    smallint not null default 0,
  unique (country_code, code)
);

create table public.institutions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 200),
  short_name   text check (char_length(short_name) <= 30),
  type         public.institution_type not null,
  province_id  smallint references public.provinces (id),
  city         text check (char_length(city) <= 100),
  website      text check (website ~ '^https://'),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index institutions_name_key on public.institutions (lower(name));
create index institutions_type_idx on public.institutions (type) where is_active;
create index institutions_name_trgm on public.institutions using gin (name extensions.gin_trgm_ops);

create table public.qualification_types (
  id                 smallint generated always as identity primary key,
  code               text not null unique,
  name_en            text not null,
  name_pt            text not null,
  level              smallint not null,
  institution_types  public.institution_type[] not null,
  sort_order         smallint not null default 0
);

create table public.fields_of_study (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  name_en     text not null,
  name_pt     text not null,
  area        text not null,
  sort_order  smallint not null default 0
);

create table public.skill_categories (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  name_en     text not null,
  name_pt     text not null,
  sort_order  smallint not null default 0
);

create table public.skill_catalogue (
  id           integer generated always as identity primary key,
  category_id  smallint not null references public.skill_categories (id),
  name_en      text not null,
  name_pt      text not null,
  aliases      text[] not null default '{}',
  is_active    boolean not null default true,
  unique (category_id, name_en)
);
create index skill_catalogue_category_idx on public.skill_catalogue (category_id);
create index skill_catalogue_search_trgm on public.skill_catalogue
  using gin ((name_en || ' ' || name_pt) extensions.gin_trgm_ops);

create table public.industries (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  name_en     text not null,
  name_pt     text not null,
  sort_order  smallint not null default 0
);

create table public.job_functions (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  name_en     text not null,
  name_pt     text not null,
  sort_order  smallint not null default 0
);

-- ===========================================================================
-- 5. Profiles: personal information, visibility and verification
-- ===========================================================================
alter table public.profiles
  add column date_of_birth        date check (date_of_birth between date '1940-01-01' and current_date - interval '14 years'),
  add column gender               public.gender,
  add column nationality_code     char(2) check (nationality_code ~ '^[A-Z]{2}$'),
  add column country_code         char(2) not null default 'MZ' check (country_code ~ '^[A-Z]{2}$'),
  add column province_id          smallint references public.provinces (id),
  add column city                 text check (char_length(city) <= 100),
  add column phone                text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column photo_path           text check (char_length(photo_path) <= 300),
  add column linkedin_url         text check (linkedin_url ~ '^https://([a-z]{2,3}\.)?linkedin\.com/'),
  add column github_url           text check (github_url ~ '^https://(www\.)?github\.com/'),
  add column portfolio_url        text check (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 300),
  add column employer_visibility  boolean not null default false,
  add column verification_status  public.verification_status not null default 'unverified',
  add column verified_at          timestamptz,
  add column verified_by          uuid references auth.users (id) on delete set null,
  add column account_status       public.account_status not null default 'active',
  add column last_active_at       timestamptz;

comment on column public.profiles.employer_visibility is 'False by default. Changes only through set_employer_visibility(), which records consent.';

create index profiles_province_idx on public.profiles (province_id);
create index profiles_verification_idx on public.profiles (verification_status);
create index profiles_created_idx on public.profiles (created_at desc);
create index profiles_name_trgm on public.profiles
  using gin ((coalesce(first_name, '') || ' ' || coalesce(surname, '') || ' ' || email::text) extensions.gin_trgm_ops);

-- Students may update only their own personal fields (replaces Phase 2 grant).
revoke update on public.profiles from authenticated;
grant update (
  first_name, middle_name, surname, date_of_birth, gender, nationality_code, country_code,
  province_id, city, phone, photo_path, linkedin_url, github_url, portfolio_url,
  preferred_locale, onboarding_step, onboarding_completed_at
) on public.profiles to authenticated;

-- ===========================================================================
-- 6. Student records
-- ===========================================================================
create table public.education_records (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid not null references public.profiles (id) on delete cascade,
  institution_id           uuid references public.institutions (id) on delete set null,
  institution_name_other   text check (char_length(institution_name_other) between 2 and 200),
  institution_type         public.institution_type not null,
  qualification_type_id    smallint not null references public.qualification_types (id),
  qualification_name       text check (char_length(qualification_name) <= 200),
  field_of_study_id        smallint references public.fields_of_study (id),
  field_of_study_other     text check (char_length(field_of_study_other) <= 150),
  academic_status          public.academic_status not null,
  year_of_study            smallint check (year_of_study between 1 and 8),
  start_year               smallint not null check (start_year between 1960 and 2100),
  end_year                 smallint check (end_year between 1960 and 2100),
  grade                    numeric(5, 2) check (grade >= 0),
  grade_scale              smallint not null default 20 check (grade_scale in (4, 5, 10, 20, 100)),
  language_of_instruction  text check (language_of_instruction in ('pt', 'en', 'fr', 'other')),
  verification_status      public.verification_status not null default 'unverified',
  verified_at              timestamptz,
  verified_by              uuid references auth.users (id) on delete set null,
  sort_order               smallint not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint education_institution_present check (institution_id is not null or institution_name_other is not null),
  constraint education_field_present check (field_of_study_id is not null or field_of_study_other is not null),
  constraint education_years_order check (end_year is null or end_year >= start_year),
  constraint education_grade_within_scale check (grade is null or grade <= grade_scale),
  constraint education_graduated_has_end check (academic_status <> 'graduated' or end_year is not null)
);
create index education_profile_idx on public.education_records (profile_id);
create index education_institution_idx on public.education_records (institution_id);
create index education_qualification_idx on public.education_records (qualification_type_id);
create index education_field_idx on public.education_records (field_of_study_id);
create index education_end_year_idx on public.education_records (end_year);

create table public.student_skills (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles (id) on delete cascade,
  skill_id           integer references public.skill_catalogue (id) on delete cascade,
  custom_skill_name  text check (char_length(custom_skill_name) between 2 and 80),
  proficiency        public.proficiency_level not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint student_skill_one_source check ((skill_id is null) <> (custom_skill_name is null))
);
create unique index student_skills_catalogue_key on public.student_skills (profile_id, skill_id) where skill_id is not null;
create unique index student_skills_custom_key on public.student_skills (profile_id, lower(custom_skill_name)) where custom_skill_name is not null;
create index student_skills_skill_idx on public.student_skills (skill_id);

create table public.professional_interests (
  profile_id              uuid primary key references public.profiles (id) on delete cascade,
  preferred_roles         text[] not null default '{}' check (cardinality(preferred_roles) <= 5),
  career_interests        text check (char_length(career_interests) <= 1000),
  work_arrangements       public.work_arrangement[] not null default '{}',
  availability            public.start_availability,
  available_from          date,
  internship_duration     public.internship_duration,
  has_work_experience     boolean,
  willing_to_relocate     boolean,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint interests_date_when_specific check (availability <> 'specific_date' or available_from is not null)
);

create table public.interest_industries (
  profile_id   uuid not null references public.professional_interests (profile_id) on delete cascade,
  industry_id  smallint not null references public.industries (id) on delete cascade,
  primary key (profile_id, industry_id)
);
create index interest_industries_industry_idx on public.interest_industries (industry_id);

create table public.interest_job_functions (
  profile_id       uuid not null references public.professional_interests (profile_id) on delete cascade,
  job_function_id  smallint not null references public.job_functions (id) on delete cascade,
  primary key (profile_id, job_function_id)
);
create index interest_job_functions_fn_idx on public.interest_job_functions (job_function_id);

create table public.interest_locations (
  profile_id   uuid not null references public.professional_interests (profile_id) on delete cascade,
  province_id  smallint not null references public.provinces (id) on delete cascade,
  primary key (profile_id, province_id)
);
create index interest_locations_province_idx on public.interest_locations (province_id);

create table public.experiences (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  organisation     text not null check (char_length(organisation) between 2 and 200),
  role_title       text not null check (char_length(role_title) between 2 and 150),
  experience_type  public.experience_type not null,
  location         text check (char_length(location) <= 150),
  start_date       date not null check (start_date >= date '1960-01-01'),
  end_date         date,
  is_current       boolean not null default false,
  description      text check (char_length(description) <= 2000),
  achievements     text check (char_length(achievements) <= 2000),
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint experience_dates_order check (end_date is null or end_date >= start_date),
  constraint experience_current_open check (not is_current or end_date is null)
);
create index experiences_profile_idx on public.experiences (profile_id);

create table public.documents (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references public.profiles (id) on delete cascade,
  document_type        public.document_type not null,
  title                text not null check (char_length(title) between 1 and 150),
  storage_path         text not null unique check (char_length(storage_path) <= 300),
  original_filename    text not null check (char_length(original_filename) <= 255),
  mime_type            text not null check (mime_type in (
                         'application/pdf',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/msword',
                         'image/jpeg',
                         'image/png'
                       )),
  size_bytes           integer not null check (size_bytes between 1 and 10485760),
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  verified_by          uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Files live under a folder named after their owner: <profile_id>/<file>
  constraint documents_path_owned check (storage_path like profile_id::text || '/%')
);
create index documents_profile_idx on public.documents (profile_id, document_type);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (char_length(type) <= 50),
  title       text not null check (char_length(title) <= 150),
  body        text check (char_length(body) <= 1000),
  link        text check (link ~ '^/' and char_length(link) <= 300),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;

create table public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  consent_type  public.consent_type not null,
  granted       boolean not null,
  version       text not null check (char_length(version) <= 50),
  source        text not null default 'app' check (source in ('app', 'signup', 'admin')),
  created_at    timestamptz not null default now()
);
create index consent_records_profile_idx on public.consent_records (profile_id, consent_type, created_at desc);
comment on table public.consent_records is 'Append-only history of consent decisions. The latest row per type is the current state.';

-- ===========================================================================
-- 7. Integrity triggers
-- ===========================================================================
create trigger institutions_set_updated_at before update on public.institutions
  for each row execute function public.set_updated_at();
create trigger education_set_updated_at before update on public.education_records
  for each row execute function public.set_updated_at();
create trigger student_skills_set_updated_at before update on public.student_skills
  for each row execute function public.set_updated_at();
create trigger interests_set_updated_at before update on public.professional_interests
  for each row execute function public.set_updated_at();
create trigger experiences_set_updated_at before update on public.experiences
  for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Caps the number of rows a student can hold in a table (abuse protection).
-- Usage: execute function public.enforce_row_limit('<max>')
create or replace function public.enforce_row_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_rows integer := tg_argv[0]::integer;
  current_rows integer;
begin
  execute format('select count(*) from %I.%I where profile_id = $1', tg_table_schema, tg_table_name)
    into current_rows using new.profile_id;
  if current_rows >= max_rows then
    raise exception 'Limit reached: at most % records allowed', max_rows using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger education_row_limit before insert on public.education_records
  for each row execute function public.enforce_row_limit('10');
create trigger skills_row_limit before insert on public.student_skills
  for each row execute function public.enforce_row_limit('50');
create trigger experiences_row_limit before insert on public.experiences
  for each row execute function public.enforce_row_limit('30');
create trigger documents_row_limit before insert on public.documents
  for each row execute function public.enforce_row_limit('30');

-- Editing a verified record sends it back for review.
create or replace function public.reset_verification_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.verification_status = 'verified' and not public.is_admin() then
    new.verification_status := 'unverified';
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$$;

create trigger education_reset_verification before update on public.education_records
  for each row execute function public.reset_verification_on_edit();
create trigger documents_reset_verification before update on public.documents
  for each row execute function public.reset_verification_on_edit();

-- ===========================================================================
-- 8. Consent
-- ===========================================================================
-- Turn employer visibility on or off for the signed-in student, recording consent.
create or replace function public.set_employer_visibility(p_granted boolean, p_version text default '2026-11')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.consent_records (profile_id, consent_type, granted, version, source)
  values (uid, 'employer_visibility', p_granted, p_version, 'app');
  update public.profiles set employer_visibility = p_granted where id = uid;
  return p_granted;
end;
$$;

-- Record a consent decision (terms, privacy, marketing) for the signed-in student.
create or replace function public.record_consent(p_type public.consent_type, p_granted boolean, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_type = 'employer_visibility' then
    raise exception 'Use set_employer_visibility' using errcode = '22023';
  end if;
  insert into public.consent_records (profile_id, consent_type, granted, version, source)
  values (uid, p_type, p_granted, p_version, 'app');
end;
$$;

-- Extend sign-up: record Terms and Privacy acceptance captured on the
-- registration form (passed as user metadata `terms_version`).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  terms_version text := nullif(left(meta ->> 'terms_version', 50), '');
begin
  insert into public.profiles (id, email, first_name, surname)
  values (
    new.id,
    new.email,
    nullif(left(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(meta ->> 'full_name', ' ', 1))), 100), ''),
    nullif(left(trim(coalesce(meta ->> 'surname', meta ->> 'family_name')), 100), '')
  )
  on conflict (id) do nothing;

  if terms_version is not null then
    insert into public.consent_records (profile_id, consent_type, granted, version, source)
    values (new.id, 'terms', true, terms_version, 'signup'),
           (new.id, 'privacy', true, terms_version, 'signup');
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 9. Profile completion
-- ===========================================================================
-- Weighted completion for one student, computed from saved records:
--   personal 15 · education 20 · skills 15 · interests 15 · experience 15 · documents 20
-- Runs with the caller's permissions, so students can only score themselves
-- and administrators can score any student.
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
  filled int;
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

  -- Personal information: 7 required fields
  missing := array_remove(array[
    case when p.first_name is null then 'first_name' end,
    case when p.surname is null then 'surname' end,
    case when p.date_of_birth is null then 'date_of_birth' end,
    case when p.nationality_code is null then 'nationality' end,
    case when p.country_code = 'MZ' and p.province_id is null then 'province' end,
    case when p.city is null then 'city' end,
    case when p.phone is null then 'phone' end
  ], null);
  required := case when p.country_code = 'MZ' then 7 else 6 end;
  personal := round(15.0 * (required - cardinality(missing)) / required, 2);
  personal_missing := missing;

  -- Education: at least one record with a qualification, field and years
  select count(*) into n from public.education_records where profile_id = pid;
  education := case when n > 0 then 20 else 0 end;
  education_missing := case when n > 0 then '{}'::text[] else array['education_record'] end;

  -- Skills: three or more skills for full marks
  select count(*) into n from public.student_skills where profile_id = pid;
  skills := round(15.0 * least(n, 3) / 3, 2);
  skills_missing := case when n >= 3 then '{}'::text[] else array['skills_min_3'] end;

  -- Professional interests: 5 elements
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

  -- Experience: at least one record (internships, volunteering, projects and activities all count)
  select count(*) into n from public.experiences where profile_id = pid;
  experience := case when n > 0 then 15 else 0 end;
  experience_missing := case when n > 0 then '{}'::text[] else array['experience_record'] end;

  -- Documents: CV (10) and academic transcript (10)
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
-- 10. Row Level Security
-- ===========================================================================
-- Reference catalogues: readable by signed-in users; writable by admins only.
do $$
declare
  t text;
begin
  foreach t in array array['provinces', 'institutions', 'qualification_types', 'fields_of_study',
                           'skill_categories', 'skill_catalogue', 'industries', 'job_functions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Signed-in users can read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "Admins can manage %1$s" on public.%1$I for all to authenticated using (public.has_admin_role(''admin'')) with check (public.has_admin_role(''admin''))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Student-owned tables: owner has full access to their rows; admins can read all.
do $$
declare
  t text;
begin
  foreach t in array array['education_records', 'student_skills', 'professional_interests', 'experiences', 'documents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Students manage their own %1$s" on public.%1$I for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id)', t);
    execute format('create policy "Admins can read %1$s" on public.%1$I for select to authenticated using (public.is_admin())', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- Interest join tables
do $$
declare
  t text;
begin
  foreach t in array array['interest_industries', 'interest_job_functions', 'interest_locations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Students manage their own %1$s" on public.%1$I for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id)', t);
    execute format('create policy "Admins can read %1$s" on public.%1$I for select to authenticated using (public.is_admin())', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

grant select, insert, update, delete on public.student_skills, public.professional_interests, public.experiences
  to authenticated;

-- Verification fields are excluded from what students can write.
grant select, delete on public.education_records, public.documents to authenticated;
grant insert (profile_id, institution_id, institution_name_other, institution_type, qualification_type_id,
              qualification_name, field_of_study_id, field_of_study_other, academic_status, year_of_study,
              start_year, end_year, grade, grade_scale, language_of_instruction, sort_order),
      update (institution_id, institution_name_other, institution_type, qualification_type_id,
              qualification_name, field_of_study_id, field_of_study_other, academic_status, year_of_study,
              start_year, end_year, grade, grade_scale, language_of_instruction, sort_order)
  on public.education_records to authenticated;
grant insert (profile_id, document_type, title, storage_path, original_filename, mime_type, size_bytes),
      update (document_type, title)
  on public.documents to authenticated;

-- Profiles: admins can read every profile (students' own-row policy already exists).
create policy "Admins can read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- Notifications: students read theirs and mark them read; created by the server.
alter table public.notifications enable row level security;
create policy "Students read their own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Students mark their own notifications read" on public.notifications
  for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Consent records: students read their own history; writes only via functions.
alter table public.consent_records enable row level security;
create policy "Students read their own consent history" on public.consent_records
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Admins read consent history" on public.consent_records
  for select to authenticated using (public.is_admin());
revoke all on public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;

-- Administrator roles: admins can see who holds roles; no client writes.
alter table public.administrator_roles enable row level security;
create policy "Admins can read role assignments" on public.administrator_roles
  for select to authenticated using (public.is_admin());
revoke all on public.administrator_roles from anon, authenticated;
grant select on public.administrator_roles to authenticated;

-- Audit logs: super admins can read; no client writes, updates or deletes.
alter table public.audit_logs enable row level security;
create policy "Super admins can read the audit log" on public.audit_logs
  for select to authenticated using (public.has_admin_role('super_admin'));
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- ===========================================================================
-- 11. Function privileges
-- ===========================================================================
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.has_admin_role(public.admin_role),
  public.is_admin(),
  public.log_admin_action(text, text, text, jsonb),
  public.set_employer_visibility(boolean, text),
  public.record_consent(public.consent_type, boolean, text),
  public.profile_completion(uuid)
to authenticated;
