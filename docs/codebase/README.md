# Codebase Guide

Developer entry point for the I Love DR Realty code. There are two repositories: `realty` (Turborepo with `apps/landing` Next.js 15 static export, `apps/dashboard` Vite + React SPA, `packages/ui`) and `realty-api` (FastAPI + SQLAlchemy + Alembic, Postgres/Supabase Storage, deployed separately). Paths in these docs are relative to the repo they belong to (`apps/...` or `realty-api/...`, which also appears as `routes/...`, `models/...`).

Start with [../ARCHITECTURE.md](../ARCHITECTURE.md) and [../ENV.md](../ENV.md), then pick the feature area below.

| Doc | What it covers |
|---|---|
| [auth.md](auth.md) | Signup with email code or Google, login and cookie/JWT handling, password reset, account deactivation/deletion request, `/auth/me`, the dashboard auth gate and role-locked navigation, rate limits. |
| [listings.md](listings.md) | Listing lifecycle and data model, public search and pagination, landing detail/SEO/share images, per-role dashboard forms and tables, admin review and edit-approval queue, Deal of the Week, bulk CSV import, known gotchas. File-by-file index: [../LISTINGS.md](../LISTINGS.md). |
| [bookings-payments.md](bookings-payments.md) | Rental bookings for guests and logged-in users, availability and double-booking prevention, pricing and fees, PayPal authorize/capture/payout, webhooks, payout cron, booking emails, admin bookings and payout release. |
| [leads.md](leads.md) | Lead types and statuses, landing capture forms and Google Ads attribution, admin assignment (including owner promotion), realtor pipeline, GoHighLevel sync and webhook. |
| [owner-realtor.md](owner-realtor.md) | The Owner and Realtor dashboards, how users get those roles, the "connect a scheduling page / PayPal before adding listings" setup gate, assigned-agent linkage. Role definitions: [../ROLES.md](../ROLES.md). |
| [buyer-features.md](buyer-features.md) | Buyer experience: saved homes, inquiries, bookings summary, upgrade page, calculator and marketing pages, Spanish landing page. |
| [admin-tools.md](admin-tools.md) | Admin dashboard pages, the `/admin` API surface, users and upgrade requests, settings, activity log, dead code to ignore. |
| [infrastructure.md](infrastructure.md) | HTTP clients, build and deploy, configuration, database, storage, rate limiting, background jobs, migrations. |

Related references: [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) (tokens, fonts, i18n, shared UI), [../API.md](../API.md), [../DATA_MODELS.md](../DATA_MODELS.md), [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Quick orientation

- **Auth:** HttpOnly cookie `ildr_token` (or Bearer header). Roles `buyer | owner | realtor | admin` enforced in the API; the dashboard only hides UI.
- **Dashboard routing:** no router per page. `App.tsx` -> `AdminDash` (admins) or `Dashboard` (everyone else), switching on a `view` string from the URL (`/:view`).
- **Feature flags:** `PAYPAL_ENABLED` in `apps/*/src/lib/features.ts` (landing and dashboard must agree); server-side PayPal is controlled by its credentials and `PLATFORM_FEE_PCT`.
- **Background work:** in-process asyncio tasks started in `realty-api/main.py` (pending-user cleanup hourly, payout cron daily) and FastAPI `BackgroundTasks` for CSV import. There is no separate worker, so a restart can skip a scheduled run.
- **Storage:** listing photos, avatars, agreement PDFs and share images go to Supabase Storage via `realty-api/utils/storage.py`; the database is reached directly with SQLAlchemy.
- **Language:** English and Spanish. UI strings live in `apps/landing/src/locales` and `apps/dashboard/src/locale`; listings carry `description` and `description_es`.
- **Docs are gitignored:** `docs/` is not tracked, so keep a copy before cleaning the workspace.
