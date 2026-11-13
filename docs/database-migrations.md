# Database migrations and environments

How database changes reach staging and production, and how the two are kept apart.

## Rules

- Production migrations run **only** through the **Database migrations** GitHub Actions workflow. They are never run in the Supabase SQL Editor again.
- The workflow is started by hand, runs only from the `main` branch, and uses the protected `staging` or `production` environment. A production run waits until the required reviewer approves it.
- Production secrets live only in the `production` environment and are never available to pull requests or other branches. Staging has its own, separate secrets.
- Before changing anything, every run compares the database with a reference built from the migration files. If anything differs, or the migration history is inconsistent, the run stops. **Nothing is ever reconciled automatically**, and migration history changes only through `repair-history`, which a person starts and approves.
- Each migration runs in a single transaction together with its history entry. A failure rolls that migration back and stops the run.
- CI, previews and staging never use the production database. A preview deployment configured with the production database refuses to serve pages (HTTP 503).

## Actions

| Action | Changes the database? | What it does |
|---|---|---|
| `verify` | No (read-only transaction) | Compares the schema with a reference built from the migrations recorded as applied (or, before any history exists, up to the `baseline` you give). |
| `plan` | No | `verify`, then lists the migrations `apply` would run. |
| `repair-history` | History only | `verify` against `baseline`, then records those migrations as applied. Only for a database with no history. Requires typing the database name. |
| `apply` | Yes | A fresh `verify` and `plan`, then each pending migration in its own transaction, then a final `verify` against a reference with every migration. Requires typing the database name. |

The comparison covers tables, columns, constraints, indexes, Row Level Security, policies, functions (signature, security, `search_path`, body fingerprint), who may execute each function, table and column grants, triggers on `auth.users`, enum types and storage buckets (`supabase/ops/catalogue.sql`). Reference data such as catalogue entries is reported but not compared, because administrators may add entries.

### Accepted differences
`supabase/ops/accepted-differences.json` lists reviewed exceptions: differences between a database and the reference that are known, explained and harmless. Each entry names the target, the migration from which it applies (`applies_from_baseline`), the exact expected and found catalogue lines, the reason, and its approval status. An entry takes effect only once it is on `main`, because the workflow runs only from `main`. The `main` branch ruleset (*Protect main*, no bypass) requires a pull request and three passing CI checks (*Lint, types, unit and database tests, build*; *End-to-end tests*; *Migration runner self-test*); it does not require approval from an independent reviewer. The repository owner is responsible for personally reviewing and merging the pull request that adds an entry; that merge is its approval. Verification uses an entry only for its target and only when the reference includes that migration. It always reports used entries in the summary. It fails on any other difference, on an entry whose exact difference is no longer present (a changed fingerprint, or the difference was fixed), and on a malformed file. Change the file only through a reviewed pull request.

The current entry covers `admin_set_record_verification` in production. Migration `20261109000500` was pasted from Windows-format text, so its multi-line dynamic SQL literal holds CRLF line endings. Behaviour is unaffected.

Function bodies are fingerprinted with Windows line endings (CRLF) treated as LF in code and comments, but never inside string literals or quoted identifiers.

This repository is public, so workflow logs and summaries are public too. They contain only schema structure and row counts, never data or credentials. Full reports are kept as artifacts for staging only.

## One-time setup

### Supabase staging project
1. Create a project named **handson-staging** in the same organisation (free plan), in the same region as production.
2. **Authentication → URL Configuration:** set the Site URL to the staging preview address, and add `https://handson-*.vercel.app/**` and `http://localhost:3000/**` to the Redirect URLs.
3. **Authentication → Emails → Templates:** use the same templates as production (the `/auth/confirm?token_hash=…` links in the README).
4. **Authentication → Sign In / Providers → Google:** enable it with the same Google client ID and secret. In Google Cloud, add `https://<staging-ref>.supabase.co/auth/v1/callback` to the client's authorised redirect URIs.

### GitHub (Settings → Environments)
Create two environments:

| Environment | Deployment branches | Required reviewers | Secret `SUPABASE_DB_URL` |
|---|---|---|---|
| `staging` | `main` only | optional | staging connection string |
| `production` | `main` only | **you** | production connection string |

The connection string comes from Supabase → **Connect** → *Session pooler* (URI), with the database password filled in. Paste it straight into GitHub; it is never shared anywhere else. If you do not know the password, reset it in Supabase → Database → Settings (the app does not use it).

Repository **variables** (Settings → Secrets and variables → Actions → Variables) for CI, both public values of the **staging** project:
`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`. The `E2E_*` test-account secrets must be **staging** accounts.

### Vercel (Project → Settings → Environment Variables)
| Variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | production URL | **staging** URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production key | **staging** key |
| `NEXT_PUBLIC_APP_URL` | `https://app.handson.cloud` | leave empty |

Each variable needs two separate entries: one for *Production* only and one for *Preview* only. After changing them, redeploy the previews.

## Procedures

### First run: production history
The six existing migrations were applied in the SQL Editor, so production has no migration history yet.
1. Run **verify** on `production` with `baseline` = `20261109000600`. It is read-only.
2. If it reports differences, stop. Each difference is reviewed and a reconciliation agreed, usually a new migration tested on staging first. Old migration files are never edited.
3. When verify is clean and you approve, run **repair-history** on `production` with the same baseline and `confirm` = `production`. This records the six migrations; it runs nothing.

### First run: staging
Run **apply** on `staging` with `confirm` = `staging`. The staging database is empty, so every migration on `main` is applied and recorded.

### Every new migration
1. Merge the migration pull request (the database files only; the application follows in its own pull request).
2. **apply** on `staging`, then test.
3. **plan** on `production`, review the list, then **apply** on `production` and approve.
4. Merge the application pull request.

## Self-test
`scripts/selftest/db-migrate.selftest.sh` runs the migration runner against a throwaway local Postgres. It checks verification, plan, refusal on drift and on inconsistent history, repair-history, apply with rollback of a failing migration, and the final verification. CI runs it on every change.
