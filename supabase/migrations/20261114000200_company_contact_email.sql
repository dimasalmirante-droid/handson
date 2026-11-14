-- Handson · official employer contact email.
--
-- The official company contact (for example a shared HR mailbox) is not an
-- account and cannot sign in. Individual representatives continue to access
-- the workspace through their own Supabase Auth accounts and company roles.
--
-- This migration is additive. Existing company records remain valid with a
-- null contact_email, and admin_create_company() remains unchanged for
-- backwards compatibility.

alter table public.companies
  add column contact_email extensions.citext;

alter table public.companies
  add constraint companies_contact_email_format
  check (
    contact_email is null
    or (
      contact_email::text = lower(btrim(contact_email::text))
      and char_length(contact_email::text) <= 320
      and contact_email::text ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
    )
  );

comment on column public.companies.contact_email is
  'Optional official company contact address. It is not a login or an individual user identity.';

-- New registration entry point that stores the official company contact
-- alongside the company record. The existing three-argument function stays
-- available for existing callers and tests.
create or replace function public.admin_create_company_with_contact(
  p_name text,
  p_slug text,
  p_note text,
  p_contact_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  v_email text := nullif(lower(btrim(p_contact_email)), '');
begin
  perform public.require_admin_role('admin');

  if v_email is not null and (
    char_length(v_email) > 320
    or v_email !~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  ) then
    raise exception 'Enter a valid official company email address' using errcode = '22023';
  end if;

  -- Keep all existing company-name, slug, uniqueness and internal-note
  -- validation and audit behaviour in the established registration function.
  new_id := public.admin_create_company(p_name, p_slug, p_note);

  if v_email is not null then
    update public.companies
       set contact_email = v_email::extensions.citext
     where id = new_id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
    values (
      (select auth.uid()),
      'company.contact_registered',
      'companies',
      new_id::text,
      new_id,
      jsonb_build_object('contact_email', v_email)
    );
  end if;

  return new_id;
end;
$$;

revoke execute on function
  public.admin_create_company_with_contact(text, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.admin_create_company_with_contact(text, text, text, text)
to authenticated;
