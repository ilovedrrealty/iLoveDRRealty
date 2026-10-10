# Environment Variables

Complete reference for every environment variable the code actually reads, across the three deployables. Verified against the source: `realty-api/config.py` (the only place the API reads env vars; there are no direct `os.getenv` calls), `process.env.*` in `apps/landing`, and `import.meta.env.*` in `apps/dashboard`.

| Deployable | Repo path | Hosted on | Where variables are set |
|------------|-----------|-----------|-------------------------|
| Landing (Next.js static export) | `realty/apps/landing` | Vercel (project 1) | Vercel > Project > Settings > Environment Variables |
| Dashboard (Vite SPA) | `realty/apps/dashboard` | Vercel (project 2, name `dashboard`) | Vercel > Project > Settings > Environment Variables |
| API (FastAPI) | `realty-api` | Railway | Railway > Service > Variables |

Each deployable has a committed template: `apps/landing/.env.example`, `apps/dashboard/.env.example`, `realty-api/.env.example`. Copy to `.env` for local work (`.env` is git-ignored; `.env.example` is not).

## Secrets handling

- Real secret values are **never committed** and are not stored in this documentation. They are shared out-of-band through the team password manager. Only non-secret URLs/domains appear below.
- **Frontend variables are public.** Anything prefixed `NEXT_PUBLIC_` or `VITE_` is inlined into the JavaScript bundle at build time and visible to every visitor. Never put a secret in one. (The PayPal *client ID*, Google *client ID* and Maps key are public by design; restrict the Maps key by HTTP referrer in Google Cloud.)
- **Frontend variables are build-time.** Changing one in Vercel has no effect until the project is redeployed (rebuilt). The API reads its variables at process start, so a Railway variable change needs a restart/redeploy.
- Rotate any key immediately if it is ever exposed. Do not keep plaintext secret files inside synced or shared folders.

---

## Landing (`apps/landing/`) — Vercel

Read via `process.env.NEXT_PUBLIC_*`. Because the site is a static export, these are baked in at `next build`, and `NEXT_PUBLIC_API_URL` is also used **during the build** by `generateStaticParams()` (`src/app/listing/[id]/page.tsx`) and `src/app/sitemap.ts` to fetch every active listing.

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Falls back to `http://localhost:8000`. In a production build this silently bakes localhost into the bundle, and the build-time listing fetch fails quietly: no `/listing/<id>/` pages and no listing URLs in the sitemap. | Base URL of the API (axios client `src/api/axios.ts`, listing page SSG + metadata, sitemap). | `https://api.ilovedrrealty.com` (confirm against the Railway custom domain) |
| `NEXT_PUBLIC_DASHBOARD_URL` | Yes | Falls back to `https://app.ilovedrrealty.com`. | Dashboard URL for Navbar links and post-login / post-signup / post-verify redirects (`Navbar.tsx`, `Login.tsx`, `Signup.tsx`, `Verify.tsx`). | `https://app.ilovedrrealty.com` |
| `NEXT_PUBLIC_SITE_ENV` | Yes (production only) | Anything other than the exact string `production` makes `robots.txt` emit `Disallow: /` for all crawlers. | Gates indexing: `production` allows crawling and advertises the sitemap (`src/app/robots.ts`). | `production` on the production Vercel environment only |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes, for Google sign-in | Empty string; the Google login/signup buttons fail. | Google OAuth 2.0 Web client ID (`GoogleAuthProvider.tsx`). Same client ID as the dashboard's. | Public ID; see password manager / Google Cloud console |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes, for maps | Empty string; the search map and property map render a "missing key" placeholder. | Google Maps JavaScript API key (`SearchMapSidebar.tsx`, `PropertyDetail.tsx`). | Public key; restrict by referrer |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Yes, for PayPal checkout | Empty string. PayPal UI is only active when the `PAYPAL_ENABLED` constant in `src/lib/features.ts` is `true` (it currently is); with an empty ID the checkout cannot load. | PayPal REST app client ID for the JS SDK on rental listings (`PropertyDetail.tsx`). Must be the same PayPal app/mode as `PAYPAL_CLIENT_ID` on the API. | Sandbox vs live: confirm in Vercel; must match `PAYPAL_MODE` |

Hard-coded in source (not environment variables; changing them needs a code change): the Google Ads tag/conversion IDs (`src/lib/gtag.ts`), the Tidio chat embed key (`src/app/layout.tsx`), the Google Search Console verification token (`layout.tsx` metadata), `metadataBase` / canonical URLs / sitemap base `https://ilovedrrealty.com`, and the `PAYPAL_ENABLED` flag.

---

## Dashboard (`apps/dashboard/`) — Vercel

Read via `import.meta.env.VITE_*`; inlined by Vite at `vite build`.

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `VITE_API_URL` | **Yes** | Falls back to `http://localhost:8000`; every API call in production would fail. | Base URL of the API (`src/api/axios.ts`, `withCredentials: true`). | `https://api.ilovedrrealty.com` (confirm) |
| `VITE_LANDING_URL` | **Yes** | Inconsistent fallbacks: `App.tsx` falls back to `http://localhost:3000`; `DashLayout.tsx`, `BuyerHome.tsx`, `LeadDetailPanel.tsx` and the buyer pages fall back to `https://ilovedrrealty.com`. | The dashboard has no login screen. Unauthenticated users and logout are redirected to `<VITE_LANDING_URL>/login`; also used for the logo link and links to public listings. | `https://ilovedrrealty.com` |
| `VITE_GOOGLE_CLIENT_ID` | Yes, for Google link/unlink in Settings | Empty string; Google linking fails. | Google OAuth 2.0 Web client ID (`main.tsx`, `pages/Settings.tsx`, `pages/admin/Settings.tsx`). | Same ID as the landing app's |

Hard-coded: the dashboard's `PAYPAL_ENABLED` flag (`src/lib/features.ts`) must be kept in step with the landing app's.

---

## API (`realty-api/`) — Railway

Defined in `config.py` (`pydantic-settings`, loads `.env` locally, real environment in Railway; names are case-insensitive; unknown variables are ignored). Server-side only.

### Core

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `DATABASE_URL` | **Yes** | No default; the app fails at import. | SQLAlchemy engine, Alembic and `bootstrap_db.py`. Supabase Postgres connection string in production. | Secret (contains password) |
| `JWT_SECRET` | **Yes** | No default; the app fails at import. | Signs/verifies the app's own HS256 session JWT (`ildr_token`, 24 h). Not a Supabase JWT secret. Changing it logs everyone out. | Secret |
| `ENVIRONMENT` | Yes (prod) | `development`. | `production` enables Secure + `SameSite=None` cookies and the `Strict-Transport-Security` header. Any other value gives non-secure `SameSite=Lax` cookies and no HSTS, which is only appropriate for local dev. | `production` |
| `ALLOWED_ORIGINS` | **Yes** | `http://localhost:3000,http://localhost:5174`. The app refuses to start if any entry is `*` or empty. | Comma-separated CORS allow-list (credentials enabled). Must list both frontends. | `https://ilovedrrealty.com,https://app.ilovedrrealty.com` |
| `COOKIE_DOMAIN` | **Yes** (prod) | Empty = host-only cookie. | Domain attribute of the `ildr_token` cookie. Must be the parent domain so the landing site and the dashboard share the session. | `.ilovedrrealty.com` |
| `LANDING_URL` | **Yes** | `http://localhost:3000`. | Base URL used in every email link (verify, reset password, listing, dashboard) and in GoHighLevel notes; also the chat endpoint's search links. | `https://ilovedrrealty.com` |
| `PORT` | No | Defined in `config.py` but **never read** by the code. Uvicorn takes `$PORT` from the shell (`CMD` in the `Dockerfile`; falls back to 8000). Railway injects it. | Listening port. | Set by Railway |

### Email (Resend)

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `RESEND_API_KEY` | **Yes** (prod) | Empty: nothing is sent. The log shows `[DEV] Email to <addr>: <subject>`, and for signups the 6-digit code. Users cannot verify their email without a working key. | Resend API key. | Secret |
| `EMAIL_FROM` | Yes | `noreply@ilovedrrealty.com`. Domain must be verified in Resend. | From address of all emails. | `noreply@ilovedrrealty.com` |
| `LOGO_URL` | No | Falls back to `<LANDING_URL>/iLoveDRRealty_White.png`. | Logo in email headers (use an absolute CDN URL). | Optional |
| `NOTIFY_EMAIL` | Recommended | Empty: new-lead alerts and payout-failure alerts are not sent. An admin can override the lead-alert address at runtime (Admin > Settings; stored in the `settings` table), which takes precedence for lead alerts. | Internal inbox for lead and payout-failure alerts. | `ilovedrrealty@gmail.com` per the comment in `config.py`; confirm in Railway |

### Supabase (Storage only)

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `SUPABASE_URL` | **Yes** (uploads) | Empty: any image/avatar/PDF/share-image upload raises "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set". | Supabase project URL (`utils/storage.py`). | `https://<project-ref>.supabase.co` (see Supabase dashboard) |
| `SUPABASE_SERVICE_KEY` | **Yes** (uploads) | As above. | Service-role key used server-side for Storage. Bypasses RLS. | Secret |
| `STORAGE_BUCKET` | No | `listing-images`. Bucket must exist and be public-read (public URLs are stored in the DB). | Bucket for listing photos, avatars (`avatars/`), PDFs (`documents/`) and share images (`share/`). | `listing-images` |

The API does not use Supabase Auth or the Supabase client for data; Supabase is used as managed Postgres (via `DATABASE_URL`) plus Storage. The old `SUPABASE_ANON_KEY` is not read anywhere.

### GoHighLevel (CRM)

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `GHL_ENABLED` | No | `false`: outbound sync is a silent no-op. | Master switch for pushing leads to GHL and tagging status changes. | `true` if the sync is live; confirm in Railway |
| `GHL_API_KEY` | If enabled | Empty: no sync. | GHL Private Integration token (Bearer). | Secret |
| `GHL_LOCATION_ID` | If enabled | Empty. | GHL sub-account ID; sent on contact creation and used to build "Open in GHL" links in the dashboard. | Not a credential, but keep in the password manager |
| `GHL_WEBHOOK_SECRET` | If using the webhook | Empty: **every** inbound `POST /webhooks/ghl` is rejected with 401. | Authenticates GHL to us: HMAC-SHA256 in `x-ghl-signature`, or `?key=<secret>` on the URL (Workflow webhooks). | Secret |

### PayPal

| Name | Required? | Default / behaviour if unset | Purpose | Production value (non-secret) |
|------|-----------|------------------------------|---------|-------------------------------|
| `PAYPAL_MODE` | Yes (prod) | `sandbox`. | `sandbox` or `live`; selects `api-m.sandbox.paypal.com` vs `api-m.paypal.com`. Must match the app credentials and the frontend client ID. | `live` for real money; confirm in Railway |
| `PAYPAL_CLIENT_ID` | For payments | Empty: `POST /bookings/create-payment-auth` returns 503, payment auth/capture/void are skipped, and the daily payout job is skipped. | PayPal REST app client ID. | Public ID |
| `PAYPAL_CLIENT_SECRET` | For payments | Empty: PayPal calls raise. | PayPal REST app secret. | Secret |
| `PAYPAL_WEBHOOK_ID` | For webhooks | Empty: **every** inbound `POST /webhooks/paypal` is rejected with 401. | ID of the webhook registered in the PayPal developer dashboard; used for server-side signature verification. | Webhook ID (from PayPal dashboard) |
| `PLATFORM_FEE_PCT` | No | `0.20` (a fraction, not a percent). | Platform cut deducted from the booking total before the owner payout. | `0.20` |

---

## Environment files by context

| Context | Landing | Dashboard | API |
|---------|---------|-----------|-----|
| Local dev | `apps/landing/.env` | `apps/dashboard/.env` | `realty-api/.env` |
| Production | Vercel project env vars | Vercel project env vars | Railway service variables |
| Template | `apps/landing/.env.example` | `apps/dashboard/.env.example` | `realty-api/.env.example` |

Preview deployments on Vercel use the "Preview" environment variable scope; whether previews are enabled and which values they use must be checked in the Vercel dashboard. Remember that `NEXT_PUBLIC_SITE_ENV=production` should only be set for the Production scope, otherwise previews would be indexable.

## Local development quick setup

1. `realty-api/.env`: set `DATABASE_URL` (local Postgres) and `JWT_SECRET`; the rest can stay blank or default. With `RESEND_API_KEY` empty, the signup verification code is printed in the API console.
2. `apps/landing/.env`: `NEXT_PUBLIC_API_URL=http://localhost:8000`, `NEXT_PUBLIC_DASHBOARD_URL=http://localhost:5174`.
3. `apps/dashboard/.env`: `VITE_API_URL=http://localhost:8000`, `VITE_LANDING_URL=http://localhost:3000`.
4. Local cookies: leave `COOKIE_DOMAIN` empty and `ENVIRONMENT=development` (cookies are `SameSite=Lax`, non-secure). `localhost:3000`, `localhost:5174` and `localhost:8000` count as the same site, so the session works across ports.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete setup.

## Deployment checklist: variables to verify when creating an environment

- API: `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT=production`, `ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, `LANDING_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PAYPAL_*`, `GHL_*`.
- Landing (set **before** the build): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_SITE_ENV=production`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`. The API must be reachable from Vercel's build servers during the build.
- Dashboard: `VITE_API_URL`, `VITE_LANDING_URL`, `VITE_GOOGLE_CLIENT_ID`.
- Google Cloud: the OAuth client's authorized JavaScript origins must include both frontend origins.
- Third-party consoles to point at the API: PayPal webhook -> `https://<api-domain>/webhooks/paypal`; GoHighLevel workflow/webhook -> `https://<api-domain>/webhooks/ghl` (with `?key=<GHL_WEBHOOK_SECRET>` or an HMAC signature).
