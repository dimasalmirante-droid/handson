# Module 2 · Employer Management

Design record for the employer module. **Step 1 (foundation) is implemented.** Later steps (admin employer screens, invitations by email, the invitation page, the employer profile editor, media, review and publication) are described here only where Step 1 prepares for them.

## Accounts and workspaces

- One sign-in account (Supabase Auth) can hold several roles: a student profile, a Handson administrator role, and membership of one or more companies. There are never duplicate accounts.
- `public.accounts` holds one record per account and is the authority for **account status**. Suspending an account blocks every workspace it has, whether or not it has a student profile. `profiles.account_status` mirrors it so existing student behaviour is unchanged.
- **Company status** (`onboarding`, `active`, `suspended`) affects only that company. Onboarding and active companies are fully usable; suspension blocks its members' access and changes.
- `my_contexts()` returns the caller's workspaces. After sign-in, `/start` sends people to:
  1. sign-out, if the account is suspended;
  2. the legal acceptance screen, if required;
  3. a safe `next` path;
  4. their remembered workspace, if it is still theirs;
  5. `/admin`, for Handson administrators (unchanged);
  6. their only workspace;
  7. otherwise `/workspaces`, the chooser.
- `/workspaces` lists workspaces and pending invitations, and offers **Create my student profile** to anyone without one, independently of any invitation.
- The workspace switcher appears only for people with more than one workspace. The remembered choice is a cookie that is re-checked against the database on every use.
- Guards: `requireUser()` (signed in, not suspended, legal acceptance done), `requireStudent()` (student areas), `requireAdmin()` (unchanged), `requireCompanyRole()` (employer areas; others get a 404).

## Sign-up and student profiles

`handle_new_user()` creates a student profile for every new account, exactly as before, **except** when a valid pending invitation exists for the email (in a company that is not suspended) and the sign-up was not marked as a student registration. The decision uses only database data, never a browser cookie.

| Situation | Student profile at sign-up |
|---|---|
| No valid invitation (email or Google) | Yes |
| Invitation pending, registered on the student form (`signup_intent = student`) | Yes |
| Invitation pending, Google from the student registration page | Created by `/auth/callback` (`intent=student`) when the account has no workspace yet |
| Invitation pending, registered from the invitation page (Step 3) | No; can be created later on `/workspaces` |

The student marker can only add a student profile for the person themselves; it never grants anything. Employer access is granted only by `accept_invitation()`.

## Invitations

- **Token:** 32 random bytes (base64url). Only its SHA-256 hash is stored. It is valid for 7 days, and resending replaces it (Step 3).
- **Uniqueness:** at most one pending invitation per company and email (case-insensitive; stored lower-case). Creating an invitation marks an expired pending one `expired` first, so expiry never blocks re-invitation. Inviting a current member is refused.
- **`accept_invitation(token_hash)`:** in one transaction, with the invitation row locked:
  - the invitation must be pending and not expired;
  - the account must be active, with a verified email equal to the invited email (ignoring case);
  - the company must not be suspended, and the person must not already be a member.

  It then adds the membership, marks the invitation accepted and audits the acceptance.
- **Carrying the token through sign-up (Step 3):**
  - `/invite/<token>` stores the token in an httpOnly, Secure, SameSite=Lax cookie with `Path=/invite`, then redirects to `/invite`.
  - Google returns to `/auth/callback?next=/invite`; the callback does not read the cookie and simply redirects to `/invite`, where the cookie is available.
  - Email verification links return to `/auth/confirm?next=/invite`.
  - Acceptance happens only through a POST on `/invite`.

## Legal documents

- Super admins create and publish versions in **Admin → Legal documents**. Published versions are immutable.
- The current version of each document is the latest published version whose effective date has passed.
- The acceptance screen (`/legal/accept`) is off until **both** a current Terms version and a current Privacy Notice version exist. It then asks each account once per document version: Terms are *accepted*, the Privacy Notice is *acknowledged*, each with its own checkbox and record. When only one document changes, only that one is asked.
- `accept_legal_documents()` accepts only the exact current versions; repeating it has no effect.
- `draft-2026-11` acceptances recorded before this module remain in the history but do not count as acceptance of a final version.
- Optional consents (employer visibility, marketing) are separate and never part of this screen.
- The documents are readable without signing in at `/legal/terms` and `/legal/privacy` (with version and effective date) and earlier versions at `/legal/<kind>/<version>`.

## Consent records: account instead of profile (expand and contract)

1. **Step 1 (expand):** `user_id` added, filled from `profile_id`, made required and indexed. `profile_id` is kept, optional, synchronised by trigger, and must equal `user_id` when present. Deleting a profile now clears `profile_id` instead of deleting consent history; deleting the account still removes it. Both read policies exist. The application reads by `user_id`.
2. **Later (contract), only after approval:**
   - Precondition: the code no longer uses `consent_records.profile_id`, a dependency query finds nothing that references it, and a release has run on `user_id` without errors.
   - Then: drop the sync trigger, the old policy, the old index and the column.

## Publication (later step; not in Step 1)

- **Version statuses:** `submitted` (locked), `withdrawn`, `changes_requested`, `approved`, `superseded`.
- **Live profile:** a publication history table (`employer_profile_publications`) records publications. The live profile is the row without an end date; at most one per company.
- **Publishing a newer version:** ends the live row with reason `replaced` and marks its version `superseded`.
- **Unpublishing:** ends it with reason `unpublished` and a required note.
- **Images after unpublishing:** public images are deleted from Handson, but copies already downloaded or cached elsewhere may remain for some time; the interface says so and promises nothing more.

## Database security rules

Every function:
- has `SET search_path = ''` and fully qualified names;
- uses `SECURITY DEFINER` only where needed;
- checks the caller, role and account status first;
- locks rows before status changes;
- has execute revoked from `public`, `anon` and `authenticated`, then granted explicitly. Only `invitation_preview` and `current_legal_documents` are available to signed-out visitors. Trigger functions are callable by nobody.

New tables have Row Level Security, no client write grants, and read access only through policies. Internal company notes are readable by Handson administrators only. Tests in `supabase/tests/employer.test.ts` check all of this.

## Environments

Staging and production are separate Supabase projects; previews and CI use staging. Migrations reach production only through the **Database migrations** workflow ([database-migrations.md](database-migrations.md)).
