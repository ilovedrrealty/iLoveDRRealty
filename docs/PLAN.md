# I Love DR Realty — Master Project Plan

**Last updated:** 2026-10-10
**Status:** Platform built and in production use; remaining work is go-live confirmation, a handful of open feature phases, content, and post-launch growth.

> The previous version of this file (a stage-by-stage narrative of the June 2026 demo-dashboard sessions, with "backend 0% / overall 54%") was stale. That narrative is preserved in [PLAN_HISTORY.md](PLAN_HISTORY.md) (Sessions -2 to 23) and the older plan snapshots in `docs/archive/`. Current, detailed tracking lives in [`docs/plan/`](plan/README.md).

---

## A. What the product is

A bilingual (EN/ES) real-estate marketplace for the Dominican Republic: public search and marketing site, role-based dashboards (buyer, owner, realtor, admin) and a REST API, with rental bookings paid through PayPal and leads synced to a GoHighLevel CRM. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system as implemented.

| Piece | Repo / path | Stack | Host |
|---|---|---|---|
| Marketing site | `realty/apps/landing` | Next.js 15 static export, Tailwind v4 | Vercel — `ilovedrrealty.com` |
| Dashboard | `realty/apps/dashboard` | Vite + React SPA | Vercel — `app.ilovedrrealty.com` |
| API | `realty-api` | FastAPI, SQLAlchemy, Alembic (Docker) | Railway — `api.ilovedrrealty.com` |
| Data / files | Supabase | PostgreSQL + Storage | — |
| Email | Resend | — | — |

---

## B. Stage status

| Stage | Name | Status | Evidence in the repos |
|---|---|---|---|
| 1 | Marketing site (landing) | Complete | All public pages live as Next.js routes; bilingual; SEO (sitemap, robots, per-page metadata, JSON-LD); Spanish ad landing page (Sep 2026) |
| 2 | Dashboards | Complete | Buyer, owner, realtor and admin dashboards on real data (the original static demos were replaced during Phases 7+); mobile responsive |
| 3 | Backend API | Complete | `realty-api`: auth, listings, leads, inquiries, bookings, saved homes, upgrade requests, admin, stats, chat, webhooks; 39 Alembic revisions; health check + Railway config |
| 4 | Real auth | Complete | Own JWT in an HTTP-only cookie (24 h), email verification (Resend), Google sign-in, forgot/reset password, owner/realtor approval gate; Supabase is used for Postgres and Storage only |
| 5 | Real data | Complete | Search, listing detail, dashboards and contact/lead capture all read the API; image storage in Supabase; bulk CSV import for partner inventory. Blog content is static in-repo data by design (no CMS) |
| 6 | Production deployment | Complete (see confirmations in D1) | Dockerfile/Procfile/`railway.toml`, Vercel configs, domains per ARCHITECTURE.md, email domain DKIM/SPF/DMARC verified (Phase 29), PayPal credentials configured (commit `90f3dce`) |
| 7 | Growth and advanced features | Partial / ongoing | Done: ES/EN, SEO, Google Maps, WhatsApp links, Calendly + Google Calendar scheduling, Google Ads tracking, share previews, live-chat widget. Not found in code: property-alert emails, product analytics (PostHog / Vercel Analytics), newsletter backend |

Phase-level detail (Phases 1–53) is in [plan/build_order.md](plan/build_order.md) and the archive snapshots listed in [plan/README.md](plan/README.md).

---

## C. What is live (as implemented in code, 2026-10-10)

- **Public site:** home, search (server-side filtered and paginated), property pages with gallery, map, booking and inquiry forms, buying/selling guides, ROI calculator, blog (12 posts, 3 with Spanish translations), team page with realtor agents, contact (buyer/seller flows), privacy and terms pages, Spanish ad landing page `/es/bienes-raices-republica-dominicana/`.
- **Accounts and roles:** buyer (default), owner and realtor (via upgrade request approved by an admin), admin; Google sign-in; 24-hour sessions.
- **Listings:** create/edit with approval and edit-review queues, history, deal of the week, all 31 provinces + Distrito Nacional, co-listing (PDF/agent), admin reassignment to a realtor, branded share-preview images, admin CSV bulk import (Windows-1252 OK, `source_ref` dedup, currency, `description_es`).
- **Leads and CRM:** lead capture and kanban pipeline for realtors, lead-assigned emails, two-way GoHighLevel sync with HMAC webhook, Google Ads conversions and click-ID attribution.
- **Bookings and payments:** rental availability calendar, guest and logged-in bookings, PayPal authorize/capture, owner/realtor accept/decline, double-booking rejected server-side (409), next-day payout cron, admin bookings page (including guest-request leads), request-payout / release-payout flows, booking emails. `PAYPAL_ENABLED = true` in both frontends since 2026-09-18.
- **Scheduling:** owners and realtors connect a Calendly or Google Calendar appointment page; a shared reminder blocks "add listing" until the required integrations are connected.
- **Ops:** `bootstrap_db.py` lets the API start on an empty database; `alembic upgrade head` runs on every start; the PayPal-branch migrations are idempotent.

---

## D. Remaining work

### D1. Finish line (needs a human; not provable from the repos)
1. **PayPal live mode:** confirm Railway `PAYPAL_MODE` (code default is `sandbox`) and that live credentials are set; confirm PayPal Payouts API approval and the webhook registration (`PAYPAL_WEBHOOK_ID`); run one real end-to-end booking and payout. (Phase 38)
2. **Deploy branches:** confirm which Git branch each Vercel/Railway project deploys. The frontend `production` branch (local and `origin`) last points at 2026-08-18 (`8168b08`) while `main`/`dev` are at 2026-09-18 (`5754fea`); the API repo has no `production` branch. Make sure the Aug 18 – Sep 18 work is what is actually deployed.
3. **Production schema:** confirm `alembic_version` on production is at `bc364345c64b` after the 2026-09-18 deploy.
4. **Landing rebuild trigger:** new or approved listings only get `/listing/<id>/` pages and sitemap entries after a landing rebuild, and no trigger exists in either repo. Decide on a Vercel deploy hook or schedule, especially before the bulk import.
5. **Security #30:** restrict the Google Maps API key and OAuth client to the production domains in Google Cloud Console.

### D2. Open feature phases (details in `docs/plan/`)

| Phase | Item | State |
|---|---|---|
| 24 | Admin site settings | Partial: `settings` table + `GET/PUT /admin/settings` for `notify_email` only; contact email, platform name, deal-of-week toggle and featured count not built |
| 23 | GoHighLevel settings tab (API key, location ID, toggle) | Not built; depends on Phase 24 |
| 26 | Account deletion | `POST /auth/me/delete-confirm` (hard delete after 30-day grace, anonymize leads/listings) missing; the deactivation redirect exists but appears to land on the wrong host in production and shows no message |
| 27 | Tidio live chat | Widget and `GET /public/chat/listings` live; Tidio plan upgrade, Flow wiring and Lyro data sources are external tasks |
| Security | #29 localhost API fallbacks (5 places); #30 Google key restrictions (manual, unverifiable from repo). #31 (frontend `.env.example` files) was resolved 2026-10-10 | Open (low / info) |

### D3. Content and growth
- **Phase 28 content engine:** translate the 9 remaining posts to Spanish, publish the 9 staged posts (`HIDDEN_GUIDES`), weekly calendar (financing, off-plan, neighborhood guides, market updates), newsletter signup (`POST /public/newsletter` plus wiring the inert Blog/landing inputs).
- **Partner inventory:** run the Golden Castle CSV import and decide how the landing site picks up the new listings (D1.4).
- **Not found in code (candidates):** property-alert emails for saved searches, product analytics, mortgage pre-approval calculator extension.

---

## E. Where to look

| Need | Document |
|---|---|
| Open tasks and completed-phase checklist | [plan/build_order.md](plan/build_order.md) |
| Open phase scope | [plan/overview.md](plan/overview.md) |
| Frontend / backend detail of Phases 38–53 | [plan/frontend.md](plan/frontend.md), [plan/backend.md](plan/backend.md) |
| Security findings | [plan/security.md](plan/security.md) |
| Architecture, API, data models, roles, env vars | [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [DATA_MODELS.md](DATA_MODELS.md), [ROLES.md](ROLES.md), [ENV.md](ENV.md) |
| Workflow and branches | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Index of plan docs and archives | [IMPL_PLAN.md](IMPL_PLAN.md) |
| Session history (Jun 2026 and Jul–Sep 2026) | [PLAN_HISTORY.md](PLAN_HISTORY.md) |
| Daily / weekly work reports | `reports/` |

---

*Living document. When work lands, update `docs/plan/` first (see `.claude/commands/update-plan.md`), then refresh the status tables above.*