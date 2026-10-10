# Security — Open Items

**Full audit history** (issues 1–31, all resolutions): `docs/archive/plan_v3/security.md` and `docs/archive/plan_v4/security.md`.

All 28 actionable findings have been resolved. 1 is won't-fix. 3 remain open (low / informational).

> Phase 28 (content) note: blog posts are static, developer-authored data and add no new attack surface. The article JSON-LD uses `dangerouslySetInnerHTML` only on trusted, in-repo content — keep it that way (never feed user input through it).

---

## Open Items

| # | Severity | Status | File / Location | Issue |
|---|----------|--------|-----------------|-------|
| 29 | LOW | [ ] | Multiple frontend files | Localhost fallback URLs (`?? 'http://localhost:8000'`) — if env var is unset in production, calls silently hit localhost and fail with no visible error |
| 30 | INFO | [ ] | Google Cloud Console (manual) | Google Maps API key and OAuth Client ID not restricted to production domain — any site can embed the DR Realty map key |
| 31 | INFO | [ ] | `apps/landing/`, `apps/dashboard/` | No `.env.example` files — required env vars are undocumented for new deployments |

### Re-verification — 2026-10-10

All three items were re-checked against the code and remain open:

- **#29** — still present in `apps/landing/src/api/axios.ts`, `apps/landing/src/app/listing/[id]/page.tsx`, `apps/landing/src/app/sitemap.ts` (`NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'`), `apps/dashboard/src/api/axios.ts` (`VITE_API_URL ?? 'http://localhost:8000'`) and `apps/dashboard/src/App.tsx` (`VITE_LANDING_URL ?? 'http://localhost:3000'`). The two landing build-time uses matter more since Phase 49: `generateStaticParams()` and the sitemap fetch the API during `next build`, so an unset `NEXT_PUBLIC_API_URL` would silently produce a build with no listing pages or sitemap entries (or fail the export) rather than a visible error.
- **#30** — GCP console setting; cannot be verified from the repo. Treat as open until someone checks the key restrictions.
- **#31** — no `.env.example` under `apps/landing/` or `apps/dashboard/`. (`realty-api/.env.example` exists and already documents the DB, JWT, Resend, GHL, PayPal, `NOTIFY_EMAIL` and `PLATFORM_FEE_PCT` variables.) The frontend example for landing should also list `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, which the template under #31 below does not yet include. Both frontend apps have a local `.env` that is git-ignored.

### Informational notes on work shipped Jul–Sep 2026 (no new open findings)

- **Session lifetime** raised from 1 h to 24 h (`utils/jwt.py`, cookie `max_age` follows). Longer-lived cookie tokens widen the window for a stolen session; there is no server-side revocation beyond expiry. Accepted trade-off for fewer forced logouts.
- **Bulk import** (`utils/bulk_import.py`): server-side photo downloads are guarded against private / loopback / link-local addresses and capped at 20 MB; the endpoints are admin-only.
- **Share images** (`utils/share_image.py`): source photos are fetched only over https from the configured Supabase host, without following redirects.
- **`GET /stats/platform`** is unauthenticated and returns only aggregate counts and total listed value.
- **Ad tracking** (`lib/tracking.ts`): click IDs and UTM parameters are kept in localStorage and appended to lead messages; no PII is stored there. The Google Ads tag ID is a public identifier.
- **PayPal**: `PAYPAL_MODE` defaults to `sandbox` in `config.py`; confirm the production value (see `overview.md`, Phase 38).

---

## Issue Detail

### #29 — Localhost fallback URLs in frontend source
**Files:** `apps/landing/src/api/*.ts`, `apps/dashboard/src/api/*.ts`, `App.tsx`
Pattern: `const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`. If Vercel deploys without the env var set, all API calls silently go to `localhost:8000`, causing a blank-page failure with no clear error.
**Fix:** replace the fallback with an explicit throw (`if (!...) throw new Error('VITE_API_URL is not set')`), or add a CI check that required env vars are present before build. Best done alongside #31.

### #30 — Google API key not domain-restricted (manual, GCP)
Any third-party site can use the DR Realty Maps key / OAuth Client ID, running up quota or cost.
**Fix (Google Cloud Console):** Maps JavaScript API key → HTTP-referrer restriction to `ilovedrrealty.com/*` + `www.ilovedrrealty.com/*`; OAuth 2.0 Client ID → restrict Authorized JavaScript origins to prod + dev domains. No code changes.

### #31 — No `.env.example` files — RESOLVED 2026-10-10
`apps/landing/.env.example` and `apps/dashboard/.env.example` now exist (including `NEXT_PUBLIC_PAYPAL_CLIENT_ID`), and `realty-api/.env.example` was refreshed to list every variable in `config.py`. The text below is the original finding.
Create `apps/landing/.env.example`:
```
NEXT_PUBLIC_API_URL=https://api.ilovedrrealty.com
NEXT_PUBLIC_DASHBOARD_URL=https://app.ilovedrrealty.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_ENV=production
```
Create `apps/dashboard/.env.example`:
```
VITE_API_URL=https://api.ilovedrrealty.com
VITE_LANDING_URL=https://ilovedrrealty.com
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
