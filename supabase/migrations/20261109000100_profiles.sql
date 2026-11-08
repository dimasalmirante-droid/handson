-- Handson · Phase 2 · Student profiles (foundation)
--
-- Creates one profile row per Supabase Auth user, automatically, at sign-up.
-- Phase 3 extends this table and adds the rest of the schema.
--
-- Security model:
--   * Row Level Security is ON. Students can read and update only their own row.
--   * Rows are created only by the trigger below (no INSERT policy for clients).
--   * Students cannot change their own role, status or audit fields: those
--     columns are not grantable to the `authenticated` role.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    extensions.citext not null,
  first_name               text check (char_length(first_name) <= 100),
  middle_name              text check (char_length(middle_name) <= 100),
  surname                  text check (char_length(surname) <= 100),
  preferred_locale         text not null default 'en' check (preferred_locale in ('en', 'pt')),
  time_zone                text not null default 'Africa/Maputo',
  onboarding_step          smallint not null default 1 check (onboarding_step between 1 and 7),
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.profiles is 'One row per student account. Private by default; visible only to its owner and authorised administrators.';

create unique index profiles_email_key on public.profiles (email);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (reused by later tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile when a new auth user is created (email or Google).
-- Names come from sign-up metadata (email) or the Google profile.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, first_name, surname)
  values (
    new.id,
    new.email,
    nullif(left(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(meta ->> 'full_name', ' ', 1))), 100), ''),
    nullif(left(trim(coalesce(meta ->> 'surname', meta ->> 'family_name')), 100), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep the profile email in sync if the user changes their login email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Students can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Students can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Column-level privileges: clients may update only these fields.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, middle_name, surname, preferred_locale, onboarding_step, onboarding_completed_at)
  on public.profiles to authenticated;
