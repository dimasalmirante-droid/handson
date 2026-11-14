-- Handson · internal register for signed physical employer contracts.
-- The paper agreement remains the legal source document. This table stores
-- metadata needed by Handson to verify commercial eligibility and history.

create table public.company_contracts (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete restrict,
  reference          text check (reference is null or char_length(btrim(reference)) between 1 and 120),
  signed_on          date not null,
  starts_on          date not null,
  ends_on            date,
  service_scope      text not null check (char_length(btrim(service_scope)) between 1 and 5000),
  internal_note      text check (internal_note is null or char_length(internal_note) <= 2000),
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  terminated_at      timestamptz,
  termination_reason text,
  constraint company_contracts_date_range
    check (ends_on is null or ends_on >= starts_on),
  constraint company_contracts_termination
    check (
      (terminated_at is null and termination_reason is null)
      or
      (terminated_at is not null and char_length(btrim(coalesce(termination_reason, ''))) between 3 and 500)
    )
);

comment on table public.company_contracts is
  'Internal Handson register of signed physical employer contracts. The signed source document is held outside the application.';
comment on column public.company_contracts.service_scope is
  'Plain-language summary of services covered by the signed agreement.';
comment on column public.company_contracts.termination_reason is
  'Required reason recorded by a Handson administrator when a signed contract is terminated early.';

create index company_contracts_company_recent_idx
  on public.company_contracts (company_id, created_at desc);
create unique index company_contracts_reference_unique
  on public.company_contracts (company_id, lower(reference))
  where reference is not null;

-- Contract data is confidential commercial information: only Handson admins
-- (admin and super_admin) may read it. Company members and reviewers cannot.
alter table public.company_contracts enable row level security;
create policy "Handson admins read company contracts"
  on public.company_contracts
  for select to authenticated
  using (public.has_admin_role('admin'));

revoke all on public.company_contracts from anon, authenticated;
grant select on public.company_contracts to authenticated;

-- Create a register entry for an already-signed physical contract. The
-- company row is locked so simultaneous registrations are consistent.
create or replace function public.admin_create_company_contract(
  p_company uuid,
  p_reference text,
  p_signed_on date,
  p_starts_on date,
  p_ends_on date,
  p_service_scope text,
  p_internal_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_id uuid;
  v_reference text := nullif(btrim(p_reference), '');
  v_scope text := btrim(p_service_scope);
  v_note text := nullif(btrim(p_internal_note), '');
begin
  perform public.require_admin_role('admin');

  if p_signed_on is null or p_starts_on is null then
    raise exception 'Enter the signing date and contract start date' using errcode = '22023';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'The contract end date cannot be before its start date' using errcode = '22023';
  end if;
  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'The contract reference must be 120 characters or fewer' using errcode = '22023';
  end if;
  if v_scope is null or char_length(v_scope) not between 1 and 5000 then
    raise exception 'Enter the services covered by this contract (up to 5,000 characters)' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The internal note must be 2,000 characters or fewer' using errcode = '22023';
  end if;

  select c.id into v_company
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;

  insert into public.company_contracts (
    company_id, reference, signed_on, starts_on, ends_on,
    service_scope, internal_note, created_by
  )
  values (
    v_company, v_reference, p_signed_on, p_starts_on, p_ends_on,
    v_scope, v_note, (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()), 'company_contract.created', 'company_contracts', v_id::text, v_company,
    jsonb_build_object(
      'reference', v_reference,
      'signed_on', p_signed_on,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on
    )
  );

  return v_id;
end;
$$;

-- Preserve the signed terms as recorded; only early termination is mutable.
create or replace function public.admin_terminate_company_contract(
  p_contract uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_terminated_at timestamptz;
  v_reason text := btrim(p_reason);
begin
  perform public.require_admin_role('admin');

  if v_reason is null or char_length(v_reason) not between 3 and 500 then
    raise exception 'Enter a termination reason of 3 to 500 characters' using errcode = '22023';
  end if;

  select c.company_id, c.terminated_at
    into v_company, v_terminated_at
    from public.company_contracts c
   where c.id = p_contract
   for update;
  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;
  if v_terminated_at is not null then
    raise exception 'This contract has already been terminated' using errcode = '22023';
  end if;

  update public.company_contracts
     set terminated_at = now(), termination_reason = v_reason
   where id = p_contract;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()), 'company_contract.terminated', 'company_contracts', p_contract::text, v_company,
    jsonb_build_object('reason', v_reason)
  );
end;
$$;

revoke execute on function
  public.admin_create_company_contract(uuid, text, date, date, date, text, text),
  public.admin_terminate_company_contract(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.admin_create_company_contract(uuid, text, date, date, date, text, text),
  public.admin_terminate_company_contract(uuid, text)
to authenticated;
