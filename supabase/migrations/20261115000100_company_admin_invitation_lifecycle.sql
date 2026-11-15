-- Handson · Module 2 · Company administrator invitation lifecycle
--
-- Adds the protected operations required by the first Company Admin
-- invitation flow. Invitation tokens remain hash-only in the database.
-- All operations are audited and callable only by Handson administrators.
--
-- The email is sent by the application after token creation/rotation. A
-- successful send is recorded separately so failed delivery can be retried
-- with a newly rotated token without weakening invitation acceptance.

-- Create the first Company Admin invitation for a company. Only one pending
-- first-admin invitation or current company_admin membership can exist at a time. An expired pending record is
-- marked expired before a replacement invitation is created.
create or replace function public.admin_invite_first_company_admin(
  p_company uuid,
  p_email text,
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
  cstatus public.company_status;
  expired_inv record;
  new_id uuid;
begin
  perform public.require_admin_role('admin');

  select c.status into cstatus
    from public.companies c
   where c.id = p_company
   for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if cstatus = 'suspended' then
    raise exception 'This company is suspended' using errcode = '22023';
  end if;

  -- Expiry must not permanently block a company from appointing its first admin.
  for expired_inv in
    update public.company_invitations i
       set status = 'expired'
     where i.company_id = p_company
       and i.role = 'company_admin'
       and i.status = 'pending'
       and i.expires_at <= now()
     returning i.id
  loop
    insert into public.audit_logs (actor_id, action, target_table, target_id, company_id)
    values ((select auth.uid()), 'invitation.expired', 'company_invitations', expired_inv.id::text, p_company);
  end loop;

  if exists (
    select 1
      from public.company_members m
     where m.company_id = p_company
       and m.role = 'company_admin'
  ) then
    raise exception 'This company already has a Company Admin' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.company_invitations i
     where i.company_id = p_company
       and i.role = 'company_admin'
       and i.status = 'pending'
       and i.expires_at > now()
  ) then
    raise exception 'A first Company Admin invitation is already pending. Resend or revoke it instead.' using errcode = '22023';
  end if;

  new_id := public.admin_create_invitation(
    p_company,
    p_email,
    'company_admin'::public.company_role,
    p_full_name,
    p_job_title,
    p_token_hash,
    p_expires_at
  );

  return new_id;
end;
$$;

-- Rotate the token for a live invitation before resending it. The previous
-- link becomes invalid immediately; the new raw token is never stored here.
create or replace function public.admin_resend_invitation(
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
  inv public.company_invitations;
  cstatus public.company_status;
begin
  perform public.require_admin_role('admin');

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at < now() + interval '1 hour'
     or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid expiry' using errcode = '22023';
  end if;

  select * into inv
    from public.company_invitations
   where id = p_invitation
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

  select c.status into cstatus
    from public.companies c
   where c.id = inv.company_id
   for share;
  if cstatus = 'suspended' then
    raise exception 'This company is suspended' using errcode = '22023';
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
    inv.company_id,
    jsonb_build_object('expires_at', p_expires_at)
  );
end;
$$;

-- Record successful delivery separately from token creation/rotation. This
-- makes send_count a count of successful sends, not attempted sends.
create or replace function public.admin_mark_invitation_sent(p_invitation uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.company_invitations;
  cstatus public.company_status;
  sent_count integer;
begin
  perform public.require_admin_role('admin');

  select * into inv
    from public.company_invitations
   where id = p_invitation
   for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;

  select c.status into cstatus
    from public.companies c
   where c.id = inv.company_id
   for share;
  if cstatus = 'suspended' then
    raise exception 'This company is suspended' using errcode = '22023';
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
    inv.company_id,
    jsonb_build_object('send_count', sent_count)
  );

  return sent_count;
end;
$$;

-- Revoke an outstanding invitation. The token remains hashed in its audit
-- history, but accept_invitation() will no longer accept it.
create or replace function public.admin_revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.company_invitations;
begin
  perform public.require_admin_role('admin');

  select * into inv
    from public.company_invitations
   where id = p_invitation
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
    inv.company_id,
    jsonb_build_object('role', inv.role)
  );
end;
$$;

revoke execute on function
  public.admin_invite_first_company_admin(uuid, text, text, text, text, timestamptz),
  public.admin_resend_invitation(uuid, text, timestamptz),
  public.admin_mark_invitation_sent(uuid),
  public.admin_revoke_invitation(uuid)
from public, anon, authenticated;

grant execute on function
  public.admin_invite_first_company_admin(uuid, text, text, text, text, timestamptz),
  public.admin_resend_invitation(uuid, text, timestamptz),
  public.admin_mark_invitation_sent(uuid),
  public.admin_revoke_invitation(uuid)
to authenticated;
