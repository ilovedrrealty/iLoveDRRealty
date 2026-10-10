# Developer Handover — I Love DR Realty

**Prepared:** 2026-10-10 · **Code state:** `main` of both repos at `5754fea` (realty) / `3230c6c` (realty-api), 2026-09-18

Start here. This page tells a new developer what the system is, what is live, what must be transferred or confirmed, how to run the common operations, and what is risky or unfinished. Detail lives in the linked docs; this page does not duplicate it.

---

## 1. What this is

A bilingual (EN/ES) real-estate platform for the Dominican Republic: public marketing/search site, role-based dashboard (buyer, owner, realtor, admin), and a REST API. Features in production include listings with admin approval, lead capture and assignment, GoHighLevel CRM sync, rental bookings with PayPal payments and payouts, Calendly / Google Calendar scheduling links, admin CSV bulk import (for co-listed inventory), and SEO/Google Ads tracking.

```
ilovedrrealty.com        Next.js 15 static export     Vercel   (repo: realty/apps/landing)
app.ilovedrrealty.com    Vite + React SPA             Vercel   (repo: realty/apps/dashboard)
api.ilovedrrealty.com    FastAPI + SQLAlchemy         Railway  (repo: realty-api)
                         Postgres + Storage           Supabase
```

Two repositories: `realty` (Turborepo frontends, GitHub `iBlinkyxD/realty`) and `realty-api` (GitHub `iBlinkyxD/realty-api`). Most features touch both.

## 2. Document map

| Need | Read |
|------|------|
| How the pieces fit, flows, known gaps | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Run it locally, branches, migrations, deploys, i18n rules | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Every environment variable | [ENV.md](ENV.md) (+ `.env.example` in each app) |
| Every API endpoint | [API.md](API.md) |
| Tables, enums, migration chain, bootstrapping | [DATA_MODELS.md](DATA_MODELS.md) |
| Who can do what | [ROLES.md](ROLES.md) |
| Where feature code lives | [codebase/README.md](codebase/README.md) |
| Listings feature spec | [LISTINGS.md](LISTINGS.md) |
| Colours, fonts, tokens | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| What is done / what is left | [PLAN.md](PLAN.md), [plan/build_order.md](plan/build_order.md) |
| Why things were built, session by session | `PLAN_HISTORY.md`, `reports/` (local only, not in git) |
| Old plan snapshots | `archive/` (local only, not in git) |

> **Tracked vs local:** this handover set is committed in the `realty` repo (`docs/` is whitelisted in `.gitignore`). Not tracked, and only on the previous maintainer's machine: `docs/PLAN_HISTORY.md` (session log), `docs/reports/` (daily/weekly reports), `docs/archive/` (old plan snapshots), `docs/IMPL_PLAN.md`, `docs/New.md`, and `.claude/commands/` (the team's commit/sync helper commands). Ask for them if you want the history. Each repo also has a `README.md` with the essentials.

## 3. Access and accounts to transfer

The code does not tell us who owns these accounts; confirm each with the current owner and move it to a company-owned login with at least two admins. **Secrets are never kept in the repos or docs; share them through a password manager.**

| Service | Used for | Where configured |
|---------|----------|------------------|
| GitHub (`iBlinkyxD/realty`, `iBlinkyxD/realty-api`) | Source | Repo settings / collaborators |
| Vercel (2 projects: landing, dashboard) | Frontend hosting, domains | Project settings; env vars `NEXT_PUBLIC_*` / `VITE_*` |
| Railway (API service) | API hosting; runs migrations on deploy | Service variables ([ENV.md](ENV.md)) |
| Supabase | Postgres database and Storage bucket `listing-images` (not used for auth) | `DATABASE_URL`, `SUPABASE_*` |
| Resend | Transactional email (DKIM/SPF/DMARC verified for `ilovedrrealty.com`) | `RESEND_API_KEY`, `EMAIL_FROM` |
| PayPal Business + developer app | Booking payments and owner payouts; webhook to `POST /webhooks/paypal` | `PAYPAL_*`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` |
| GoHighLevel | CRM two-way lead sync; webhook to `POST /webhooks/ghl` | `GHL_*` |
| Google Cloud | OAuth client (Google login), Maps API key | `*_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Google Ads / Search Console / Analytics tag | Conversion tracking, indexing | Landing `layout.tsx`, `lib/gtag.ts`; GSC property |
| Tidio | Live chat widget + Lyro AI | Tidio dashboard (plan upgrade pending, see plan) |
| Domain registrar / DNS | `ilovedrrealty.com`, `app.`, `api.` | Registrar |

## 4. First day

```bash
git clone <realty> && git clone <realty-api>     # side by side in one folder
cd realty && npm install && cp apps/landing/.env.example apps/landing/.env && cp apps/dashboard/.env.example apps/dashboard/.env
cd ../realty-api && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt && cp .env.example .env
# edit DATABASE_URL + JWT_SECRET, then:
python bootstrap_db.py && alembic upgrade head && python seed.py   # seed = dev only
uvicorn main:app --reload --port 8000
cd ../realty && npm run dev            # landing :3000, dashboard :5174
```

Full steps and troubleshooting: [CONTRIBUTING.md](CONTRIBUTING.md). With `RESEND_API_KEY` empty, emails are logged instead of sent (the signup code appears in the API console). Never point a local `.env` at the production database.

## 5. Things to confirm on day one

These cannot be determined from the repositories:

1. **Which branch does Vercel deploy?** `production` exists in `realty` and is 25 commits behind `main` (it lacks the PayPal/bookings work). If Vercel's Production Branch is `production`, the live site is behind `main`. Check Vercel > Settings > Git for both projects.
2. **Which branch does Railway deploy?** `realty-api` has only `dev` and `main`.
3. **PayPal mode.** The integration was switched on 2026-09-18 (commit `90f3dce`) after credentials were set on Vercel and Railway. Check `PAYPAL_MODE` on Railway (`sandbox` vs `live`), that Payouts API access is approved on the PayPal account, and that the webhook is registered with the ID stored in `PAYPAL_WEBHOOK_ID`.
4. **Is there a staging database?** None is referenced. Migrations run automatically on every API deploy, against whichever DB `DATABASE_URL` points at.
5. **Backups.** Confirm the Supabase plan and point-in-time-recovery / backup settings.
6. **Who is the first admin?** No script creates one (see 6.6). Confirm the existing admin accounts and the `notify_email` address.

## 6. Runbook

**6.1 Deploy**
- API first when a change adds endpoints or migrations (the start command runs `bootstrap_db.py && alembic upgrade head && uvicorn ...`). Write migrations that are additive and re-runnable.
- Landing is static: it must be **rebuilt/redeployed** whenever listings change (to generate `/listing/<id>/` pages and the sitemap) or any `NEXT_PUBLIC_*` variable changes. Nothing triggers this automatically. The build needs the API reachable.
- Branch flow used so far: work on `dev`, fast-forward `main`, push; the `commit-dev` / `sync-main` commands in `realty/.claude/commands/` do this for both repos at once.

**6.2 Migrations** — `alembic revision --autogenerate -m "..."`, edit the file, ensure `alembic heads` shows one head (currently `bc364345c64b`), `alembic upgrade head`. Core tables are not created by any migration; `bootstrap_db.py` creates them on an empty DB. See [DATA_MODELS.md](DATA_MODELS.md).

**6.3 Bulk-import listings (CSV)** — Admin dashboard > Listings > bulk import, or `POST /admin/listings/bulk-import` (multipart field `csv_file`; UTF-8 or Windows-1252). Rows dedupe on `source_ref`; poll `GET /admin/listings/bulk-import/{job_id}`. After a large import, regenerate share images (6.4) and rebuild the landing site (6.1). Format and columns: [API.md](API.md).

**6.4 Share-preview images** — generated on listing create/edit. Backfill with `POST /admin/listings/regenerate-share-images?only_missing=true` (runs synchronously inside the request; for thousands of listings run it in batches or expect a long request).

**6.5 Bookings and payouts** — guest requests a stay, PayPal authorises (no charge), owner/realtor confirms (capture), a daily cron at 00:01 UTC pays out the owner minus `PLATFORM_FEE_PCT` (default 20%) the day after check-out. If the cron missed a day (it is in-process and not retried), use admin Bookings > Release Payout (`POST /bookings/{id}/release-payout`). Detail: [codebase/bookings-payments.md](codebase/bookings-payments.md).

**6.6 Admins** — The admin UI can change a user's role only to buyer, owner or realtor (`PUT /admin/users/{id}/role` refuses admin targets and `admin` as a value), so there is no in-app or scripted way to create an admin. Set `users.role = 'admin'` directly in SQL for an existing verified user. **Never run `seed.py` against production** (it creates an admin with a hard-coded password).

**6.7 Where to look when something breaks** — Railway logs (API; `/health` is the health check), Vercel build/function logs, Resend dashboard (email delivery), PayPal developer dashboard (webhook deliveries), GHL logs. Several integrations swallow errors silently (GHL, email), so a missing email or CRM record is usually only visible in the third-party dashboard.

## 7. Known issues and risks

Verified in code on 2026-10-10; not a prioritised backlog. See also [ARCHITECTURE.md §10](ARCHITECTURE.md) and "Known drift" in [DATA_MODELS.md](DATA_MODELS.md).

**Security / data exposure**
- Public listing endpoints return `owner_paypal_email`, `owner_id` and co-listing contact fields — consider stripping from public responses.
- `POST /auth/google` does not verify the Google token's audience against the app's client ID.
- `POST /inquiries`, `POST /bookings`, `/bookings/create-payment-auth` have no rate limit; `/auth/register` reveals whether an email exists (409). The in-memory limiter may key on the proxy IP behind Railway.
- Google Maps key and OAuth client are not restricted to the production domain (GCP console, manual).
- Production credentials were stored in plain text in `docs/env_stuff.md` inside a OneDrive-synced folder. **Treat them as exposed: move them to a password manager, delete the file, and rotate** (database password, `JWT_SECRET`, Resend key, Supabase service/anon keys, Google keys). Rotating `JWT_SECRET` logs everyone out.

**Correctness**
- Approving a queued listing edit drops changes to `price_per_day`, `currency` and `owner_paypal_email`.
- `POST /leads` with a non-UUID `property_id` returns 500.
- Emails link to `<LANDING_URL>/dashboard` and `/property?id=`; neither route exists on the landing site (404 unless redirects exist in Vercel).
- Realtors can set lead status `schedule`, which other code paths do not recognise (and is never synced to GoHighLevel).
- `currency` is stored but never honoured by the display code, so bulk-imported DOP prices render as USD.
- The "connect calendar + PayPal before adding listings" gate is enforced in the UI only, not by the API.
- `PUT /auth/me` nulls `calendly_url` / `paypal_email` when the client omits them (a July fix covers the current dashboard forms; any new client must send them).
- Nothing writes the `inquiries` table (`POST /inquiries` is unused by the UIs), so the owner Leads page and the buyer/owner "inquiries" tiles show no real traffic.
- Unused (dead) dashboard files: `Approvals.tsx`, `UpgradeRequests.tsx`, `Profile.tsx`, `ListingEditDiffPanel.tsx`.
- A landing build with the API unreachable or `NEXT_PUBLIC_API_URL` unset succeeds but silently produces no listing pages or sitemap entries; unset `*_API_URL` falls back to `localhost` with no error.

**Operations**
- Payout cron: in-process, single date match, no retry, no lock across replicas (do not scale the API beyond one instance without fixing).
- Fresh databases created by `bootstrap_db.py` differ from production (duplicate unique indexes, no `settings` single-row CHECK, different `ON DELETE` on `listings.assigned_realtor_id`).
- `bookings` has no indexes beyond the primary key and stores `check_in`/`check_out` as text; admin list endpoints are unpaginated.
- **No CI, no automated tests, no lint, no error monitoring.** The only checks are `npm run typecheck` and the production build.
- `packages/ui` is unused; design tokens and the `PAYPAL_ENABLED` flag are duplicated in both apps.
- `anonymous_leads` table is unused.

## 8. What is left to do

Authoritative list: [plan/build_order.md](plan/build_order.md) and [PLAN.md](PLAN.md). In short:
- Content engine (Phase 28): 9 Spanish blog translations, staged posts, content calendar, newsletter endpoint + wiring.
- Admin site settings (Phase 24, partial: `GET/PUT /admin/settings` only covers `notify_email`) and the GHL settings tab (Phase 23, depends on it).
- Account hard-delete after the 30-day grace (Phase 26 `POST /auth/me/delete-confirm`). The post-deactivation redirect exists but appears to land on the wrong host in production.
- Tidio Flow and plan upgrade (Phase 27, external).
- Security #29 (localhost API fallbacks) and #30 (restrict Google keys in GCP; not verifiable from the repo). #31 (frontend `.env.example` files) is done but the new files are uncommitted.
- PayPal go-live verification (section 5.3).
- Recommended additions: CI (typecheck + build), a staging environment, tests for booking/payout logic, error tracking, and the fixes in section 7.

## 9. Handover checklist (for the outgoing owner)

- [ ] Transfer or share every account in section 3; remove personal logins where possible.
- [ ] Move all secrets to a password manager; delete `docs/env_stuff.md`; rotate credentials (section 7).
- [ ] Optionally hand over the untracked history: `docs/PLAN_HISTORY.md`, `docs/reports/`, `docs/archive/`, and `.claude/commands/`.
- [ ] Confirm deploy branches (section 5.1–5.2) and record the answers in [CONTRIBUTING.md](CONTRIBUTING.md) section 10.
- [ ] Confirm PayPal mode, Payouts approval and webhook (section 5.3).
- [ ] Confirm backups / PITR on Supabase.
- [ ] Walk the new team through one full flow: signup, listing submit and approve, lead assignment, guest booking and payout.
