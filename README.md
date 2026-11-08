# Handson

Student-first early-career talent platform for Mozambique. This repository contains the student and administrator web application served at **app.handson.cloud**. The public marketing site (landing page, About, Contact, Privacy Policy, Terms) runs on WordPress at **handson.cloud**.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation and design system | In progress |
| 2 | Authentication (Google, email/password) | Not started |
| 3 | Database, Row Level Security | Not started |
| 4 | Six-step student onboarding | Not started |
| 5 | Student dashboard | Not started |
| 6 | Document management | Not started |
| 7 | Admin portal | Not started |
| 8 | Testing and deployment | Not started |

The `/login` and `/register` pages are layouts only. Their controls are disabled until Phase 2 connects authentication.

## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- Tailwind CSS 4, design tokens in `src/app/globals.css`
- Self-hosted fonts: Bricolage Grotesque (headings), Inter (text)
- Planned: Supabase (Postgres, Auth, Storage), Google OAuth, Vercel hosting

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

## Deployment

Planned on Vercel, deployed from this repository, with `app.handson.cloud` pointed at Vercel via a DNS record in Hostinger. Full instructions will be added in Phase 8.
