<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Handson project guidance

These instructions are the shared project rules for coding agents. Read them before planning or changing code, tests, migrations, configuration, or documentation. If a more specific instruction exists in a subdirectory, follow both unless they conflict; ask before resolving a material conflict.

## Product and repository context

- Handson is a student-first early-career talent platform, initially serving Mozambique.
- This repository contains the web application served at `app.handson.cloud`. The public marketing website at `handson.cloud` is a separate WordPress site and is not part of this codebase.
- The existing student and Handson-admin experience is established. Preserve it while extending the platform; do not rebuild or casually redesign existing flows.
- Employer Management is being delivered in steps. Do not assume a later-step feature exists just because the foundation supports it.
- Market defaults are Mozambique, MZN, +258 and Africa/Maputo. Follow the existing localisation and formatting patterns.

## Technology and implementation

- Current stack: Next.js 16 App Router (Cache Components), React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth and Storage), `@supabase/ssr`, Zod, Vitest, PGlite, Playwright and Vercel.
- Use the versions and conventions in `package.json` and the lockfile. Do not upgrade frameworks or dependencies as incidental cleanup.
- Follow the existing folder structure, component patterns, design tokens and server/client boundaries. Inspect neighbouring code before introducing a new pattern.
- Prefer server components and server-side validation. Add client components only when browser interaction requires them.
- Keep TypeScript types explicit. Validate untrusted input at system boundaries using the project's established Zod patterns.
- Do not add a dependency unless it is necessary; explain why and keep the change minimal.
- Preserve responsive behaviour, accessibility and the existing Handson visual language. Do not introduce a new design system without an explicit product decision.

## Product and access-control invariants

- One Supabase Auth account may have more than one context: a student profile, Handson administrator access, and membership in one or more companies. Never create duplicate accounts to represent different roles.
- A student registration or Google sign-in must never grant employer membership. Employer access comes only from the approved company-membership/invitation flow.
- Account suspension is account-wide. Company suspension applies to that company only. Keep the authoritative account status and any compatibility mirror consistent with the database design.
- Keep student routes protected by the student guard, administrator routes by the administrator guard, and company routes by company membership/role checks. Enforce access on the server and in the database; hiding a button is not authorisation.
- Company data must remain tenant-isolated. A member of one company must never read or change another company's private data. Internal Handson-only notes must not be exposed to company members.
- Keep Row Level Security enabled and effective. Do not add broad client write grants or weaken policies to make a feature easier.
- Security-definer database functions must follow the repository's established hardening pattern: empty `search_path`, fully qualified object names, explicit caller/account/role checks, and explicit execute grants. Revoke default public access where appropriate.
- Invitation tokens are secrets: store only token hashes, enforce expiry and verified matching email, and never log or expose raw tokens.
- Legal acceptance is version-specific and per document. Only the exact current, effective versions may be accepted. Do not activate the gate until both required documents are current and effective.
- Consent history is account-based. The `user_id` relationship is authoritative; retain the legacy `profile_id` compatibility path until a separately reviewed expand/contract migration is explicitly approved.
- Preserve the existing student registration, onboarding, profile, dashboard, document upload/download, consent and administrator workflows unless the task explicitly changes them. Add regression coverage when changing shared behaviour.

## Supabase, migrations and environments

- Read `docs/database-migrations.md` before any database or migration work and `docs/go-live.md` before production-readiness or go-live work. For Employer Management, also read `docs/employer-module.md` when that file exists in the branch being worked on.
- Never edit a migration that has already been applied to a shared environment. Add a new migration; prefer expand/contract for changes that need to preserve compatibility.
- Database changes reach staging and production only through the repository's **Database migrations** GitHub Actions workflow. Never apply migrations through the Supabase SQL Editor or an ad-hoc local connection.
- `verify` and `plan` are read-only. `apply` changes the target database. `repair-history` changes migration history and is only for its documented one-time recovery case. Never describe a plan or verification as an applied migration.
- Apply and rehearse migrations on staging first. Production changes require a reviewed plan, a suitable backup/recovery plan, the required production environment approval, and the user's explicit approval. Stop if the plan shows an unexpected migration, schema difference, history issue or target.
- Never run a production migration, production repair, deployment, destructive data operation or irreversible account action without explicit user approval.
- CI and Vercel Preview deployments must use staging credentials and data only. Production credentials must never be available to pull requests or non-production branches.
- Preserve the fail-closed safeguard: a Preview deployment configured with the production database must refuse to serve the application.
- Never request, print, commit or place secrets in source code, test fixtures, logs, issues, pull requests or chat. Refer to secret names only. Do not change environment secrets unless explicitly asked and approved.
- Use dedicated staging test accounts, not personal or production accounts. Do not put real student or employer personal data in tests.

## Development workflow and quality gates

1. Inspect the current branch, working tree, relevant code and project documentation before editing. Confirm dependencies and the intended environment.
2. State the proposed change and any migration, security, compatibility or deployment implications before making a material change.
3. Work on a focused feature/fix branch. Do not commit directly to `main`, bypass branch protection or merge a pull request on the user's behalf.
4. Keep changes scoped. Do not mix unrelated refactors, dependency upgrades or formatting churn into a feature.
5. Add or update tests for changed behaviour, including negative and cross-tenant cases for security-sensitive work.
6. Run the relevant checks and report exactly what ran and its result. Do not claim a test, manual check, deployment or database action succeeded unless its result was observed.
7. Open or update a pull request with a clear summary, test evidence, migration/deployment order, risks and any manual staging steps. Wait for required checks and user approval before merge.

Available project commands (see `package.json` for the source of truth):

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run test:db`
- `npm run test:e2e`
- `npm run build`

The protected-branch CI currently includes these required checks: **Lint, types, unit and database tests, build**; **End-to-end tests**; and **Migration runner self-test**. Treat the repository's live branch rules and workflow configuration as authoritative if they change.

## Documentation and collaboration

- Keep documentation aligned with implemented behaviour. Clearly distinguish implemented functionality from planned future steps.
- Use `README.md` for the repository overview, `docs/database-migrations.md` for migration/environment procedures, and `docs/go-live.md` for go-live readiness.
- Explain technical decisions and risks in concise, plain language. The product owner prefers one clear next action at a time.
- When reporting completion, include the branch/PR, files changed, tests actually run, results, outstanding risks and any user action still required.
- If requirements are ambiguous or a change could alter permissions, legal obligations, user data, production behaviour or deployment state, stop and ask before proceeding.
