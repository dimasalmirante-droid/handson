# Handson go-live checklist

Status as of 9 November 2026. Work through the sections in order; each item says where it is done and who does it.

## 1. Database

- [ ] Set up the staging project, the GitHub `staging` and `production` environments and the Vercel Preview variables as described in [database-migrations.md](database-migrations.md). Preview deployments must point to staging.
- [ ] Production history: run **Database migrations → verify** on production with baseline `20261109000600`; when it is clean and approved, run **repair-history**. From then on, migrations reach production only through **apply** in that workflow (never the SQL Editor).
- [ ] Run **Advisors → Security Advisor** and **Performance Advisor**. Resolve anything marked *Error*; review *Warning* items.
- [ ] Confirm **Table Editor** shows RLS enabled on every table in `public`.
- [ ] Confirm **Storage** shows `documents` and `avatars` as **private** buckets.

## 2. Supabase plan and settings

- [ ] Upgrade the project to **Pro** (≈ US$25/month). Free projects pause after a week of inactivity and have no backups.
- [ ] **Database → Backups**: confirm daily backups are listed. Consider Point-in-Time Recovery once there is real student data.
- [ ] **Authentication → Sign In / Providers → Email**: *Confirm email* on, minimum password length 8. After upgrading, enable **Leaked password protection**.
- [ ] **Authentication → URL Configuration**: Site URL `https://app.handson.cloud`; Redirect URLs include `https://app.handson.cloud/**`. Remove `http://localhost:3000/**` and the `*.vercel.app` entry if no longer needed.
- [ ] **Authentication → Emails → Templates**: *Confirm signup*, *Reset password* and *Change email address* use the `/auth/confirm?token_hash=…` links listed in the README.
- [ ] **Authentication → Rate Limits**: email sending limit set (100/hour); review sign-in and sign-up limits.
- [ ] **Authentication → Multi-Factor**: enable TOTP and turn it on for every administrator account.
- [ ] Note the project **region** for the Privacy Policy (where student data is stored).

## 3. Email (Resend)

- [ ] Domain `handson.cloud` shows **Verified**.
- [ ] Optional: add a DMARC record (`_dmarc` TXT, starting with `p=none`) to improve deliverability.
- [ ] Watch daily volume against the free plan (100/day). Upgrade before a launch campaign.

## 4. Google sign-in (Google Cloud → Google Auth Platform)

- [ ] **Audience**: app is **In production** (not *Testing*).
- [ ] **Branding**: home page, privacy policy and terms links open; authorised domains `handson.cloud` and `supabase.co`.
- [ ] Optional, paid: Supabase custom domain so Google shows *handson.cloud* instead of the Supabase address.

## 5. Hosting (Vercel)

- [ ] Upgrade to **Pro** (≈ US$20/month); the Hobby plan does not allow commercial use.
- [ ] **Environment variables** (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL=https://app.handson.cloud`.
- [ ] **Domains**: `app.handson.cloud` shows *Valid Configuration*.
- [ ] Optional: enable **Deployment Protection** for Preview deployments, and the Vercel Firewall rate-limit rules on `/login`, `/register` and `/forgot-password`.

## 6. Legal and content

- [ ] Legal review of the **Privacy Policy** and **Terms and Conditions** against Mozambican law. Fill in the placeholders (date, minimum age, liability, jurisdiction), name the data processors (Supabase and its region, Vercel, Resend, Google) and remove the *Draft for review* notes.
- [ ] If the terms change materially, update `TERMS_VERSION` in `src/app/(auth)/actions.ts` so new acceptances are recorded against the new version.
- [ ] Confirm the employer-visibility wording in **Settings** matches what the future employer portal will show.
- [ ] Review the 25 starter institutions and the skills catalogue; add missing entries.
- [ ] Send a test message through the website **Contact** form and confirm it reaches hello@handson.cloud.

## 7. Acceptance testing

Create two dedicated test accounts (not personal ones): one student (email and password, verified) and one administrator.

- [ ] Add them as GitHub repository **secrets** `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and the variable `E2E_BASE_URL=https://app.handson.cloud`. The **CI** workflow then runs the full end-to-end suite on every change.
- [ ] Manually confirm, on a phone and on a computer:
  - [ ] Register with Google, and with email (verification email arrives from hello@handson.cloud).
  - [ ] Onboarding: leave mid-way, sign out, sign back in, resume at the same step with data intact.
  - [ ] Upload CV and transcript; open them; completion reaches 100%.
  - [ ] Turn employer visibility on and off; consent history shows both.
  - [ ] Password reset and change email both work end to end.
  - [ ] Admin: search and filter, open a profile, verify and reject (student sees the notification), export CSV, suspend and reactivate, audit log shows each action.

## 8. Operations after launch

- [ ] Monthly: **Admin → Maintenance → Remove orphaned files**.
- [ ] Monthly: review **Admin → Audit log** and the team list; remove access that is no longer needed.
- [ ] Account deletion requests (from hello@handson.cloud): delete the user in **Supabase → Authentication → Users**. Their profile, records and consent history are removed with them; then remove their files from Storage (`documents/<user id>/` and `avatars/<user id>/`).
- [ ] Before adding the Portuguese interface or the employer portal, run the full test suite (`npm test`, `npm run test:e2e`).

## Known limitations of the MVP

- Admin student search calculates completion for every student on each search. Fine for a few thousand students; above that, store the score in a column and refresh it on change.
- Content Security Policy allows inline scripts (required by Next.js without nonces). A nonce-based policy is a later hardening step.
- Account deletion is a manual, admin-performed process (it needs the Supabase secret key, which the app deliberately does not hold).
- Interface is English only; the structure for Portuguese is in place.
- CV-based profile prefill is designed but not built (parked).
