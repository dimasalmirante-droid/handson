# Handson

Student-first early-career talent platform for Mozambique. This repository contains the student and administrator web application served at **app.handson.cloud**. The public marketing site (landing page, About, Contact, Privacy Policy, Terms) runs on WordPress at **handson.cloud**.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation and design system | Done |
| 2 | Authentication (Google, email/password) | Built; awaiting Supabase, Google and SMTP configuration |
| 3 | Database, Row Level Security | Not started |
| 4 | Six-step student onboarding | Not started |
| 5 | Student dashboard | Not started |
| 6 | Document management | Not started |
| 7 | Admin portal | Not started |
| 8 | Testing and deployment | Not started |


## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- Tailwind CSS 4, design tokens in `src/app/globals.css`
- Self-hosted fonts: Bricolage Grotesque (headings), Inter (text)
- Supabase (Postgres, Auth; Storage from Phase 6) via `@supabase/ssr`, Google OAuth, Zod
- Hosted on Vercel

## Getting started

Requirements: Node.js 20.9 or later, npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint |
| `npm test` | Unit tests (Vitest) |

## Project structure

```
src/
  app/
    (auth)/login, (auth)/register   Sign-in and sign-up (UI only in Phase 1)
    design-system/                   Internal component reference
    globals.css                      Design tokens
  components/
    ui/                              Button, Field, Input, Select, Checkbox, Card, Badge, Progress, Alert, Stepper, EmptyState
    brand/                           Wordmark
    layout/                          App header and footer
    auth/                            Google sign-in button
  i18n/                              Locale config and message catalogues (en; pt prepared)
  lib/                               Site constants (Mozambique market defaults), utilities
```

## Design system

Tokens and guidance live in the **Handson** design system (Claude artifact) and are mirrored in `src/app/globals.css`. The WordPress site uses the same values. Visit `/design-system` locally to see every component.

## Localisation

English ships first. To add Portuguese: create `src/i18n/messages/pt.json` with the same keys as `en.json`, add `"pt"` to `locales` in `src/i18n/config.ts` and register its loader in `src/i18n/get-messages.ts`.

Market defaults (Mozambique, +258, MZN, Africa/Maputo) are in `src/lib/site.ts`.

## Environment variables

See `.env.example`. The Supabase service-role key is server-only and must never be exposed to the browser.

## Authentication

Supabase Auth with two methods: **Continue with Google** and **email/password with mandatory email verification**.

| Route | Purpose |
|---|---|
| `/register`, `/login` | Sign-up and sign-in (Server Actions, Zod validation) |
| `/check-email` | Shown after email sign-up |
| `/auth/confirm` | Verification and password-reset email links (`token_hash`, works across devices) |
| `/auth/callback` | Google OAuth return |
| `/forgot-password`, `/reset-password` | Password reset |
| `/onboarding`, `/dashboard` | Protected. First-time users go to onboarding, returning users to the dashboard |

Security notes:
- `src/proxy.ts` refreshes the session and redirects signed-out users; every protected page also calls `requireUser()` on the server, and the database enforces Row Level Security.
- An unverified email is never treated as signed in (`getCurrentUser()` checks `email_confirmed_at`).
- Sign-up and password-reset responses are identical whether or not an account exists.
- `next` redirect parameters are restricted to same-site paths (`safeNextPath`).

### Database migrations

SQL migrations live in `supabase/migrations/`. Apply each new file in order, either in **Supabase → SQL Editor** (paste and run) or with the Supabase CLI (`supabase db push`).

| Migration | Contents |
|---|---|
| `20261109000100_profiles.sql` | `profiles` table, auto-creation on sign-up, own-row RLS, column-level update grants |

### Supabase dashboard settings

1. **Authentication → URL Configuration**
   - Site URL: `https://app.handson.cloud`
   - Redirect URLs: `https://app.handson.cloud/**`, `https://handson-ten-eta.vercel.app/**`, `http://localhost:3000/**`
2. **Authentication → Sign In / Providers → Email**: enable, **Confirm email** on, minimum password length 8.
3. **Authentication → Emails → Templates** (links use `token_hash` so they work on any device):
   - Confirm signup, link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - Reset password, link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
4. **Authentication → Sign In / Providers → Google**: enable, paste the Google Client ID and Client Secret.
5. **Authentication → Emails → SMTP Settings**: custom SMTP (see below). The built-in sender is rate-limited and not for production.

### Google OAuth (Google Cloud Console)

1. Create a project, then **Google Auth Platform → Branding**: app name `Handson`, support email, home page `https://handson.cloud`, privacy policy `https://handson.cloud/privacy-policy/`, terms `https://handson.cloud/terms/`, authorised domains `handson.cloud` and `supabase.co`.
2. **Audience**: External. Publish the app when ready for real users.
3. **Data Access**: scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. **Clients → Create client → Web application**:
   - Authorised JavaScript origins: `https://app.handson.cloud`
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### Transactional email (Resend)

1. Add domain `handson.cloud` in Resend and create the DNS records it lists in Hostinger. Resend uses the `send.` subdomain for its MX and SPF records, so the existing mailbox for hello@handson.cloud is not affected.
2. Create an API key with sending access.
3. Supabase SMTP settings: host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender email `hello@handson.cloud`, sender name `Handson`.

## Deployment

Deployed on Vercel from the `main` branch; `app.handson.cloud` points to Vercel via a CNAME in Hostinger.

Vercel environment variables (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL` (`https://app.handson.cloud`). Full go-live checklist in Phase 8.
