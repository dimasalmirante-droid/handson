-- Handson · Module 2 Step 1 · Migration 1 of 4 · Consent belongs to the account
--
-- Expand phase of an expand-and-contract change. Consent records gain a
-- `user_id` column that references the account (auth.users) rather than the
-- student profile, so people without a student profile (for example
-- employer-only users) can have consent recorded.
--
-- Backward compatibility with the application currently deployed:
--   * `profile_id` stays, keeps its values and is still filled for every
--     account that has a student profile, so existing queries by profile_id
--     return exactly the same rows.
--   * Existing functions keep writing `profile_id`; a trigger fills `user_id`.
--   * The existing read policy is kept; a new, equivalent policy on user_id
--     is added alongside it.
--   * Removing `profile_id` is a separate, later migration (contract phase).
--
-- Safeguards:
--   * A check constraint rejects rows where profile_id and user_id differ.
--   * Deleting a student profile no longer deletes consent history
--     (profile_id is cleared instead). Deleting the account still removes it.
--
-- Runs as a single transaction (the migration workflow applies each file with
-- psql --single-transaction).

-- ---------------------------------------------------------------------------
-- 1. Pre-check: every existing record belongs to an existing account
-- ---------------------------------------------------------------------------
do $$
declare
  orphans bigint;
begin
  select count(*) into orphans
  from public.consent_records c
  where not exists (select 1 from auth.users u where u.id = c.profile_id);
  if orphans > 0 then
    raise exception 'consent_records: % row(s) do not match an account; migration stopped, nothing changed', orphans;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Add user_id and fill it from profile_id (same identifier)
-- ---------------------------------------------------------------------------
alter table public.consent_records
  add column user_id uuid references auth.users (id) on delete cascade;

update public.consent_records set user_id = profile_id where user_id is null;

alter table public.consent_records alter column user_id set not null;

create index consent_records_user_idx on public.consent_records (user_id, consent_type, created_at desc);

comment on column public.consent_records.user_id is
  'The account the consent belongs to. Replaces profile_id, which is kept temporarily for backward compatibility.';

-- ---------------------------------------------------------------------------
-- 3. profile_id: optional, consistent with user_id, and no longer deletes
--    consent history when a student profile is deleted
-- ---------------------------------------------------------------------------
do $$
declare
  fk text;
begin
  select con.conname into fk
  from pg_constraint con
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
  where con.conrelid = 'public.consent_records'::regclass
    and con.contype = 'f'
    and att.attname = 'profile_id';
  if fk is null then
    raise exception 'consent_records.profile_id foreign key not found; migration stopped';
  end if;
  execute format('alter table public.consent_records drop constraint %I', fk);
end;
$$;

alter table public.consent_records
  alter column profile_id drop not null,
  add constraint consent_records_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete set null,
  add constraint consent_records_profile_matches_user
    check (profile_id is null or profile_id = user_id);

comment on column public.consent_records.profile_id is
  'Deprecated: use user_id. Kept for backward compatibility and removed in a later migration.';

-- Fill whichever identifier is missing. The check constraint above rejects
-- inconsistent pairs; the profile foreign key rejects a profile_id with no
-- matching profile.
create or replace function public.consent_records_sync_ids()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    new.user_id := new.profile_id;
  end if;
  if new.profile_id is null and exists (select 1 from public.profiles p where p.id = new.user_id) then
    new.profile_id := new.user_id;
  end if;
  return new;
end;
$$;

create trigger consent_records_sync_ids
before insert on public.consent_records
for each row execute function public.consent_records_sync_ids();

-- ---------------------------------------------------------------------------
-- 4. Read policy on user_id (the existing profile_id policy stays for now)
-- ---------------------------------------------------------------------------
create policy "Users read their own consent history" on public.consent_records
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.consent_records_sync_ids() from public, anon, authenticated;
