# Module 2 · Employer Management

Design record for the employer module. **Step 1 (foundation), Step 2.1 (the admin employer directory and company registration), first Company Admin invitation, and the internal company profile are implemented.** Team management, the public Employer Page, Page Studio and managed talent campaigns are later steps.

## Admin employer directory (Step 2.1)

- `/admin/employers` is available to Handson administrators and super administrators; reviewers do not have access.
- The directory reads company records through the existing administrator Row Level Security policy.
- Registering an employer calls `admin_create_company()`. The database records the company and its audit event; its initial status is `onboarding`.
- The optional setup note is stored in `company_admin_notes`, which remains internal to Handson administrators.
- The slug is reserved for the employer's future permanent public page. Registering a company does not publish a page or activate its workspace.
- The registration form suggests a slug from the company name using lower-case ASCII letters/numbers and hyphens, removing accents and normalising spaces and punctuation. The suggestion updates as the company name changes until the administrator customises the slug; after that, changing the company name leaves the custom slug untouched. The database remains the authority for uniqueness and reports when a slug is already in use.
- The companies table has an optional `contact_email` for the organisation's official correspondence address (for example, a shared HR inbox). It is company data, not a sign-in identity. Individual representatives must use their own Handson accounts and company memberships.
- The database exposes the admin-only `admin_create_company_with_contact()` function for registration with that address. The existing `admin_create_company()` function remains available for compatibility.
- This step does not invite employer contacts or create campaigns. Contract execution remains outside the application for now; a separate contract record and lifecycle will be designed before contract tracking is introduced.

## Company workspace profile

- `/employer/<company-id>/profile` is an internal profile for the employer workspace. It is not the public Employer Page and is not published automatically.
- The profile contains the company name, official contact email, description, website, industry, country, province/region, city and business phone.
- The profile opens in a read-only view that presents the saved details. Company Administrators and Editors can choose **Edit company profile** to enter edit mode; **Save changes** returns them to the read-only view with a confirmation, while **Cancel** discards unsaved edits. Viewers can read the profile but cannot edit it.
- The permanent slug is displayed but cannot be changed from the profile form. Changing a company name does not change its slug.
- Updates use `company_update_profile()`, which checks membership and role again in the database, refuses suspended companies, and records an audit event with the list of changed fields (not field values).
- Profile fields are visible only to members of that company and Handson administrators. The public Employer Page, its approval process and publication history remain a separate future feature.

## Accounts and workspaces

- One sign-in account (Supabase Auth) can hold several roles: a student profile, a Handson administrator role, and membership of one or more companies. There are never duplicate accounts.
- `public.accounts` holds one record per account and is the authority for **account status**. Suspending an account blocks every workspace it has.
- **Company status** (`onboarding`, `active`, `suspended`) affects only that company. Onboarding and active companies are usable; suspension blocks its members' access and changes.
- `my_contexts()` returns the caller's workspaces. After sign-in, `/start` sends people to the correct workspace or chooser.
- `/workspaces` lists workspaces and pending invitations. A Company Administrator is not prompted to create a student profile during employer onboarding.
- The workspace switcher appears only for people with more than one workspace. The remembered choice is re-checked against the database on every use.
- Guards: `requireUser()`, `requireStudent()`, `requireAdmin()`, and `requireCompanyRole()`.

## Sign-up and student profiles

`handle_new_user()` does not create a student profile automatically when a new account is registering for a pending company invitation, unless the sign-up was explicitly marked as a student registration. Employer membership is granted only by `accept_invitation()`.

## Invitations

- Invitation tokens are random, short-lived and stored only as SHA-256 hashes.
- The first Company Admin is invited by a Handson administrator. The app does not create an Auth user or grant membership before acceptance.
- After acceptance, the invited person uses their existing Handson account and the company remains in its current status.
- The generic acceptance flow supports the existing company roles: `viewer`, `editor` and `company_admin`. Team management will introduce company-admin-scoped invite, resend and revoke operations in a later step.
- Email is sent by the server through Resend using `Handson <hello@handson.cloud>`. The secret `RESEND_API_KEY` is configured separately for Preview and Production.

## Database security rules

Every privileged function has a fixed empty `search_path`, fully qualified names, role and account checks, and explicit execute grants. New tables (when introduced) must have RLS enabled and matching grants. Company writes remain unavailable directly to authenticated users; they happen only through role-checked functions.

## Environments

Staging and Production are separate Supabase projects; previews and CI use Staging. Migrations reach Production only through the protected **Database migrations** workflow ([database-migrations.md](database-migrations.md)).
