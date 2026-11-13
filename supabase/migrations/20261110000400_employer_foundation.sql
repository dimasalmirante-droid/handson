-- Handson · Module 2 Step 1 · Migration 4 of 4 · Employer foundation
--
-- Companies, company membership with roles, invitations, the company-scoped
-- audit trail, and the functions that decide which workspaces a person has.
-- Step 1 grants read access only (through Row Level Security); every write
-- goes through the functions below. No employer screens use these yet.
--
-- Security
--   * Strict tenant isolation: company data is visible only to that
--     company's members (and Handson administrators). Internal notes are
--     visible to Handson administrators only.
--   * Helpers answer only about the caller (auth.uid()); none takes a user id.
--   * A suspended account loses all company access; a suspended company
--     blocks its members, without affecting their other workspaces.
--   * Invitation tokens are stored only as SHA-256 hashes. Access is granted
--     only by accept_invitation(), after every check, in one transaction.
--   * Every function has a fixed, empty search_path, fully qualified names
--     and explicit execute grants.
--
-- Sign-up: handle_new_user() still creates a student profile for every new
-- account, except when a valid pending invitation exists for the email and
-- the sign-up was not marked as a student registration. Account records are
-- created by the separate trigger from migration 3, which is checked at the
-- end of this file.
--
-- Requires 20261110000300_accounts.sql.

-- ===========================================================================
-- 1. Types
-- ===========================================================================
create type public.company_status as enum ('onboarding', 'active', 'suspended');
create type public.company_role as enum ('viewer', 'editor', 'company_admin');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- ===========================================================================
-- 2. Tables
-- ===========================================================================
create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(btrim(name)) between 2 and 200),
  slug               text not null unique
                       check (char_length(slug) between 2 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status             public.company_status not null default 'onboarding',
  status_changed_at  timestamptz,
  status_changed_by  uuid references auth.users (id) on delete set null,
  status_reason      text check (char_length(status_reason) <= 500),
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.companies is 'Employer workspaces. Visible to their members and Handson administrators.';

create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();

create table public.company_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index company_admin_notes_company_idx on public.company_admin_notes (company_id, created_at desc);
comment on table public.company_admin_notes is 'Internal Handson notes about a company. Handson administrators only; never shown to company members.';

create table public.company_members (
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.company_role not null,
  full_name   text check (char_length(full_name) <= 200),
  job_title   text check (char_length(job_title) <= 200),
  added_by    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.company_invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  email        extensions.citext not null
                 check (email::text = lower(btrim(email::text)) and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                        and char_length(email::text) <= 320),
  role         public.company_role not null,
  full_name    text check (char_length(full_name) <= 200),
  job_title    text check (char_length(job_title) <= 200),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status       public.invitation_status not null default 'pending',
  expires_at   timestamptz not null,
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  send_count   integer not null default 0 check (send_count >= 0),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,
  constraint company_invitations_expiry check (expires_at > created_at)
);
-- At most one open invitation per company and email (case-insensitive).
create unique index company_invitations_one_pending
  on public.company_invitations (company_id, email) where status = 'pending';
create index company_invitations_email_idx on public.company_invitations (email) where status = 'pending';
comment on column public.company_invitations.token_hash is 'SHA-256 of the invitation token (hex). The token itself is never stored.';

-- Company-scoped audit trail.
alter table public.audit_logs add column company_id uuid references public.companies (id) on delete set null;
create index audit_logs_company_idx on public.audit_logs (company_id, created_at desc) where company_id is not null;

-- ===========================================================================
-- 3. Helpers (about the caller only)
-- ===========================================================================
create or replace function public.is_company_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.person_is_active() and exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_company_role(p_company uuid, p_min public.company_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.person_is_active() and exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.user_id = (select auth.uid()) and m.role >= p_min
  );
$$;

-- Onboarding and active companies are writable; only suspension blocks members.
create or replace function public.company_is_writable(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = p_company and c.status <> 'suspended');
$$;

-- ===========================================================================
-- 4. Row Level Security (read-only in Step 1)
-- ===========================================================================
alter table public.companies enable row level security;
create policy "Members read their company" on public.companies
  for select to authenticated using (public.is_company_member(id));
create policy "Admins read companies" on public.companies
  for select to authenticated using (public.is_admin());

alter table public.company_admin_notes enable row level security;
create policy "Admins read internal notes" on public.company_admin_notes
  for select to authenticated using (public.is_admin());

alter table public.company_members enable row level security;
create policy "Members read their colleagues" on public.company_members
  for select to authenticated
  using (public.is_company_member(company_id) and public.company_is_writable(company_id));
create policy "Admins read members" on public.company_members
  for select to authenticated using (public.is_admin());

alter table public.company_invitations enable row level security;
create policy "Company admins read their invitations" on public.company_invitations
  for select to authenticated
  using (public.has_company_role(company_id, 'company_admin') and public.company_is_writable(company_id));
create policy "Admins read invitations" on public.company_invitations
  for select to authenticated using (public.is_admin());

revoke all on public.companies, public.company_admin_notes, public.company_members, public.company_invitations
  from anon, authenticated;
grant select on public.companies, public.company_admin_notes, public.company_members to authenticated;
-- Everything except the token hash.
grant select (id, company_id, email, role, full_name, job_title, status, expires_at, invited_by, created_at,
              last_sent_at, send_count, accepted_at, accepted_by, revoked_at, revoked_by)
  on public.company_invitations to authenticated;

-- ===========================================================================
-- 5. Workspaces available to the caller
-- ===========================================================================
-- {user_id, account_status, student: {onboarding_completed} | null,
--  admin_role: text | null, companies: [{id, name, slug, status, role}]}
create or replace function public.my_contexts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_status public.account_status;
  v_student jsonb;
  v_admin public.admin_role;
  v_companies jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select a.status into v_status from public.accounts a where a.user_id = uid;
  v_status := coalesce(v_status, 'active');
  if v_status = 'suspended' then
    return jsonb_build_object('user_id', uid, 'account_status', v_status, 'student', null,
                              'admin_role', null, 'companies', '[]'::jsonb);
  end if;

  select jsonb_build_object('onboarding_completed', p.onboarding_completed_at is not null)
    into v_student
  from public.profiles p where p.id = uid;

  select r.role into v_admin from public.administrator_roles r
   where r.user_id = uid and r.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug,
                                               'status', c.status, 'role', m.role) order by c.name), '[]'::jsonb)
    into v_companies
  from public.company_members m join public.companies c on c.id = m.company_id
  where m.user_id = uid;

  return jsonb_build_object('user_id', uid, 'account_status', v_status, 'student', v_student,
                            'admin_role', v_admin, 'companies', v_companies);
end;
$$;

-- Valid invitations addressed to the caller's verified email.
create or replace function public.my_pending_invitations()
returns table (company_name text, role public.company_role, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mail text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.person_is_active() then
    return;
  end if;
  select lower(u.email) into mail from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if mail is null then
    return;
  end if;
  return query
  select c.name, i.role, i.expires_at
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where i.email = mail::extensions.citext
    and i.status = 'pending' and i.expires_at > now() and c.status <> 'suspended'
    and not exists (select 1 from public.company_members m where m.company_id = i.company_id and m.user_id = uid)
  order by i.created_at;
end;
$$;

-- Create the caller's own student profile (once). Independent of invitations.
create or replace function public.create_student_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  usr record;
  meta jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.person_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'You already have a student profile' using errcode = '23505';
  end if;
  select u.email, u.raw_user_meta_data into usr from auth.users u where u.id = uid;
  meta := coalesce(usr.raw_user_meta_data, '{}'::jsonb);
  insert into public.profiles (id, email, first_name, surname)
  values (
    uid,
    usr.email,
    nullif(left(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(meta ->> 'full_name', ' ', 1))), 100), ''),
    nullif(left(trim(coalesce(meta ->> 'surname', meta ->> 'family_name')), 100), '')
  );
  -- Link earlier account-level consent records to the new profile (backward compatibility).
  update public.consent_records set profile_id = uid where user_id = uid and profile_id is null;
  return uid;
end;
$$;

-- ===========================================================================
-- 6. Invitations
-- ===========================================================================
-- What the invitation page may show before sign-in: company, role, masked email.
create or replace function public.invitation_preview(p_token_hash text)
returns table (company_name text, role public.company_role, email_hint text,
               expires_at timestamptz, status public.invitation_status)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, i.role,
         left(i.email::text, 1) || '•••@' || split_part(i.email::text, '@', 2),
         i.expires_at,
         case when i.status = 'pending' and (i.expires_at <= now() or c.status = 'suspended')
              then 'expired'::public.invitation_status else i.status end
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where p_token_hash ~ '^[0-9a-f]{64}$' and i.token_hash = p_token_hash;
$$;

-- Accept an invitation. Grants membership only when the token hash matches a
-- pending, unexpired invitation; the caller's verified email equals the
-- invited email; the account is active; the company is not suspended; and the
-- caller is not already a member. One transaction; the invitation row is
-- locked, so it can be used once only.
create or replace function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.company_invitations;
  usr record;
  cstatus public.company_status;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.person_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  select * into inv from public.company_invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.status = 'accepted' then
    raise exception 'This invitation has already been used' using errcode = '22023';
  elsif inv.status = 'revoked' then
    raise exception 'This invitation has been withdrawn' using errcode = '22023';
  elsif inv.status = 'expired' or inv.expires_at <= now() then
    raise exception 'This invitation has expired' using errcode = '22023';
  end if;

  select u.email, u.email_confirmed_at into usr from auth.users u where u.id = uid;
  if usr.email_confirmed_at is null then
    raise exception 'Verify your email address first' using errcode = '42501';
  end if;
  if lower(usr.email) <> inv.email::text then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  select status into cstatus from public.companies where id = inv.company_id for share;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '42501';
  end if;
  if exists (select 1 from public.company_members where company_id = inv.company_id and user_id = uid) then
    raise exception 'You are already a member of this company' using errcode = '22023';
  end if;

  insert into public.company_members (company_id, user_id, role, full_name, job_title, added_by)
  values (inv.company_id, uid, inv.role, inv.full_name, inv.job_title, inv.invited_by);

  update public.company_invitations
     set status = 'accepted', accepted_at = now(), accepted_by = uid
   where id = inv.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (uid, 'invitation.accepted', 'company_invitations', inv.id::text, inv.company_id,
          jsonb_build_object('role', inv.role));
  return inv.company_id;
end;
$$;

-- ===========================================================================
-- 7. Administration (Handson admins and above)
-- ===========================================================================
create or replace function public.admin_create_company(p_name text, p_slug text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  v_slug text := lower(btrim(p_slug));
begin
  perform public.require_admin_role('admin');
  if coalesce(char_length(btrim(p_name)), 0) < 2 then
    raise exception 'Enter the company name' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) not between 2 and 80 then
    raise exception 'Use lower-case letters, numbers and hyphens for the web address' using errcode = '22023';
  end if;
  if exists (select 1 from public.companies c where c.slug = v_slug) then
    raise exception 'This web address is already used' using errcode = '22023';
  end if;
  insert into public.companies (name, slug, created_by)
  values (btrim(p_name), v_slug, (select auth.uid()))
  returning id into new_id;
  if nullif(btrim(p_note), '') is not null then
    insert into public.company_admin_notes (company_id, body, created_by)
    values (new_id, btrim(p_note), (select auth.uid()));
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values ((select auth.uid()), 'company.created', 'companies', new_id::text, new_id,
          jsonb_build_object('name', btrim(p_name), 'slug', v_slug));
  return new_id;
end;
$$;

-- Create an invitation. The token is generated by the server; only its hash
-- arrives here. An expired pending invitation for the same company and email
-- is marked expired first, so expiry never blocks a new invitation.
create or replace function public.admin_create_invitation(
  p_company uuid,
  p_email text,
  p_role public.company_role,
  p_full_name text,
  p_job_title text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text := lower(btrim(p_email));
  cstatus public.company_status;
  prior public.company_invitations;
  new_id uuid;
begin
  perform public.require_admin_role('admin');
  if mail is null or mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 320 then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if p_role is null then
    raise exception 'Choose a role' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at < now() + interval '1 hour' or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid expiry' using errcode = '22023';
  end if;

  -- Lock the company: invitations for one company are created one at a time.
  select status into cstatus from public.companies where id = p_company for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company is suspended' using errcode = '22023';
  end if;

  select * into prior from public.company_invitations
   where company_id = p_company and email = mail::extensions.citext and status = 'pending'
   for update;
  if found then
    if prior.expires_at <= now() then
      update public.company_invitations set status = 'expired' where id = prior.id;
      insert into public.audit_logs (actor_id, action, target_table, target_id, company_id)
      values ((select auth.uid()), 'invitation.expired', 'company_invitations', prior.id::text, p_company);
    else
      raise exception 'An invitation is already pending for this email. Resend or revoke it instead.' using errcode = '22023';
    end if;
  end if;

  if exists (select 1 from public.company_members m join auth.users u on u.id = m.user_id
             where m.company_id = p_company and lower(u.email) = mail) then
    raise exception 'This person is already a member of the company' using errcode = '22023';
  end if;

  insert into public.company_invitations (company_id, email, role, full_name, job_title, token_hash, expires_at, invited_by)
  values (p_company, mail, p_role, nullif(left(btrim(p_full_name), 200), ''), nullif(left(btrim(p_job_title), 200), ''),
          p_token_hash, p_expires_at, (select auth.uid()))
  returning id into new_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values ((select auth.uid()), 'invitation.created', 'company_invitations', new_id::text, p_company,
          jsonb_build_object('role', p_role, 'expires_at', p_expires_at));
  return new_id;
end;
$$;

-- ===========================================================================
-- 8. Sign-up: student profile unless an invitation says otherwise
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  terms_version text := nullif(left(meta ->> 'terms_version', 50), '');
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  terms_id uuid;
  privacy_id uuid;
  create_profile boolean := true;
begin
  -- An invited person registering from the invitation page (email or Google)
  -- does not get a student profile automatically. The decision uses only
  -- data in the database. The student marker can only ADD a profile for the
  -- person themselves; it never grants anything.
  if coalesce(meta ->> 'signup_intent', '') <> 'student' and new.email is not null and exists (
       select 1 from public.company_invitations i
       join public.companies c on c.id = i.company_id
       where i.email = lower(new.email)::extensions.citext
         and i.status = 'pending' and i.expires_at > now() and c.status <> 'suspended') then
    create_profile := false;
  end if;

  if create_profile then
    insert into public.profiles (id, email, first_name, surname)
    values (
      new.id,
      new.email,
      nullif(left(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(meta ->> 'full_name', ' ', 1))), 100), ''),
      nullif(left(trim(coalesce(meta ->> 'surname', meta ->> 'family_name')), 100), '')
    )
    on conflict (id) do nothing;
  end if;

  if terms_version is not null then
    insert into public.consent_records (user_id, consent_type, granted, version, source)
    values (new.id, 'terms', true, terms_version, 'signup'),
           (new.id, 'privacy', true, terms_version, 'signup');
  end if;

  if coalesce(meta ->> 'legal_terms_id', '') ~ uuid_re and coalesce(meta ->> 'legal_privacy_id', '') ~ uuid_re then
    select d.id into terms_id from public.current_legal_documents() d
     where d.kind = 'terms' and d.id = (meta ->> 'legal_terms_id')::uuid;
    select d.id into privacy_id from public.current_legal_documents() d
     where d.kind = 'privacy' and d.id = (meta ->> 'legal_privacy_id')::uuid;
    if terms_id is not null and privacy_id is not null then
      insert into public.consent_records (user_id, consent_type, granted, version, source, document_id, action)
      select new.id, d.kind::text::public.consent_type, true, d.version, 'signup', d.id,
             case when d.kind = 'terms' then 'accepted' else 'acknowledged' end
      from public.legal_documents d where d.id in (terms_id, privacy_id)
      on conflict (user_id, document_id) where document_id is not null do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 9. Function privileges
-- ===========================================================================
revoke execute on function
  public.is_company_member(uuid),
  public.has_company_role(uuid, public.company_role),
  public.company_is_writable(uuid),
  public.my_contexts(),
  public.my_pending_invitations(),
  public.create_student_profile(),
  public.invitation_preview(text),
  public.accept_invitation(text),
  public.admin_create_company(text, text, text),
  public.admin_create_invitation(uuid, text, public.company_role, text, text, text, timestamptz),
  public.handle_new_user()
from public, anon, authenticated;

grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function
  public.is_company_member(uuid),
  public.has_company_role(uuid, public.company_role),
  public.company_is_writable(uuid),
  public.my_contexts(),
  public.my_pending_invitations(),
  public.create_student_profile(),
  public.accept_invitation(text),
  public.admin_create_company(text, text, text),
  public.admin_create_invitation(uuid, text, public.company_role, text, text, text, timestamptz)
to authenticated;

-- ===========================================================================
-- 10. Final check: every account has a record and the account trigger is in place
-- ===========================================================================
insert into public.accounts (user_id, status)
select u.id, coalesce(p.account_status, 'active')
from auth.users u
left join public.profiles p on p.id = u.id
on conflict (user_id) do nothing;

do $$
declare
  users_n bigint;
  accounts_n bigint;
  first_insert_trigger text;
begin
  select count(*) into users_n from auth.users;
  select count(*) into accounts_n from public.accounts;
  if users_n <> accounts_n then
    raise exception 'accounts check: % users but % account records; migration stopped', users_n, accounts_n;
  end if;

  if not exists (select 1 from pg_trigger
                 where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_account_created'
                   and tgenabled in ('O', 'A') and not tgisinternal) then
    raise exception 'accounts check: trigger on_auth_user_account_created is missing or disabled; migration stopped';
  end if;

  -- Row-level AFTER INSERT triggers on auth.users fire in name order.
  select tgname into first_insert_trigger
  from pg_trigger
  where tgrelid = 'auth.users'::regclass and not tgisinternal
    and (tgtype & 1) = 1      -- row level
    and (tgtype & 2) = 0      -- after
    and (tgtype & 4) = 4      -- insert
  order by tgname collate "C"
  limit 1;
  if first_insert_trigger is distinct from 'on_auth_user_account_created' then
    raise exception 'accounts check: % fires before the account trigger; migration stopped', first_insert_trigger;
  end if;
end;
$$;
