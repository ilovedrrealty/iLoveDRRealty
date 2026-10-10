# Overview — Remaining Work

Full implementation history:
- **Phases 1–6.7** → `docs/archive/plan_v1/`
- **Phases 7–13** → `docs/archive/plan_v2/`
- **Phases 14–22** → `docs/archive/plan_v3/`
- **Phases 19, 21, 23–27** → `docs/archive/plan_v4/`
- **Phases 19–32 (snapshot Jun 30 2026)** → `docs/archive/plan_v5/`
- **Phases 33–38 (snapshot Jul 2 2026)** → `docs/archive/plan_v6/`

---

## Completed since the Phase 38 snapshot (Aug 15 – Sep 18 2026)

Detail: `frontend.md` / `backend.md` ("Phases 39–53"), checklist: `build_order.md`.

- **Phase 39 [COMPLETE]** — Team page gains a realtor-agents section (Francy Dominguez); `PAYPAL_ENABLED` UI flag introduced (2026-08-15).
- **Phase 40 [COMPLETE]** — Listing form and search cover all 31 provinces + Distrito Nacional; search price-ceiling fix; lead modal no longer opens over login/signup (2026-08-18).
- **Phase 41 [COMPLETE]** — API can start on a brand-new empty database (`bootstrap_db.py`); `user_code` sequence bug fixed and old rows backfilled (2026-08-18, 2026-09-14).
- **Phase 42 [COMPLETE]** — Real business phone/WhatsApp, buyer vs seller contact flows, share links with price and facts (2026-09-07).
- **Phase 43 [COMPLETE]** — Public `GET /stats/platform` drives homepage/login/signup stats; price formatters handle B/T (2026-09-07).
- **Phase 44 [COMPLETE]** — Branded 1200x630 share-preview image per listing, admin regenerate endpoints (2026-09-07).
- **Phase 45 [COMPLETE]** — Spanish paid-traffic landing page, Google Ads tag + form/WhatsApp conversions + click-id capture, privacy and terms pages (2026-09-09).
- **Phase 46 [COMPLETE]** — Zero-value listing icons hidden; sticky sidebar no longer collides with the Tidio bubble (2026-09-09/10).
- **Phase 47 [COMPLETE]** — Admin can reassign a submitted listing to another realtor (2026-09-10).
- **Phase 48 [COMPLETE]** — Admin CSV bulk import (Windows-1252 OK, `source_ref` dedup, currency, co-listing agent, `description_es`) for the Golden Castle co-listing inventory; Spanish descriptions render and are editable (2026-09-14/15).
- **Phase 49 [COMPLETE]** — Server-side pagination for public search, admin listings and "My Listings"; static-export `generateStaticParams` and sitemap fixed for the paginated API (2026-09-15).
- **Phase 50 [COMPLETE]** — Login sessions extended from 1 h to 24 h (2026-09-15).
- **Phase 51 [COMPLETE]** — `feature/paypal` merged into `dev`; double-booking rejected server-side (409) with UI handling; PayPal migrations made idempotent for production; PayPal UI switched on (2026-09-18).
- **Phase 52 [COMPLETE]** — Admin bookings list includes guest-request leads (2026-09-18).
- **Phase 53 [COMPLETE]** — Google Calendar appointment page accepted as an alternative to Calendly; one shared "connect scheduling / PayPal" reminder on every owner and realtor screen; lead-assigned email names the right provider (2026-09-18).

---

## Open Phases

### Phase 38 — PayPal Go-Live & Email Notifications *(code live; final confirmations outstanding)*

> **Update 2026-10-10:** On 2026-09-18 commit `90f3dce` records that the PayPal credentials are configured on Vercel and Railway, and the `PAYPAL_ENABLED` flags were turned on in both frontends. Items 3–4 below are therefore done; item 6 is automatic (Railway runs `alembic upgrade head` on start; current head `bc364345c64b`; the migration IDs in item 6 are stale). **Still to confirm by a human (not provable from the repo):** `PAYPAL_MODE` (code default is `sandbox`), Payouts API approval, webhook registration / `PAYPAL_WEBHOOK_ID`, and one real end-to-end booking + payout.

Original go-live checklist (kept for reference):

All code is complete and tested locally. Blocked on:

1. **PayPal Business account** — create at paypal.com/business; obtain sandbox credentials at developer.paypal.com → Apps & Credentials.
2. **PayPal Payouts API access** — submit the separate approval form (not auto-granted).
3. **Railway env vars** — `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE=sandbox`
4. **Vercel env var** — `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
5. **Register PayPal webhook URL** in the PayPal developer dashboard.
6. **Run `alembic upgrade head` on Railway** — applies migrations `o3p4q5r6s8t9`, `p4q5r6s7t8u9`, `q5r6s7t8u9v0`, `r6s7t8u9v0w1`, `s7t8u9v0w1x2`.

Email notifications implemented (Jul 2026):
- Guest: booking submitted (authorized, not charged), booking confirmed, booking declined
- Owner + Realtor: new booking request; Owner: payout released
- Admin: payout failure requiring manual action (cron + `settings.notify_email`)

---

### Phase 28 — Content Marketing Engine *(in progress, highest priority)*

Blog structure, 12 posts, and 3 ES translations are live.

- **9 ES translations** — mirror each into `ARTICLES_ES` + `CARDS_ES` in `blogData.es.ts`: `can-canadians-buy`, `property-taxes-ipi`, `las-terrenas`, `best-places-to-retire`, `dr-real-estate-safe`, `living-punta-cana`, `confotur-explained`, `dr-vs-miami`, `living-cabarete-sosua`
- **Staged posts (Weeks 2–4)** — 9 entries in `HIDDEN_GUIDES`; to publish move each into `GUIDES` and set a publish date.
- **Content calendar Weeks 5+** — financing for foreign buyers, pre-construction guide, neighborhood guides (Cap Cana, Santo Domingo, Samaná, Jarabacoa, Santiago), market updates, comparison + FAQ articles.
- **Newsletter signup** — `POST /public/newsletter` endpoint + wire the inert Blog and landing email inputs to it with success/error toast.
- **Dummy data** — replace placeholder hero stats and per-article `reads` counts with real or neutral values.
  - *Done 2026-10-10 (verified):* hero/login/signup stats are live (Phase 43) and `reads` are `'—'`. The ES translations (9), staged posts, calendar and newsletter above remain open.

---

### Phase 24 — Admin Site Settings *(partial — corrected 2026-10-10)*

> Already in place: `settings` table, `models/site_settings.py`, `GET`/`PUT /admin/settings` and a Platform-tab input, all for **`notify_email` only**. The rest of this section is still to do.

Persist platform config in a `settings` singleton table and wire the static Platform tab to it.

Fields: `contact_email`, `platform_name`, `deal_of_week_enabled`, `featured_listing_count`.

Backend: Alembic migration (`add_settings_table`), `models/settings.py`, `schemas/settings.py`, `GET /admin/settings`, `PUT /admin/settings` (upsert id=1). See `backend.md` for full schemas.

Frontend (`apps/dashboard/src/pages/admin/Settings.tsx`): Platform tab calls `GET` on mount, `PUT` on save, toast feedback.

> Build Phase 24 first — Phase 23's GHL settings tab extends the same `PlatformSettings` schema.

---

### Phase 23 — GoHighLevel CRM, phase 2 *(blocked on Phase 24)*

Two-way sync, HMAC webhook, and Leads GHL column are all live. One item remains:

- **Admin Settings GHL tab** — API key, location ID, enable/disable toggle; saved via `PUT /admin/settings`. Requires Phase 24.

---

### Phase 26 — Account Deactivation / Deletion *(partial)*

Done: `PUT /auth/me/deactivate`, `POST /auth/me/delete-request`, Danger Zone UI.

Remaining:
- **`POST /auth/me/delete-confirm`** — hard delete after 30-day grace; anonymize associated leads and listings.
- **Frontend redirect** — after `deactivateAccount()` succeeds, force logout and redirect to landing with `?msg=deactivated`.
  - *Update 2026-10-10:* the redirect code exists (`pages/Settings.tsx`); only polish remains (landing ignores `msg`; the landing URL is built via a fragile string replace — see `frontend.md`).

---

### Phase 27 — Tidio Live Chat *(partial, all external)*

Widget embedded; `GET /public/chat/listings` endpoint live. No code changes needed:

- Upgrade Tidio plan to whitelist the API-call domain.
- Build the Flow: quick replies (lead type + region) → API call → send `{{message}}`.
- Add `https://ilovedrrealty.com` to Lyro AI data sources after next production deploy.

---

### Security — Open Items (low / info)

Three findings remain. See `security.md` for full detail.

- **#29** — Localhost API fallback URLs — fail loudly if env var unset in production.
- **#30** — Google Maps API key + OAuth Client ID not restricted to production domain (GCP Console, manual).
- **#31** — ~~No `.env.example` files in `apps/landing/` or `apps/dashboard/`~~ — resolved 2026-10-10 (files created in the handover; commit them).

*Re-verified 2026-10-10: all three are still open. `realty-api/.env.example` does exist (API only).*
