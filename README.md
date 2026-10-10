# I Love DR Realty — Frontend Monorepo

Bilingual (EN/ES) real-estate platform for the Dominican Republic. This repo holds the two web apps; the backend is the sibling repo **`realty-api`** (keep both cloned side by side).

| Path | What | Stack | Hosting |
|------|------|-------|---------|
| `apps/landing` | Public site: search, listing pages, blog, calculator, login/signup | Next.js 15 (static export), Tailwind v4, i18next | Vercel → `ilovedrrealty.com` |
| `apps/dashboard` | Role dashboards: buyer, owner, realtor, admin | Vite + React, Tailwind v4, i18next | Vercel → `app.ilovedrrealty.com` |
| `packages/ui` | Shared design tokens (currently unused by the apps) | TypeScript | — |

API: FastAPI on Railway (`api.ilovedrrealty.com`), Postgres + Storage on Supabase, email via Resend, payments via PayPal.

## Quick start

```bash
npm install
cp apps/landing/.env.example   apps/landing/.env      # PowerShell: Copy-Item
cp apps/dashboard/.env.example apps/dashboard/.env
npm run dev                  # landing :3000 + dashboard :5174 (needs the API on :8000)
```

Run the API first — see `realty-api/README.md`. Log in through the landing site (`/login`); the dashboard redirects there when unauthenticated.

| Command | Does |
|---------|------|
| `npm run dev` / `dev:landing` / `dev:dashboard` | Dev servers |
| `npm run build` | Build both apps (`apps/landing/out`, `apps/dashboard/dist`). The landing build fetches every listing from the API at build time, so the API must be reachable via `NEXT_PUBLIC_API_URL` |
| `npx turbo run typecheck` | `tsc --noEmit` — the only static check (there is no lint, test suite or CI) |

## Rules that matter

- **Every user-facing string needs both languages**: add keys to `locales/en` **and** `locales/es` (landing) or `locale/en` **and** `locale/es` (dashboard).
- Environment variables are baked in at build time; redeploy after changing any `NEXT_PUBLIC_*` / `VITE_*` value. Unset `*_API_URL` silently falls back to `localhost`.
- The landing site is static: new listings only get their SEO page and sitemap entry after a rebuild.
- Branches: work on `dev`, fast-forward `main`. Confirm in Vercel which branch deploys (`production` also exists and is behind `main`).
- Never commit `.env` files or credentials.

## Documentation

The full docs (architecture, API, data models, env vars, runbooks, plan, known issues) are in `docs/` — start with `docs/HANDOVER.md`, then `docs/CONTRIBUTING.md` and `docs/ARCHITECTURE.md`.
