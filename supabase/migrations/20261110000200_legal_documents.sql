-- Handson · Module 2 Step 1 · Migration 2 of 4 · Legal documents and acceptance
--
-- Versioned Terms and Conditions and Privacy Notice, and an explicit record
-- of each account's acceptance (Terms) and acknowledgement (Privacy Notice).
--
-- Rules
--   * Documents are created as drafts by super administrators. Published
--     versions can never be edited or deleted; a change is a new version.
--   * The current version of each kind is the published version with the
--     latest effective date that has already passed.
--   * Acceptance is required only when BOTH a current Terms version and a
--     current Privacy Notice version exist. Until then nobody is asked to
--     accept anything (no draft or placeholder can be accepted).
--   * Each document is tracked separately: when only one is replaced, only
--     that one needs action.
--   * accept_legal_documents() accepts only the exact current versions.
--   * Optional consents (employer visibility, marketing) are separate and
--     unaffected.
--
-- Backward compatibility: handle_new_user() still records the legacy
-- `terms_version` sign-up metadata exactly as before (as a historical record,
-- not linked to a document version). set_employer_visibility() and
-- record_consent() keep their signatures and return values.
--
-- Requires 20261110000100_consent_user_id.sql.

-- ===========================================================================
-- 1. Documents
-- ===========================================================================
create type public.legal_document_kind as enum ('terms', 'privacy');

create table public.legal_documents (
  id            uuid primary key default gen_random_uuid(),
  kind          public.legal_document_kind not null,
  version       text not null check (version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$'),
  title         text not null check (char_length(btrim(title)) between 3 and 200),
  summary       text check (char_length(summary) <= 2000),
  body          text not null check (char_length(btrim(body)) between 1 and 200000),
  effective_at  timestamptz not null,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  published_by  uuid references auth.users (id) on delete set null,
  unique (kind, version),
  constraint legal_documents_published_fields check ((status = 'published') = (published_at is not null))
);
create index legal_documents_current_idx on public.legal_documents (kind, effective_at desc) where status = 'published';
comment on table public.legal_documents is
  'Versioned Terms and Privacy Notice. Drafts are visible to super admins only; published versions are public and immutable.';

-- Published versions cannot be changed or deleted, by anyone.
create or replace function public.legal_documents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'Published legal documents cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'published' then
    raise exception 'Published legal documents cannot be changed; publish a new version instead' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger legal_documents_guard
before update or delete on public.legal_documents
for each row execute function public.legal_documents_guard();

-- ===========================================================================
-- 2. Consent records: link to the exact document version
-- ===========================================================================
alter table public.consent_records
  add column document_id uuid references public.legal_documents (id) on delete restrict,
  add column action text check (action in ('accepted', 'acknowledged')),
  add constraint consent_records_document_action check ((document_id is null) = (action is null));

-- One acceptance per account per document version (makes acceptance idempotent).
create unique index consent_records_user_document_key
  on public.consent_records (user_id, document_id) where document_id is not null;

comment on column public.consent_records.action is
  'For legal documents: accepted (Terms) or acknowledged (Privacy Notice). Null for older records and optional consents.';

-- ===========================================================================
-- 3. Current versions and the caller's acceptance status
-- ===========================================================================
-- The current, effective version of each kind (none until published and effective).
create or replace function public.current_legal_documents()
returns table (id uuid, kind public.legal_document_kind, version text, title text, summary text,
               effective_at timestamptz, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (d.kind) d.id, d.kind, d.version, d.title, d.summary, d.effective_at, d.published_at
  from public.legal_documents d
  where d.status = 'published' and d.effective_at <= now()
  order by d.kind, d.effective_at desc, d.published_at desc;
$$;

-- For the signed-in account: is acceptance in force, and which documents
-- still need action? {active: bool, required: [{id, kind, version, title, summary, effective_at}]}
create or replace function public.legal_acceptance_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  docs jsonb;
  n int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select count(*) into n from public.current_legal_documents();
  if n < 2 then
    return jsonb_build_object('active', false, 'required', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'kind', d.kind, 'version', d.version, 'title', d.title,
           'summary', d.summary, 'effective_at', d.effective_at) order by d.kind), '[]'::jsonb)
    into docs
  from public.current_legal_documents() d
  where not exists (
    select 1 from public.consent_records c
    where c.user_id = uid and c.document_id = d.id
      and c.action = case when d.kind = 'terms' then 'accepted' else 'acknowledged' end
  );
  return jsonb_build_object('active', true, 'required', docs);
end;
$$;

-- Record acceptance of the Terms and/or acknowledgement of the Privacy
-- Notice. Each id must be exactly the current, effective version of its kind.
-- Repeating an acceptance has no effect. Returns the updated status.
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
  -- Replaced in migration 3 by the account-level check.
  if exists (select 1 from public.profiles p where p.id = uid and p.account_status = 'suspended') then
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
-- 4. Administration (super admins)
-- ===========================================================================
-- Create (p_id null) or update a draft. Published versions cannot be edited.
create or replace function public.admin_save_legal_draft(
  p_id uuid,
  p_kind public.legal_document_kind,
  p_version text,
  p_title text,
  p_summary text,
  p_body text,
  p_effective_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_id uuid;
begin
  perform public.require_admin_role('super_admin');
  if p_id is null then
    if exists (select 1 from public.legal_documents d where d.kind = p_kind and d.version = btrim(p_version)) then
      raise exception 'This version number is already used' using errcode = '22023';
    end if;
    insert into public.legal_documents (kind, version, title, summary, body, effective_at, created_by)
    values (p_kind, btrim(p_version), btrim(p_title), nullif(btrim(p_summary), ''), p_body, p_effective_at, (select auth.uid()))
    returning id into doc_id;
  else
    update public.legal_documents
       set kind = p_kind, version = btrim(p_version), title = btrim(p_title),
           summary = nullif(btrim(p_summary), ''), body = p_body, effective_at = p_effective_at
     where id = p_id and status = 'draft'
     returning id into doc_id;
    if doc_id is null then
      raise exception 'Draft not found, or already published' using errcode = 'P0002';
    end if;
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), 'legal.draft_saved', 'legal_documents', doc_id::text,
          jsonb_build_object('kind', p_kind, 'version', btrim(p_version)));
  return doc_id;
end;
$$;

-- Publish a draft. Irreversible. Its effective date must be later than the
-- effective date of every version of the same kind already published.
create or replace function public.admin_publish_legal_document(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.legal_documents;
begin
  perform public.require_admin_role('super_admin');
  select * into doc from public.legal_documents where id = p_id for update;
  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if doc.status <> 'draft' then
    raise exception 'This version is already published' using errcode = '22023';
  end if;
  if exists (select 1 from public.legal_documents d
             where d.kind = doc.kind and d.status = 'published' and d.effective_at >= doc.effective_at) then
    raise exception 'The effective date must be later than the current published version' using errcode = '22023';
  end if;
  update public.legal_documents
     set status = 'published', published_at = now(), published_by = (select auth.uid())
   where id = p_id;
  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values ((select auth.uid()), 'legal.published', 'legal_documents', p_id::text,
          jsonb_build_object('kind', doc.kind, 'version', doc.version, 'effective_at', doc.effective_at));
end;
$$;

-- Delete an unpublished draft.
create or replace function public.admin_delete_legal_draft(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_role('super_admin');
  delete from public.legal_documents where id = p_id and status = 'draft';
  if not found then
    raise exception 'Draft not found, or already published' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values ((select auth.uid()), 'legal.draft_deleted', 'legal_documents', p_id::text);
end;
$$;

-- ===========================================================================
-- 5. Existing consent functions: same signatures and return values
-- ===========================================================================
-- Employer visibility is part of the student profile; refuse when there is none.
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
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'Create a student profile first' using errcode = 'P0002';
  end if;
  insert into public.consent_records (user_id, consent_type, granted, version, source)
  values (uid, 'employer_visibility', p_granted, p_version, 'app');
  update public.profiles set employer_visibility = p_granted where id = uid;
  return p_granted;
end;
$$;

-- Unchanged behaviour; now keyed on the account so it also works without a student profile.
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
  insert into public.consent_records (user_id, consent_type, granted, version, source)
  values (uid, p_type, p_granted, p_version, 'app');
end;
$$;

-- Sign-up: creates the student profile exactly as before; records the legacy
-- `terms_version` metadata as before; and, when the registration form sends
-- the ids of the current legal documents, records them as acceptance and
-- acknowledgement (only if they are still the exact current versions).
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
-- 6. Row Level Security
-- ===========================================================================
alter table public.legal_documents enable row level security;
create policy "Anyone can read published legal documents" on public.legal_documents
  for select to anon, authenticated using (status = 'published');
create policy "Super admins read all legal documents" on public.legal_documents
  for select to authenticated using (public.has_admin_role('super_admin'));
revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

-- ===========================================================================
-- 7. Function privileges
-- ===========================================================================
revoke execute on function
  public.legal_documents_guard(),
  public.current_legal_documents(),
  public.legal_acceptance_status(),
  public.accept_legal_documents(uuid, uuid),
  public.admin_save_legal_draft(uuid, public.legal_document_kind, text, text, text, text, timestamptz),
  public.admin_publish_legal_document(uuid),
  public.admin_delete_legal_draft(uuid),
  public.handle_new_user()
from public, anon, authenticated;

grant execute on function public.current_legal_documents() to anon, authenticated;
grant execute on function
  public.legal_acceptance_status(),
  public.accept_legal_documents(uuid, uuid),
  public.admin_save_legal_draft(uuid, public.legal_document_kind, text, text, text, text, timestamptz),
  public.admin_publish_legal_document(uuid),
  public.admin_delete_legal_draft(uuid)
to authenticated;
