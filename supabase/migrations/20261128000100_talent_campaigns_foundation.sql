-- HandsOn · Talent campaigns foundation
-- Additive schema for managed recruitment/programme campaigns and applications.
-- All writes are performed through guarded SECURITY DEFINER functions.

create type public.campaign_type as enum ('internship','graduate_programme','apprenticeship','job','training_programme','other');
create type public.campaign_status as enum ('draft','pending','published','closed','cancelled');
create type public.application_status as enum ('submitted','under_review','shortlisted','assessment','interview','selected','rejected','withdrawn');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  slug text not null check (char_length(slug) between 3 and 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 10000),
  campaign_type public.campaign_type not null default 'other',
  location text check (location is null or char_length(location) <= 200),
  work_arrangement public.work_arrangement,
  eligibility text check (eligibility is null or char_length(eligibility) <= 5000),
  requirements text check (requirements is null or char_length(requirements) <= 5000),
  positions_available integer check (positions_available is null or positions_available between 1 and 10000),
  application_open_at timestamptz,
  application_close_at timestamptz,
  status public.campaign_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dates_order check (application_close_at is null or application_open_at is null or application_close_at > application_open_at),
  unique (company_id, slug)
);
create index campaigns_company_idx on public.campaigns(company_id, created_at desc);
create index campaigns_public_idx on public.campaigns(status, application_close_at) where status = 'published';

create table public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.application_status not null default 'submitted',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (campaign_id, profile_id),
  constraint application_withdrawn_status check ((status = 'withdrawn') = (withdrawn_at is not null))
);
create index campaign_applications_campaign_idx on public.campaign_applications(campaign_id,status,applied_at);
create index campaign_applications_profile_idx on public.campaign_applications(profile_id,applied_at desc);

create table public.campaign_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.campaign_applications(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  previous_status public.application_status,
  new_status public.application_status not null,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index campaign_events_application_idx on public.campaign_application_events(application_id,created_at);

-- RLS: published campaigns are visible; company/admin access is scoped.
alter table public.campaigns enable row level security;
alter table public.campaign_applications enable row level security;
alter table public.campaign_application_events enable row level security;

create policy "Public read published campaigns" on public.campaigns
  for select to anon, authenticated using (status = 'published');
create policy "Company members read campaigns" on public.campaigns
  for select to authenticated using (public.is_company_member(company_id));
create policy "Handson admins read campaigns" on public.campaigns
  for select to authenticated using (public.is_admin());

create policy "Candidates read own applications" on public.campaign_applications
  for select to authenticated using (profile_id = (select auth.uid()) and public.person_is_active());
create policy "Company members read campaign applications" on public.campaign_applications
  for select to authenticated using (
    public.person_is_active() and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and public.has_company_role(c.company_id,'reviewer')
    )
  );
create policy "Handson admins read applications" on public.campaign_applications
  for select to authenticated using (public.is_admin());

create policy "Candidates read own application events" on public.campaign_application_events
  for select to authenticated using (
    public.person_is_active() and exists (
      select 1 from public.campaign_applications a
      where a.id = application_id and a.profile_id = (select auth.uid())
    )
  );
create policy "Company members read campaign application events" on public.campaign_application_events
  for select to authenticated using (
    public.person_is_active() and exists (
      select 1 from public.campaign_applications a join public.campaigns c on c.id=a.campaign_id
      where a.id=application_id and public.has_company_role(c.company_id,'reviewer')
    )
  );
create policy "Handson admins read application events" on public.campaign_application_events
  for select to authenticated using (public.is_admin());

revoke all on public.campaigns, public.campaign_applications, public.campaign_application_events from anon, authenticated;
grant select on public.campaigns to anon, authenticated;
grant select on public.campaign_applications, public.campaign_application_events to authenticated;

-- Company Admin-only creation/editing. Reviewer access is read-only.
create or replace function public.company_create_campaign(
  p_company uuid, p_title text, p_slug text, p_description text,
  p_type public.campaign_type, p_location text, p_work_arrangement public.work_arrangement,
  p_eligibility text, p_requirements text, p_positions integer,
  p_open_at timestamptz, p_close_at timestamptz
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not public.person_is_active() or not public.has_company_role(p_company,'company_admin') then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  if not public.company_is_writable(p_company) then
    raise exception 'Company workspace is suspended' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_title,''))) not between 3 and 200
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid title or slug' using errcode='22023';
  end if;
  if p_close_at is not null and p_open_at is not null and p_close_at <= p_open_at then
    raise exception 'Closing date must follow opening date' using errcode='22023';
  end if;
  insert into public.campaigns(company_id,created_by,title,slug,description,campaign_type,location,work_arrangement,eligibility,requirements,positions_available,application_open_at,application_close_at)
  values(p_company,(select auth.uid()),btrim(p_title),p_slug,coalesce(p_description,''),p_type,p_location,p_work_arrangement,p_eligibility,p_requirements,p_positions,p_open_at,p_close_at)
  returning id into v_id;
  insert into public.audit_logs(actor_id,action,target_table,target_id,company_id,metadata)
  values((select auth.uid()),'campaign.created','campaigns',v_id::text,p_company,jsonb_build_object('title',p_title));
  return v_id;
end;
$$;

create or replace function public.company_update_campaign(
  p_campaign uuid, p_title text, p_slug text, p_description text,
  p_type public.campaign_type, p_location text, p_work_arrangement public.work_arrangement,
  p_eligibility text, p_requirements text, p_positions integer,
  p_open_at timestamptz, p_close_at timestamptz
) returns void
language plpgsql security definer set search_path=''
as $$
declare v_company uuid; v_status public.campaign_status;
begin
  select company_id,status into v_company,v_status from public.campaigns where id=p_campaign for update;
  if not found or not public.person_is_active() or not public.has_company_role(v_company,'company_admin') then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  if not public.company_is_writable(v_company) then raise exception 'Company workspace is suspended' using errcode='42501'; end if;
  if v_status in ('closed','cancelled') then raise exception 'Closed campaigns cannot be edited' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 3 and 200 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid title or slug' using errcode='22023';
  end if;
  if p_close_at is not null and p_open_at is not null and p_close_at <= p_open_at then raise exception 'Closing date must follow opening date' using errcode='22023'; end if;
  update public.campaigns set title=btrim(p_title),slug=p_slug,description=coalesce(p_description,''),campaign_type=p_type,
    location=p_location,work_arrangement=p_work_arrangement,eligibility=p_eligibility,requirements=p_requirements,
    positions_available=p_positions,application_open_at=p_open_at,application_close_at=p_close_at,updated_at=now()
    where id=p_campaign;
end;
$$;

create or replace function public.company_publish_campaign(p_campaign uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid; v_status public.campaign_status; v_open timestamptz; v_close timestamptz;
begin
  select company_id,status,application_open_at,application_close_at into v_company,v_status,v_open,v_close
  from public.campaigns where id=p_campaign for update;
  if not found or not public.person_is_active() or not public.has_company_role(v_company,'company_admin') then raise exception 'Not authorised' using errcode='42501'; end if;
  if not public.company_is_writable(v_company) then raise exception 'Company workspace is suspended' using errcode='42501'; end if;
  if v_status not in ('draft','pending') then raise exception 'Campaign cannot be published from its current state' using errcode='22023'; end if;
  update public.campaigns set status='published',published_at=now(),updated_at=now() where id=p_campaign;
end;
$$;

create or replace function public.company_close_campaign(p_campaign uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid;
begin
  select company_id into v_company from public.campaigns where id=p_campaign for update;
  if not found or not public.person_is_active() or not public.has_company_role(v_company,'company_admin') then raise exception 'Not authorised' using errcode='42501'; end if;
  if not public.company_is_writable(v_company) then raise exception 'Company workspace is suspended' using errcode='42501'; end if;
  update public.campaigns set status='closed',updated_at=now() where id=p_campaign and status='published';
  if not found then raise exception 'Only published campaigns can be closed' using errcode='22023'; end if;
end;
$$;

create or replace function public.apply_to_campaign(p_campaign uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_status public.campaign_status; v_open timestamptz; v_close timestamptz; v_company uuid; v_id uuid; v_profile public.profiles;
begin
  if not public.person_is_active() then raise exception 'Account is inactive' using errcode='42501'; end if;
  select * into v_profile from public.profiles where id=(select auth.uid()) for share;
  if not found or v_profile.employer_visibility is false then raise exception 'Complete your profile and enable employer visibility before applying' using errcode='42501'; end if;
  select status,application_open_at,application_close_at,company_id into v_status,v_open,v_close,v_company from public.campaigns where id=p_campaign for share;
  if not found or v_status <> 'published' or (v_open is not null and v_open>now()) or (v_close is not null and v_close<=now()) then
    raise exception 'Campaign is not accepting applications' using errcode='22023';
  end if;
  if not public.company_is_writable(v_company) then raise exception 'Company is unavailable' using errcode='22023'; end if;
  insert into public.campaign_applications(campaign_id,profile_id) values(p_campaign,(select auth.uid())) returning id into v_id;
  insert into public.campaign_application_events(application_id,actor_id,new_status,note) values(v_id,(select auth.uid()),'submitted','Application submitted');
  return v_id;
end;
$$;

create or replace function public.withdraw_campaign_application(p_application uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_status public.application_status;
begin
  if not public.person_is_active() then raise exception 'Account is inactive' using errcode='42501'; end if;
  select status into v_status from public.campaign_applications where id=p_application and profile_id=(select auth.uid()) for update;
  if not found then raise exception 'Application not found' using errcode='P0002'; end if;
  if v_status in ('selected','rejected','withdrawn') then raise exception 'Application cannot be withdrawn' using errcode='22023'; end if;
  update public.campaign_applications set status='withdrawn',withdrawn_at=now(),updated_at=now() where id=p_application;
  insert into public.campaign_application_events(application_id,actor_id,previous_status,new_status,note)
  values(p_application,(select auth.uid()),v_status,'withdrawn','Candidate withdrew application');
end;
$$;

create or replace function public.company_update_application_status(p_application uuid,p_status public.application_status,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid; v_previous public.application_status; v_profile uuid;
begin
  select c.company_id,a.status,a.profile_id into v_company,v_previous,v_profile
  from public.campaign_applications a join public.campaigns c on c.id=a.campaign_id where a.id=p_application for update;
  if not found or not public.person_is_active() or not public.has_company_role(v_company,'reviewer') then raise exception 'Not authorised' using errcode='42501'; end if;
  if not public.company_is_writable(v_company) then raise exception 'Company workspace is suspended' using errcode='42501'; end if;
  if p_status not in ('under_review','shortlisted','assessment','interview','selected','rejected') then raise exception 'Invalid transition' using errcode='22023'; end if;
  if v_previous in ('withdrawn','selected','rejected') then raise exception 'Application is final' using errcode='22023'; end if;
  update public.campaign_applications set status=p_status,updated_at=now() where id=p_application;
  insert into public.campaign_application_events(application_id,actor_id,previous_status,new_status,note)
  values(p_application,(select auth.uid()),v_previous,p_status,nullif(btrim(p_note),''));
end;
$$;

revoke execute on function public.company_create_campaign(uuid,text,text,text,public.campaign_type,text,public.work_arrangement,text,text,integer,timestamptz,timestamptz) from public,anon,authenticated;
revoke execute on function public.company_update_campaign(uuid,text,text,text,public.campaign_type,text,public.work_arrangement,text,text,integer,timestamptz,timestamptz) from public,anon,authenticated;
revoke execute on function public.company_publish_campaign(uuid),public.company_close_campaign(uuid),public.apply_to_campaign(uuid),public.withdraw_campaign_application(uuid),public.company_update_application_status(uuid,public.application_status,text) from public,anon,authenticated;
grant execute on function public.company_create_campaign(uuid,text,text,text,public.campaign_type,text,public.work_arrangement,text,text,integer,timestamptz,timestamptz),public.company_update_campaign(uuid,text,text,text,public.campaign_type,text,public.work_arrangement,text,text,integer,timestamptz,timestamptz),public.company_publish_campaign(uuid),public.company_close_campaign(uuid),public.apply_to_campaign(uuid),public.withdraw_campaign_application(uuid),public.company_update_application_status(uuid,public.application_status,text) to authenticated;
