-- Handson · Module 2 Step 1 · Migration 3 of 4 · Accounts and account-level suspension
--
-- One row per sign-in account (auth.users), holding the authoritative account
-- status. Suspension now applies to every account, with or without a student
-- profile, and blocks access across all workspaces.
--
-- Account records are created by their own trigger on auth.users, separate
-- from handle_new_user(), so later changes to profile creation can never
-- remove them. Creating the trigger locks auth.users against new rows until
-- this transaction commits, and every existing account is then copied in, so
-- there is no moment at which an account can exist without a record.
--
-- Backward compatibility: profiles.account_status stays and is kept identical
-- to accounts.status by trigger, so everything that reads it (account_is_active,
-- student write policies, upload policy, admin search and export, the current
-- application's suspension check) behaves exactly as before.
-- admin_set_account_status() keeps its signature, return type, errors and
-- audit entries.
--
-- Requires 20261110000200_legal_documents.sql.

-- ===========================================================================
-- 1. Table
-- ===========================================================================
create table public.accounts (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  status             public.account_status not null default 'active',
  status_changed_at  timestamptz,
  status_changed_by  uuid references auth.users (id) on delete set null,
  status_reason      text check (char_length(status_reason) <= 500),
  created_at         timestamptz not null default now()
);
comment on table public.accounts is
  'One row per sign-in account. status is authoritative; profiles.account_status mirrors it for backward compatibility.';

-- ===========================================================================
-- 2. Every new account gets a record (fires before on_auth_user_created)
-- ===========================================================================
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Triggers for the same event fire in name order; this name sorts before
-- on_auth_user_created, so the account record exists before the profile.
create trigger on_auth_user_account_created
after insert on auth.users
for each row execute function public.handle_new_account();

-- ===========================================================================
-- 3. Copy in every existing account, keeping current suspensions
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
begin
  select count(*) into users_n from auth.users;
  select count(*) into accounts_n from public.accounts;
  if users_n <> accounts_n then
    raise exception 'accounts backfill: % users but % account records; migration stopped', users_n, accounts_n;
  end if;
end;
$$;

-- ===========================================================================
-- 4. Mirror status to profiles.account_status (backward compatibility)
-- ===========================================================================
create or replace function public.accounts_mirror_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set account_status = new.status
   where id = new.user_id and account_status is distinct from new.status;
  return new;
end;
$$;

create trigger accounts_mirror_status
after insert or update of status on public.accounts
for each row execute function public.accounts_mirror_status();

-- New profiles take the account's status; changes to profiles.account_status
-- must match the account (only the mirror trigger produces such changes).
create or replace function public.profiles_account_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.account_status;
begin
  select status into acct from public.accounts where user_id = new.id;
  if acct is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.account_status := acct;
  elsif new.account_status is distinct from acct then
    raise exception 'Account status is managed on the account, not the profile' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_account_status_guard
before insert or update of account_status on public.profiles
for each row execute function public.profiles_account_status_guard();

-- ===========================================================================
-- 5. Helpers
-- ===========================================================================
-- True when the signed-in account exists and is not suspended.
create or replace function public.person_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.status = 'active' from public.accounts a where a.user_id = (select auth.uid())),
    false
  );
$$;

-- Same signature; a suspended account no longer holds any administrator role.
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
  )
  and not exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid()) and a.status = 'suspended'
  );
$$;

-- ===========================================================================
-- 6. Suspension and reactivation of any account
-- ===========================================================================
-- Admins and above. Suspending an account that holds an administrator role
-- requires a super admin; nobody can change their own status; the last
-- active super admin cannot be suspended.
create or replace function public.admin_set_user_status(
  p_user uuid,
  p_status public.account_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.account_status;
  target_role public.admin_role;
  has_profile boolean;
begin
  perform public.require_admin_role('admin');
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own account status' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  select status into current_status from public.accounts where user_id = p_user for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  select role into target_role from public.administrator_roles
   where user_id = p_user and revoked_at is null;
  if target_role is not null and not public.has_admin_role('super_admin') then
    raise exception 'Only a super administrator can change the status of an administrator' using errcode = '42501';
  end if;
  if p_status = 'suspended' and target_role = 'super_admin' and not exists (
       select 1 from public.administrator_roles r
       join public.accounts a on a.user_id = r.user_id
       where r.role = 'super_admin' and r.revoked_at is null and a.status = 'active' and r.user_id <> p_user) then
    raise exception 'The last active super administrator cannot be suspended' using errcode = '22023';
  end if;

  update public.accounts
     set status = p_status, status_changed_at = now(), status_changed_by = (select auth.uid()),
         status_reason = left(p_reason, 500)
   where user_id = p_user;

  has_profile := exists (select 1 from public.profiles where id = p_user);
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), 'account.' || case when p_status = 'suspended' then 'suspended' else 'reactivated' end,
          case when has_profile then 'profiles' else 'accounts' end, p_user::text,
          jsonb_build_object('reason', left(p_reason, 500)));
end;
$$;

-- Existing student-page action: same signature, errors and audit entries.
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
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  perform public.admin_set_user_status(p_profile, p_status, p_reason);
end;
$$;

-- Legal acceptance: use the account-level check.
create or replace function public.accept_legal_documents(p_terms_id uuid default null, p_privacy_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cur_terms uuid;
  cur_privacy uuid;
  doc record;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.person_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  if p_terms_id is null and p_privacy_id is null then
    raise exception 'Choose at least one document' using errcode = '22023';
  end if;

  select d.id into cur_terms from public.current_legal_documents() d where d.kind = 'terms';
  select d.id into cur_privacy from public.current_legal_documents() d where d.kind = 'privacy';
  if cur_terms is null or cur_privacy is null then
    raise exception 'The legal documents are not yet in force' using errcode = '22023';
  end if;
  if (p_terms_id is not null and p_terms_id <> cur_terms)
     or (p_privacy_id is not null and p_privacy_id <> cur_privacy) then
    raise exception 'This version is no longer current. Please reload the page.' using errcode = '22023';
  end if;

  for doc in
    select d.id, d.kind, d.version from public.legal_documents d
    where d.id in (p_terms_id, p_privacy_id)
  loop
    insert into public.consent_records (user_id, consent_type, granted, version, source, document_id, action)
    values (uid, doc.kind::text::public.consent_type, true, doc.version, 'app', doc.id,
            case when doc.kind = 'terms' then 'accepted' else 'acknowledged' end)
    on conflict (user_id, document_id) where document_id is not null do nothing;
  end loop;

  return public.legal_acceptance_status();
end;
$$;

-- ===========================================================================
-- 7. Row Level Security
-- ===========================================================================
alter table public.accounts enable row level security;
create policy "Users read their own account" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Admins read accounts" on public.accounts
  for select to authenticated using (public.is_admin());
revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;

-- ===========================================================================
-- 8. Function privileges
-- ===========================================================================
revoke execute on function
  public.handle_new_account(),
  public.accounts_mirror_status(),
  public.profiles_account_status_guard(),
  public.person_is_active(),
  public.admin_set_user_status(uuid, public.account_status, text)
from public, anon, authenticated;

grant execute on function
  public.person_is_active(),
  public.admin_set_user_status(uuid, public.account_status, text)
to authenticated;
