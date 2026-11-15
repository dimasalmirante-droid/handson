-- Handson · Module 2 · Company team access and permissions
--
-- Company Administrators can invite colleagues, assign Company Administrator
-- or Reviewer access, resend/revoke invitations, change roles and remove
-- members. Reviewers can access the employer workspace but cannot manage
-- colleagues or edit company information.
--
-- Existing viewer/editor memberships and pending invitations are normalised
-- to Reviewer. The old enum values remain for compatibility with historical
-- records and older API clients; the new employer-facing invitation flow
-- offers only company_admin and reviewer.
--
-- Reviewer was added in the preceding migration because a new PostgreSQL
-- enum value must be committed before it can be used.

-- Retire the old employer-facing Viewer/Editor distinction. Both become
-- Reviewer: this preserves read access while removing company-profile edit
-- rights from former Editors.
update public.company_members
   set role = 'reviewer'
 where role in ('viewer', 'editor');

update public.company_invitations
   set role = 'reviewer'
 where role in ('viewer', 'editor');

-- Return the active team to a Company Administrator only. Email addresses
-- come from auth.users and are exposed only to an authorised Company Admin.
create or replace function public.company_admin_list_team(p_company uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  job_title text,
  role public.company_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.person_is_active()
     or not public.has_company_role(p_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if not public.company_is_writable(p_company) then
    raise exception 'This company workspace is suspended' using errcode = '42501';
  end if;

  return query
  select m.user_id, u.email::text, m.full_name, m.job_title, m.role, m.created_at
    from public.company_members m
    join auth.users u on u.id = m.user_id
   where m.company_id = p_company
   order by case when m.role = 'company_admin' then 0 else 1 end,
            lower(coalesce(nullif(m.full_name, ''), u.email)),
            m.created_at;
end;
$$;

-- Invite a colleague from the employer workspace. The role is deliberately
-- limited to the two employer-facing roles; a Company Administrator cannot
-- create legacy Viewer/Editor invitations.
create or replace function public.company_invite_member(
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
  mail text := lower(btrim(coalesce(p_email, '')));
  cstatus public.company_status;
  prior public.company_invitations;
  expired_inv record;
  new_id uuid;
begin
  if not public.person_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.has_company_role(p_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 320 then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if p_role not in ('reviewer', 'company_admin') then
    raise exception 'Choose Company Administrator or Reviewer' using errcode = '22023';
  end if;
  if p_full_name is not null and char_length(btrim(p_full_name)) > 200 then
    raise exception 'The name must be 200 characters or fewer' using errcode = '22023';
  end if;
  if p_job_title is not null and char_length(btrim(p_job_title)) > 200 then
    raise exception 'The job title must be 200 characters or fewer' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at < now() + interval '1 hour'
     or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid invitation expiry' using errcode = '22023';
  end if;

  for expired_inv in
    update public.company_invitations i
       set status = 'expired'
     where i.company_id = p_company
       and i.email = mail::extensions.citext
       and i.status = 'pending'
       and i.expires_at <= now()
     returning i.id
  loop
    insert into public.audit_logs (actor_id, action, target_table, target_id, company_id)
    values ((select auth.uid()), 'invitation.expired', 'company_invitations', expired_inv.id::text, p_company);
  end loop;

  select * into prior
    from public.company_invitations i
   where i.company_id = p_company
     and i.email = mail::extensions.citext
     and i.status = 'pending'
   for update;
  if found then
    raise exception 'An invitation is already pending for this email. Resend or revoke it instead.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.company_members m
      join auth.users u on u.id = m.user_id
     where m.company_id = p_company
       and lower(u.email) = mail
  ) then
    raise exception 'This person is already a member of the company' using errcode = '22023';
  end if;

  insert into public.company_invitations (
    company_id, email, role, full_name, job_title, token_hash, expires_at, invited_by
  )
  values (
    p_company,
    mail,
    p_role,
    nullif(left(btrim(coalesce(p_full_name, '')), 200), ''),
    nullif(left(btrim(coalesce(p_job_title, '')), 200), ''),
    p_token_hash,
    p_expires_at,
    (select auth.uid())
  )
  returning id into new_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'invitation.created',
    'company_invitations',
    new_id::text,
    p_company,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at)
  );

  return new_id;
end;
$$;

-- Rotate the token of an invitation owned by the caller's company. The old
-- link becomes invalid immediately; only the hash of the new token is stored.
create or replace function public.company_resend_invitation(
  p_invitation uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  inv public.company_invitations;
  cstatus public.company_status;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at < now() + interval '1 hour'
     or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid invitation expiry' using errcode = '22023';
  end if;

  select i.company_id into v_company
    from public.company_invitations i
   where i.id = p_invitation;
  if not found or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Invitation not found or not authorised' using errcode = '42501';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = v_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.person_is_active() or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  select * into inv
    from public.company_invitations i
   where i.id = p_invitation and i.company_id = v_company
   for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Only a pending invitation can be resent' using errcode = '22023';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invitation has expired. Create a new invitation instead.' using errcode = '22023';
  end if;

  update public.company_invitations
     set token_hash = p_token_hash,
         expires_at = p_expires_at,
         last_sent_at = null
   where id = p_invitation;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'invitation.resent',
    'company_invitations',
    p_invitation::text,
    v_company,
    jsonb_build_object('expires_at', p_expires_at)
  );
end;
$$;

-- Record a successful email-provider submission after the application sends it.
create or replace function public.company_mark_invitation_sent(p_invitation uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  inv public.company_invitations;
  cstatus public.company_status;
  sent_count integer;
begin
  select i.company_id into v_company
    from public.company_invitations i
   where i.id = p_invitation;
  if not found or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Invitation not found or not authorised' using errcode = '42501';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = v_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.person_is_active() or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  select * into inv
    from public.company_invitations i
   where i.id = p_invitation and i.company_id = v_company
   for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;

  update public.company_invitations
     set last_sent_at = now(),
         send_count = send_count + 1
   where id = p_invitation
   returning send_count into sent_count;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'invitation.email_sent',
    'company_invitations',
    p_invitation::text,
    v_company,
    jsonb_build_object('send_count', sent_count)
  );

  return sent_count;
end;
$$;

-- Revoke an unaccepted invitation belonging to the caller's company.
create or replace function public.company_revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  inv public.company_invitations;
  cstatus public.company_status;
begin
  select i.company_id into v_company
    from public.company_invitations i
   where i.id = p_invitation;
  if not found or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Invitation not found or not authorised' using errcode = '42501';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = v_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.person_is_active() or not public.has_company_role(v_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  select * into inv
    from public.company_invitations i
   where i.id = p_invitation and i.company_id = v_company
   for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Only a pending invitation can be revoked' using errcode = '22023';
  end if;

  update public.company_invitations
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = (select auth.uid())
   where id = p_invitation;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'invitation.revoked',
    'company_invitations',
    p_invitation::text,
    v_company,
    jsonb_build_object('role', inv.role)
  );
end;
$$;

-- Change a teammate's role. The final Company Administrator cannot be
-- demoted, ensuring each usable company has someone who can manage access.
create or replace function public.company_change_member_role(
  p_company uuid,
  p_user uuid,
  p_role public.company_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cstatus public.company_status;
  current_role public.company_role;
  admin_count integer;
begin
  if p_role not in ('reviewer', 'company_admin') then
    raise exception 'Choose Company Administrator or Reviewer' using errcode = '22023';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.person_is_active() or not public.has_company_role(p_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  select m.role into current_role
    from public.company_members m
   where m.company_id = p_company and m.user_id = p_user
   for update;
  if not found then
    raise exception 'Team member not found' using errcode = 'P0002';
  end if;
  if current_role = p_role then
    return;
  end if;

  if current_role = 'company_admin' and p_role <> 'company_admin' then
    select count(*)::int into admin_count
      from public.company_members m
     where m.company_id = p_company and m.role = 'company_admin';
    if admin_count <= 1 then
      raise exception 'At least one Company Administrator must remain' using errcode = '22023';
    end if;
  end if;

  update public.company_members
     set role = p_role
   where company_id = p_company and user_id = p_user;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'company.member_role_changed',
    'company_members',
    p_user::text,
    p_company,
    jsonb_build_object('old_role', current_role, 'new_role', p_role)
  );
end;
$$;

-- Remove a teammate. The final Company Administrator cannot be removed.
create or replace function public.company_remove_member(p_company uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cstatus public.company_status;
  current_role public.company_role;
  admin_count integer;
begin
  select c.status into cstatus
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.person_is_active() or not public.has_company_role(p_company, 'company_admin') then
    raise exception 'Not authorised to manage this company team' using errcode = '42501';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company workspace is suspended' using errcode = '22023';
  end if;

  select m.role into current_role
    from public.company_members m
   where m.company_id = p_company and m.user_id = p_user
   for update;
  if not found then
    raise exception 'Team member not found' using errcode = 'P0002';
  end if;

  if current_role = 'company_admin' then
    select count(*)::int into admin_count
      from public.company_members m
     where m.company_id = p_company and m.role = 'company_admin';
    if admin_count <= 1 then
      raise exception 'At least one Company Administrator must remain' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, company_id, metadata)
  values (
    (select auth.uid()),
    'company.member_removed',
    'company_members',
    p_user::text,
    p_company,
    jsonb_build_object('role', current_role)
  );

  delete from public.company_members
   where company_id = p_company and user_id = p_user;
end;
$$;

revoke execute on function
  public.company_admin_list_team(uuid),
  public.company_invite_member(uuid, text, public.company_role, text, text, text, timestamptz),
  public.company_resend_invitation(uuid, text, timestamptz),
  public.company_mark_invitation_sent(uuid),
  public.company_revoke_invitation(uuid),
  public.company_change_member_role(uuid, uuid, public.company_role),
  public.company_remove_member(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.company_admin_list_team(uuid),
  public.company_invite_member(uuid, text, public.company_role, text, text, text, timestamptz),
  public.company_resend_invitation(uuid, text, timestamptz),
  public.company_mark_invitation_sent(uuid),
  public.company_revoke_invitation(uuid),
  public.company_change_member_role(uuid, uuid, public.company_role),
  public.company_remove_member(uuid, uuid)
to authenticated;

comment on function public.company_admin_list_team(uuid)
  is 'Lists company member names, job titles, email addresses and roles for that company''s Company Administrators only.';
comment on function public.company_invite_member(uuid, text, public.company_role, text, text, text, timestamptz)
  is 'Invites a Reviewer or additional Company Administrator from the employer workspace; only the company''s Company Administrators may call it.';
comment on function public.company_change_member_role(uuid, uuid, public.company_role)
  is 'Company Administrators may assign Reviewer or Company Administrator; the final Company Administrator cannot be demoted.';
comment on function public.company_remove_member(uuid, uuid)
  is 'Company Administrators may remove members; the final Company Administrator cannot be removed.';
