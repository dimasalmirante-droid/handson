-- Handson · Module 2 · Company workspace profile
--
-- Adds the private company details that the Company Administrator and
-- Editors maintain inside their workspace. These fields are NOT published
-- automatically and do not change the permanent public slug.
--
-- Direct table writes remain disabled. Updates go through a role-checked,
-- audited function so tenant boundaries are enforced in one place.

alter table public.companies
  add column description text,
  add column website text,
  add column industry_id smallint references public.industries (id) on delete set null,
  add column country_code text,
  add column province text,
  add column city text,
  add column business_phone text;

alter table public.companies
  add constraint companies_description_length
    check (description is null or char_length(description) <= 2000),
  add constraint companies_website_https
    check (website is null or (website ~ '^https://[^[:space:]]+$' and char_length(website) <= 300)),
  add constraint companies_country_code_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint companies_province_length
    check (province is null or char_length(province) <= 100),
  add constraint companies_city_length
    check (city is null or char_length(city) <= 100),
  add constraint companies_business_phone_format
    check (business_phone is null or business_phone ~ '^\+[1-9][0-9]{7,14}$');

comment on column public.companies.description is
  'Internal employer workspace description. It is not public until a separate Employer Page publication flow is completed.';
comment on column public.companies.website is
  'Official company website URL, HTTPS only. Internal company profile data.';
comment on column public.companies.industry_id is
  'Primary company industry, selected from the Handson industry catalogue.';
comment on column public.companies.country_code is
  'ISO 3166-1 alpha-2 country code for the company location.';
comment on column public.companies.business_phone is
  'Optional official company phone number in E.164 format.';

create index companies_industry_idx on public.companies (industry_id) where industry_id is not null;

create or replace function public.company_update_profile(
  p_company uuid,
  p_name text,
  p_contact_email text,
  p_description text,
  p_website text,
  p_industry_id smallint,
  p_country_code text,
  p_province text,
  p_city text,
  p_business_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
  v_country_code text := nullif(upper(btrim(coalesce(p_country_code, ''))), '');
  v_province text := nullif(btrim(coalesce(p_province, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_phone text := nullif(btrim(coalesce(p_business_phone, '')), '');
  v_changed text[];
begin
  if p_company is null then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;

  -- Reject non-members before attempting to lock a tenant's company row.
  if not public.has_company_role(p_company, 'editor'::public.company_role) then
    raise exception 'You do not have permission to edit this company profile' using errcode = '42501';
  end if;

  -- Serialise company-level changes; check role again after acquiring the lock.
  select c.* into v_company
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.has_company_role(p_company, 'editor'::public.company_role) then
    raise exception 'You do not have permission to edit this company profile' using errcode = '42501';
  end if;
  if v_company.status = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '42501';
  end if;

  if char_length(v_name) not between 2 and 200 then
    raise exception 'Enter a company name between 2 and 200 characters' using errcode = '22023';
  end if;
  if v_email is not null and (
    char_length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  ) then
    raise exception 'Enter a valid official company email address' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'The company description must be 2,000 characters or fewer' using errcode = '22023';
  end if;
  if v_website is not null and (
    char_length(v_website) > 300 or v_website !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'Enter a valid HTTPS website address' using errcode = '22023';
  end if;
  if p_industry_id is not null and not exists (
    select 1 from public.industries i where i.id = p_industry_id
  ) then
    raise exception 'Choose an industry from the list' using errcode = '22023';
  end if;
  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Choose a valid two-letter country code' using errcode = '22023';
  end if;
  if v_province is not null and char_length(v_province) > 100 then
    raise exception 'Province or region must be 100 characters or fewer' using errcode = '22023';
  end if;
  if v_city is not null and char_length(v_city) > 100 then
    raise exception 'City must be 100 characters or fewer' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Enter a valid international phone number, including country code' using errcode = '22023';
  end if;

  v_changed := array_remove(array[
    case when v_company.name is distinct from v_name then 'name' end,
    case when v_company.contact_email::text is distinct from v_email then 'contact_email' end,
    case when v_company.description is distinct from v_description then 'description' end,
    case when v_company.website is distinct from v_website then 'website' end,
    case when v_company.industry_id is distinct from p_industry_id then 'industry_id' end,
    case when v_company.country_code is distinct from v_country_code then 'country_code' end,
    case when v_company.province is distinct from v_province then 'province' end,
    case when v_company.city is distinct from v_city then 'city' end,
    case when v_company.business_phone is distinct from v_phone then 'business_phone' end
  ], null);

  if cardinality(v_changed) = 0 then
    return;
  end if;

  update public.companies
     set name = v_name,
         contact_email = v_email::extensions.citext,
         description = v_description,
         website = v_website,
         industry_id = p_industry_id,
         country_code = v_country_code,
         province = v_province,
         city = v_city,
         business_phone = v_phone
   where id = p_company;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'company.profile_updated',
    'companies',
    p_company::text,
    p_company,
    jsonb_build_object('fields', to_jsonb(v_changed))
  );
end;
$$;

revoke execute on function public.company_update_profile(
  uuid, text, text, text, text, smallint, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.company_update_profile(
  uuid, text, text, text, text, smallint, text, text, text, text
) to authenticated;
