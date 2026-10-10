# Architecture

I Love DR Realty is a bilingual (EN/ES) real-estate marketplace for the Dominican Republic: public search and marketing site, a role-based dashboard for buyers, owners, realtors and admins, and a REST API. It also handles rental bookings with PayPal and syncs leads to a GoHighLevel CRM.

This document describes the system as implemented in code. Per-file detail is in [`codebase/`](codebase/), route-level API detail in [API.md](API.md), configuration in [ENV.md](ENV.md), workflow in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. Deployment topology

```
                         Browser
        ┌───────────────────┼─────────────────────────┐
        │                   │                         │
  ilovedrrealty.com   app.ilovedrrealty.com   api.ilovedrrealty.com
  Vercel (landing)    Vercel (dashboard)      Railway (FastAPI, Docker)
  Next.js static      Vite React SPA                  │
  export                    │                         │
        └──── axios, withCredentials, cookie ildr_token ──► API
                                                      │
              ┌────────────┬────────────┬─────────────┼───────────────┐
              ▼            ▼            ▼             ▼               ▼
        Supabase       Supabase      Resend       PayPal REST     GoHighLevel
        Postgres       Storage       (email)      (+ webhooks)    (+ webhook)
```

| Piece | Repo / path | Host | Notes |
|-------|-------------|------|-------|
| Landing site | `realty/apps/landing` | Vercel | Next.js 15, `output: 'export'`, `trailingSlash: true`, unoptimized images. Config in `next.config.ts`; `vercel.json` is empty (`{}`). |
| Dashboard | `realty/apps/dashboard` | Vercel project `dashboard` | Vite 5 + React 18 SPA. `vercel.json`: `outputDirectory: dist` and a catch-all rewrite to `/index.html` (client-side routing). Vercel project settings: framework `vite`, Node `24.x`. |
| API | `realty-api` | Railway | Built from `Dockerfile` (`railway.toml`: builder `DOCKERFILE`, health check `GET /health`, 30 s timeout, restart on failure, max 3 retries). One web process; background jobs run inside it. |
| Database | Supabase | Supabase | Used as managed **PostgreSQL only** (SQLAlchemy via `DATABASE_URL`). Supabase Auth and the Supabase data client are not used. |
| File storage | Supabase Storage | Supabase | One public bucket (`STORAGE_BUCKET`, default `listing-images`): listing photos `{user_id}/`, avatars `avatars/`, co-listing agreement PDFs `documents/`, generated share images `share/{listing_id}.jpg`. |
| Email | Resend | Resend | Sender `EMAIL_FROM` (`noreply@ilovedrrealty.com`); domain must be verified in Resend. |
| Source control | GitHub `iBlinkyxD/realty`, `iBlinkyxD/realty-api` | GitHub | Two repos. See CONTRIBUTING.md for the branch model. |

Domains: `ilovedrrealty.com` (landing), `app.ilovedrrealty.com` (dashboard), `api.ilovedrrealty.com` (API). The first two are hard-coded as fallbacks in the code; the API hostname is configured via the frontend env vars, so confirm it in the Railway domain settings. DNS provider and registrar are not recorded in the repos.

Because all three hosts share the registrable domain `ilovedrrealty.com`, the session cookie is set with `Domain=.ilovedrrealty.com` (`COOKIE_DOMAIN`) and is sent to the API from both frontends.

How deploys are triggered (git integration, which branch each Vercel/Railway project tracks, preview deployments) is **not defined in either repo** (no CI config, no deploy hooks). Confirm in the Vercel and Railway dashboards. See CONTRIBUTING.md.

---

## 2. Repositories

| Repo | Contents |
|------|----------|
| `realty/` | Turborepo + npm workspaces monorepo: `apps/landing`, `apps/dashboard`, `packages/ui` (`@ilovedr/ui`, design tokens). Tailwind v4 installed at the root. `turbo.json` defines `build`, `dev`, `preview`, `typecheck`. |
| `realty-api/` | FastAPI app, SQLAlchemy 2 models, Alembic migrations, `Dockerfile`, `railway.toml`, `Procfile`. |

`packages/ui` is **not imported** by either app; each app keeps its own copy of the tokens in `src/design.ts`. Brand token changes must be applied in both `design.ts` files (and `packages/ui/src/design.ts` if you want to keep it consistent).

`.claude/` (the team's Claude commands) is in `realty/.gitignore` and not version-controlled; `docs/` tracks only the handover set listed in `.gitignore`.

---

## 3. Landing app (`realty/apps/landing`)

**Next.js 15 App Router, fully static export** (`output: 'export'` → `out/`). There is no Node server at runtime: all dynamic behaviour is client-side axios calls to the API. Dev server: port 3000.

### Routes (`src/app/`)

| Path | Notes |
|------|-------|
| `/` | Home (`views/Landing.tsx`): featured/deal listings, real platform stats from `GET /stats/platform` |
| `/search` | Listing search with server-side pagination/filters, map sidebar (Google Maps) |
| `/detail?id=<uuid>` | Client-rendered property page; this is the URL the in-app navigation (`useNav`) uses, so it works for listings created after the last build |
| `/listing/[id]` | **Statically generated** property page for SEO and link previews (Open Graph, Twitter card, JSON-LD). Same `PropertyDetail` view |
| `/buying`, `/selling`, `/calculator`, `/team`, `/contact` | Marketing / tools. Contact has buy and sell forms |
| `/blog`, `/article/[slug]` | Blog; content is static TypeScript data (`src/data/blogData.ts`) |
| `/es/article/[slug]` | Spanish article pages (only for articles that have an entry in `blogData.es.ts`) |
| `/es/bienes-raices-republica-dominicana` | Standalone Spanish paid-traffic landing page; opts out of Navbar/Footer (`lib/constants.ts`) |
| `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password` | Auth pages (the dashboard has no login of its own) |
| `/privacy-policy`, `/terms-of-service`, 404 | Legal / not-found |
| `/robots.txt`, `/sitemap.xml` | Generated at build (`app/robots.ts`, `app/sitemap.ts`, both `force-static`) |

### Directory layout (`src/`)

`app/` route files (thin) · `views/` page components · `components/` (Navbar, Footer, providers, `LeadCaptureModal`, search sidebars) · `api/` axios modules (`axios.ts`, `auth`, `listings`, `bookings`, `inquiries`, `savedHomes`, `stats`) · `locales/{en,es}/*.json` · `i18n.ts` · `data/` static content (blog articles, team, marketing copy, listing types/formatters) · `lib/` (`gtag.ts`, `tracking.ts`, `features.ts`, `constants.ts`) · `hooks/` (`useNav`, `usePlatformStats`) · `design.ts` brand tokens.

### Static export and listing pages

- `app/listing/[id]/page.tsx` implements `generateStaticParams()` by paging `GET {API}/listings?page=N&page_size=60&include_aggregates=false` until `total` is reached, so the **API must be reachable and `NEXT_PUBLIC_API_URL` set during `next build`**. On any error it returns what it has (possibly zero ids) without failing the build.
- `generateMetadata` fetches each listing to produce title, description, canonical, OG/Twitter tags and uses the listing's generated `share_image_url` (cache-busted by `updated_at`).
- Listings approved **after** a build have no `/listing/<id>/` page and are absent from the sitemap until the landing site is rebuilt/redeployed. No rebuild trigger exists in either repo (no webhook from the API, no scheduled build). The client-rendered `/detail?id=` route does work for new listings.
- `app/sitemap.ts` builds the sitemap from static pages, published blog articles (EN + ES with hreflang alternates), the Spanish landing page, and all listings (same paginated fetch). Article slugs are static (`generateStaticParams` over `ARTICLES`).
- `app/robots.ts`: crawlers are allowed (and the sitemap advertised) **only if `NEXT_PUBLIC_SITE_ENV === 'production'`**; otherwise `Disallow: /`.

### Internationalisation (EN / ES)

- `react-i18next` on the client, 15 namespaces (`common, landing, auth, footer, search, buying, selling, contact, blog, team, calculator, not_found, verify, property_detail, lead_capture`), each with `locales/en/<ns>.json` and `locales/es/<ns>.json`. Both files must be updated together; `i18n.ts` imports every file explicitly, so a new namespace must be registered there too.
- Static HTML is always rendered in English (`<html lang="en">`, `lng: 'en'`). `I18nProvider` switches to the language saved in `localStorage.ildr_lang` after hydration. The Navbar toggle changes and persists the choice.
- Search-engine-visible Spanish content exists only on the dedicated `/es/...` routes. `EsLangSync` forces Spanish (and persists it) on those pages.
- Listings have `description` and `description_es`; the property page shows the Spanish one when the UI language is Spanish and one exists.

### SEO

Per-page `metadata`, canonical URLs, hreflang alternates (articles, Spanish landing), JSON-LD (`Product`/`Accommodation` on listings, `Article` + `FAQPage` on articles, `RealEstateAgent` on the Spanish page), a Google Search Console verification tag in the root layout, branded per-listing share images generated by the API.

### Third-party scripts and tracking (root `layout.tsx`)

- **Google Ads tag** (`gtag.js`, ID in `lib/gtag.ts`) loaded sitewide; conversion events `trackFormConversion` (contact and Spanish-page forms) and `trackWhatsAppConversion` (footer/Spanish page WhatsApp clicks). IDs are hard-coded in source.
- **Ad-source attribution** (`lib/tracking.ts`, `TrackingCapture`): `gclid`, `gbraid`, `wbraid` and `utm_*` are stored in `localStorage.ildr_ad_tracking` and appended as a `Referencia: ...` line to the lead message (the `leads` table has no tracking columns).
- **Tidio** chat widget script (`lazyOnload`), key hard-coded in the layout. The API exposes `GET /public/chat/listings` (rate-limited 30/min, returns up to 5 active listings plus a ready-to-send message) that appears designed for a chatbot flow; how Tidio calls it is configured in the Tidio dashboard, not in this repo.
- **Google Maps** (`@react-google-maps/api`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) on search and property pages.
- **Google OAuth** (`@react-oauth/google`) for sign-in/sign-up.
- **PayPal JS SDK** (`@paypal/react-paypal-js`) on rental listings, behind the `PAYPAL_ENABLED` constant in `lib/features.ts` (currently `true`).

---

## 4. Dashboard app (`realty/apps/dashboard`)

**Vite + React 18 SPA, React Router 7 (`BrowserRouter`).** Dev server: port 5174. Static bundle in `dist/`.

### Routing and auth

- `App.tsx` has just `/` and `/:view`; the `view` URL segment selects the screen (`/listings`, `/leads`, `/settings`, ...), unknown paths redirect to `/`. Query param `?openId=` deep-links into a record.
- There is no login page. On mount `useCurrentUser()` calls `GET /auth/me`; on any failure the browser is redirected to `<VITE_LANDING_URL>/login`. Logout calls `POST /auth/logout` then redirects to the landing login page.
- The user's `role` (`buyer|owner|realtor|admin`) decides the shell: `AdminDash` for admins, `Dashboard` for everyone else.
- `DashLayout` renders a role-aware sidebar. Non-admins always see Buyer, Owner and Realtor sections; sections the user's role cannot access show a lock and a `LockedView` upgrade prompt (`ROLE_ACCESS`: owner = buyer + owner, realtor = buyer + realtor, admin = all).

### Screens by role (`src/pages/`)

| Role | Views |
|------|-------|
| Buyer | `saved` (saved homes), `inquiries`, `bookings`, `calculator` (ROI), `resources`, `upgrade` (request owner/realtor access) |
| Owner | `listings`, `submit-listing` (rentals only), `calendar` (scheduling page embed), `owner-bookings`, `leads`, `earnings` |
| Realtor | `listings`, `submit-listing`, `leads`, `realtor-bookings`, `pipeline`, `calendar` |
| Admin | `home` (stats, activity, upgrade-request queue), `users`, `listings` (approve/reject/edit review/assign/deal-of-week), `leads` (assign/status), `bulk-import` (CSV), `bookings` (payouts), `analytics`, `settings` (notification email) |
| Everyone | `settings` (profile, avatar, password, Google link/unlink, Calendly/Google Calendar link, PayPal payout email, deactivate/delete request) |

`SetupBanners` reminds owners and realtors to connect a scheduling page and PayPal before adding listings; this gate is enforced in the frontend only.

### API client

`src/api/*.ts` modules over one axios instance (`api/axios.ts`: `baseURL = VITE_API_URL`, `withCredentials: true`). Modules: `auth, admin, listings, leads, bookings, inquiries, savedHomes, upgradeRequests`.

### Scheduling links

An owner/realtor stores a public booking URL in `users.calendly_url` (column name predates Google support). `lib/scheduling.ts` infers the provider from the host (`calendly.com` vs `calendar.google.com/.../appointments/` or `calendar.app.google`), validates the URL on connect, embeds it in an iframe when the provider allows framing (Calendly and long Google appointment URLs; Google `calendar.app.google` short links send `X-Frame-Options: SAMEORIGIN`, so they open in a new tab), and the API's "lead assigned" email names the right provider.

### i18n

`react-i18next`, 7 namespaces (`nav, common, admin, buyer, owner, realtor, settings`), files in `src/locale/{en,es}/*.json`, registered in `src/i18n.ts`. Language read from `localStorage.ildr_lang` at load (key shared with the landing site, but localStorage is per-origin so the two apps do not actually share the setting); toggle is in `DashLayout`. EN and ES files must be edited together.

---

## 5. API (`realty-api`)

**FastAPI 0.115, SQLAlchemy 2, Alembic, Pydantic v2, Python 3.11.** Entry point `main.py`; settings in `config.py` (`pydantic-settings`).

### Layout

| Path | Role |
|------|------|
| `main.py` | App, CORS, security-header middleware, rate-limit handler, router registration, background tasks, health |
| `config.py` / `database.py` | Settings singleton; engine, `SessionLocal`, `get_db` |
| `routes/` | `auth, listings, upgrade_requests, admin, leads, inquiries, saved_homes, bookings, chat, webhooks, stats` |
| `models/` | `User, PendingUser, Listing, ListingEdit, ListingEvent, UpgradeRequest, Inquiry, SavedHome, Booking, ActivityLog, DealRequest, Lead, SiteSettings (table settings), BulkImportJob` |
| `schemas/` | Pydantic request/response models |
| `utils/` | `auth` (current user from cookie/bearer), `permission` (`require_role`, `require_admin`), `jwt`, `security` (bcrypt), `verification`, `email` (Resend templates), `ghl`, `storage` (Supabase), `share_image` (Pillow), `bulk_import`, `limiter` (SlowAPI), `listing_constants` |
| `services/paypal.py` | PayPal REST v2 client |
| `dependencies/auth.py` | Re-exports the auth dependencies |
| `alembic/` | Migrations (`versions/`, 39 files) |
| `bootstrap_db.py` | Creates base tables on a completely empty database before Alembic runs |
| `seed.py` | Dev-only demo data (hard-coded password); never run it against production |
| `assets/fonts/` | Mona Sans fonts used for share images |

### Middleware and cross-cutting behaviour

- **CORS**: explicit origins from `ALLOWED_ORIGINS`, credentials on, methods `GET, POST, PUT, DELETE, OPTIONS`, headers `Content-Type, Authorization`. The process raises at startup if `*` or an empty origin is configured.
- **Security headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS when `ENVIRONMENT=production`.
- **Rate limiting**: SlowAPI, per-route decorators, in-memory storage keyed by client address (e.g. register 3/min, verify/login 10/min, forgot-password 3/min, `POST /leads` 3/min, image upload 20/min, chat 30/min).
- **Health**: `GET /health` (also `POST /health` and `POST /`) returns `{"status":"ok"}`; `GET /robots.txt` disallows everything. Railway's health check hits `/health`.
- **Interactive docs**: FastAPI's default `/docs` and `/openapi.json` are enabled.

### Background work (no queue, no worker process)

All of it runs inside the single web process:

| Job | Trigger | What it does |
|-----|---------|--------------|
| `_cleanup_pending_users` | `lifespan` task, every hour | Deletes expired `pending_users` rows |
| `_payout_cron` | `lifespan` task, daily at 00:01 UTC | Pays owners for bookings with `check_out == yesterday`, `status=confirmed`, `payment_status=captured`, `payout_status=pending`. Skipped when `PAYPAL_CLIENT_ID` is empty |
| Bulk CSV import | FastAPI `BackgroundTasks` after `POST /admin/listings/bulk-import` (returns 202 + job id) | Row-by-row import with photo download; progress in `bulk_import_jobs` |
| Share image generation | Synchronously in `POST /listings`, edits and admin regenerate endpoints | Pillow renders a 1200x630 card, uploads to Storage `share/{id}.jpg` |

### Startup and migrations

Container command (also the `Procfile`): `python bootstrap_db.py && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`. So **every deploy runs migrations automatically** before the server starts. `bootstrap_db.py` only acts on a database with no tables; if tables exist without `alembic_version` it leaves them alone. The migration chain does not contain the original core-table creation.

### Roles and permissions

Roles: `buyer` (default for every signup), `owner`, `realtor`, `admin`. Permission checks use `Depends(require_role(...))` / `require_admin`, and the role is read from the database on every request (the role inside the JWT is informational). Roles are granted by: admin approval of an upgrade request; admin assigning a `seller_interest` lead (promotes the submitter buyer → owner); or admin changing a user's role directly (`PUT /admin/users/{id}/role`).

Listing lifecycle: `pending_approval` → `active` | `rejected` (→ resubmitted to `pending_approval` on edit) → `archived`. Admin-created listings are `active` immediately. Owners may only submit rentals. Edits to an **active** listing by non-admins are queued as `listing_edits` and applied only when an admin approves; every step is recorded in `listing_events` and `activity_log`.

---

## 6. Authentication (as implemented)

- **Session**: one cookie `ildr_token`, an HS256 JWT signed with `JWT_SECRET`, 24 h lifetime (no refresh, no sliding expiry). `httpOnly`; in production `Secure` + `SameSite=None`, locally `SameSite=Lax`; `Domain` = `COOKIE_DOMAIN` (blank → host-only). The API also accepts `Authorization: Bearer <jwt>`.
- **Per-request check** (`utils/auth.get_current_user`): decode token → load user → require `email_verified` and `status == "active"` (suspended → 403).
- **Email signup**: `POST /auth/register` stores a `pending_users` row (bcrypt hash, 48 h TTL) and emails a **6-digit code** (valid 15 min, 5 attempts, 60 s resend cooldown). The landing `/verify` page takes the code (the email also has a `?email=&code=` link). `POST /auth/verify` creates the real `users` row and sets the cookie in one step.
- **Login**: `POST /auth/login` (bcrypt via passlib), sets the cookie. (`register` answers 409 for an already-registered email, so account existence is discoverable there.)
- **Google**: the browser obtains an OAuth access token (`useGoogleLogin`), sends it to `POST /auth/google`; the API calls Google's `userinfo` endpoint, requires a verified email, then finds by Google ID, or links to an existing account with the same email, or creates a password-less user (already verified). Accounts can link/unlink Google and set a password in Settings.
- **Password reset**: `POST /auth/forgot-password` stores a SHA-256 hash of a random token (1 h) and emails `<LANDING_URL>/reset-password?token=...`; `POST /auth/reset-password` consumes it and sends a "password changed" email.
- **Account lifecycle**: `PUT /auth/me/deactivate` suspends the account and clears the cookie; `POST /auth/me/delete-request` only records `deletion_requested_at` for an admin to act on.
- **Dashboard**: relies on the same cookie; no token handling in JS.

---

## 7. Integrations

| Service | Used for | Code | Config |
|---------|----------|------|--------|
| **Resend** | Verification codes, password reset/changed, listing approved/rejected, upgrade approved/rejected, lead alerts, lead-assigned, booking submitted/confirmed/declined, owner new-booking, payout released/failed/requested | `utils/email.py` | `RESEND_API_KEY`, `EMAIL_FROM`, `LOGO_URL`, `NOTIFY_EMAIL`, `LANDING_URL` |
| **Supabase** | Postgres + Storage (see section 1) | `database.py`, `utils/storage.py` | `DATABASE_URL`, `SUPABASE_*`, `STORAGE_BUCKET` |
| **PayPal** | Rental checkout (authorize), capture on owner acceptance, void on decline/cancel, owner payouts, webhooks | `services/paypal.py`, `routes/bookings.py`, `routes/webhooks.py`, `main.py` | `PAYPAL_*`, `PLATFORM_FEE_PCT`; frontend `NEXT_PUBLIC_PAYPAL_CLIENT_ID` |
| **GoHighLevel** | Outbound: each new lead becomes a GHL contact (with tags, a note and a follow-up task); status changes add `lead-new/assigned/contacted/closed` tags. Inbound: `POST /webhooks/ghl` maps those tags back to the lead status (the most advanced tag wins) | `utils/ghl.py`, `routes/webhooks.py` | `GHL_*` |
| **Google OAuth** | Sign-in, link account | `routes/auth.py` (server), `@react-oauth/google` (both apps) | `*_GOOGLE_CLIENT_ID` (frontends only; the API does not hold the client ID) |
| **Google Maps** | Search map, property location | `SearchMapSidebar.tsx`, `PropertyDetail.tsx` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| **Google Ads / Search Console** | Sitewide tag, form + WhatsApp conversions, gclid/UTM attribution; site verification meta tag | `lib/gtag.ts`, `lib/tracking.ts`, `layout.tsx` | Hard-coded IDs |
| **Tidio** | Live chat widget; `GET /public/chat/listings` for chatbot listing answers | `layout.tsx`, `routes/chat.py` | Hard-coded embed key; bot flows live in the Tidio dashboard |
| **Calendly / Google Calendar appointment pages** | A realtor's or owner's public booking page, shown in their dashboard Calendar, linked in assignment emails and in the "My agent" card. No API integration: just a stored URL | `lib/scheduling.ts`, `users.calendly_url`, `utils/email.py` | None |

PayPal webhook events handled: `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.FAILED` (update booking status), `CUSTOMER.DISPUTE.CREATED` (logged only). Signatures are verified through PayPal's verify-webhook-signature API; with `PAYPAL_WEBHOOK_ID` unset every call is rejected. GHL webhooks accept an HMAC-SHA256 `x-ghl-signature` or a `?key=` shared secret; with `GHL_WEBHOOK_SECRET` unset every call is rejected.

---

## 8. Key data flows

### 8.1 Listing submit → approve

1. A realtor (or an owner, rentals only) fills the dashboard submit form. Photos go to `POST /listings/upload-images` (type sniffed with `filetype`, ≤ 20 MB each, ≤ 25 files) → Supabase Storage → public URLs. Co-listing agreement PDFs use `POST /listings/upload-agreement` (realtor/admin).
2. `POST /listings` creates the listing as `pending_approval` (`active` if the submitter is an admin), writes a `submitted` event and generates the branded share image.
3. Admin reviews in Dashboard > Listings: `POST /admin/listings/{id}/approve` → `active`, event + activity log, **approval email** to the submitter; or `/reject` with a reason (emailed). Admins can also reassign a listing to another realtor and mark a listing as deal of the week.
4. Active listings appear in `GET /listings` (public search) and the client-side `/detail?id=` page immediately. The static `/listing/<id>/` page and sitemap entry appear only after the next landing build (section 3).
5. Later edits by a realtor/owner to an active listing create a `listing_edits` row; admin approves (fields applied, share image regenerated if needed) or rejects.

### 8.2 Lead capture → assignment → email

1. Visitor submits a form (global lead-capture modal, contact page, property inquiry, Spanish landing page) → `POST /leads` (optional auth; if logged in the lead is linked to the user; 3/min per IP). Ad attribution is appended to the message.
2. API stores a `leads` row (`status=new`), pushes a contact + note + follow-up task to GoHighLevel (synchronously within the request, 10 s timeout, errors stored in `ghl_sync_error` and never surfaced), and emails the notification address (`settings` table override, else `NOTIFY_EMAIL`).
3. **Assignment is manual**: an admin picks a realtor in Dashboard > Leads (`PUT /admin/leads/{id}/assign`). The lead becomes `assigned`, the realtor receives an email (naming their Calendly or Google Calendar page), the GHL contact gets the `lead-assigned` tag, and the submitter's "my agent" is set. For a `seller_interest` lead from a buyer, the buyer is promoted to owner and both parties get emails. (There is no automatic territory-based routing.)
4. The realtor advances the lead (`contacted`, `closed`; `PUT /realtor/leads/{id}/status`); each change tags the GHL contact. Tag changes made inside GHL flow back through `POST /webhooks/ghl`.

### 8.3 Guest booking → PayPal authorize → owner confirm → capture → payout

1. On a rental listing the property page shows unavailable ranges (`GET /bookings/unavailable/{listing_id}`) and blocks conflicting selections.
2. For a nightly-priced listing the PayPal button calls `POST /bookings/create-payment-auth` → API creates a PayPal order with `intent=AUTHORIZE` for `price_per_day × nights` and returns the order ID. The guest approves in the PayPal popup.
3. The form posts `POST /bookings` (works with or without an account; guests supply name/email). The API re-checks availability, **authorizes** the order, verifies currency/amount (voids and rejects on mismatch), creates a `bookings` row (`status=pending`, `payment_status=authorized`) and a `leads` row of type `booking` auto-assigned to the owner/submitter. It then creates the GHL contact and sends emails: internal lead alert, guest "request received", and owner/realtor "new booking". Monthly-only rentals or deployments without PayPal create only the lead record (no booking row, no payment).
4. The owner/realtor accepts or declines in Dashboard > Bookings. **Accept** (`PUT /bookings/{id}/accept`): locks the listing row, re-checks availability, **captures** the authorization, marks `confirmed`, emails the guest. **Decline** (or guest **cancel**): voids the authorization (guest never charged), marks `cancelled`, emails the guest. A guest cancelling after capture sets `needs_admin_review` (no automatic refund).
5. Payout: at 00:01 UTC the day after check-out, `_payout_cron` computes `fee = total × PLATFORM_FEE_PCT` and sends `total − fee` through the PayPal Payouts API to the listing's `owner_paypal_email`, else the owner's (or submitting realtor's) profile `paypal_email`. Result is `payout_status = paid | failed`, with an email to the owner or an alert to `NOTIFY_EMAIL`. Admins can retry via `POST /bookings/{id}/release-payout` (Release Payout in the admin bookings page); owners can ask admin to review via `request-payout`.
6. PayPal webhooks reconcile `payment_status` / `payout_status` independently of the above.

### 8.4 Registration → verified account → role upgrade

Signup/verify as in section 6 → every user starts as `buyer` → buyer files `POST /upgrade-requests` (owner or realtor, with licence/territory/bio fields for realtors) → admin approves from the admin Home screen (`/admin/upgrade-requests/{id}/approve`, which sets the role and emails the user; `pages/admin/UpgradeRequests.tsx` and `Approvals.tsx` exist but are not wired into the router) → the user's locked dashboard sections open on next load.

---

## 9. Cross-app communication

| From → To | Mechanism |
|-----------|-----------|
| Landing → Dashboard | Links and post-auth redirects built from `NEXT_PUBLIC_DASHBOARD_URL` |
| Dashboard → Landing | `VITE_LANDING_URL` (login redirect on unauthenticated, logout, public listing links) |
| Both frontends → API | axios with `withCredentials`; session via the shared-domain cookie |
| API → users | Resend emails whose links point at `LANDING_URL` |
| External → API | Webhooks: `POST /webhooks/paypal`, `POST /webhooks/ghl` |

---

## 10. Known gaps

Facts verified in code at the time of writing; not a prioritised backlog.

1. **Silent localhost fallbacks.** `NEXT_PUBLIC_API_URL` (landing: `api/axios.ts`, `listing/[id]/page.tsx`, `sitemap.ts`) and `VITE_API_URL` fall back to `http://localhost:8000`; `VITE_LANDING_URL` falls back to `http://localhost:3000` in `App.tsx` but to the production URL elsewhere. A build without the variables ships a broken bundle with no error, and a landing build with no reachable API yields zero listing pages and an empty listing sitemap without failing. API defaults `LANDING_URL` and `ALLOWED_ORIGINS` to localhost.
2. **No CI and no automated tests.** No `.github/` workflows in either repo, no test runner or test files, and no lint script (no ESLint config). The only checks are `tsc --noEmit` (`typecheck` script per app) and the production build.
3. **No monitoring or error tracking** (no Sentry or equivalent in either repo). Errors surface only in Railway/Vercel logs; several integrations swallow failures (GHL and email calls use bare `except: pass`; GHL errors use `print`).
4. **Landing needs a rebuild for new listings' static pages and sitemap**, and nothing triggers one (section 3).
5. **Broken links in emails.** Emails link to `<LANDING_URL>/dashboard` (lead alerts, lead-assigned, new booking, payout and owner emails) and the listing-approved email links to `<LANDING_URL>/property?id=<id>`. The landing app has neither route (the dashboard lives on its own domain; public listings are `/listing/<id>/`). Unless redirects are configured in Vercel (not in `vercel.json`), these links 404.
6. **Payout cron fragility.** It runs inside the web process on a single `date.today() - 1` match; a restart or deploy at 00:01 UTC skips that day and the booking is never picked up again automatically (only the admin Release Payout action recovers it). Running more than one API replica would run the job on each replica and could double-pay (no lock or idempotency check besides `sender_batch_id`).
7. **Rate limiter is in-memory and per-process**, keyed on `request.client` address; the container command has no `--proxy-headers` / `--forwarded-allow-ips`, so behind Railway's proxy the key may be the proxy address rather than the visitor (confirm in production).
8. **`POST /auth/google` accepts any Google access token** that returns a verified email from `userinfo`; it does not check the token's audience against the app's client ID.
9. **Static-export caveat for SEO i18n.** Initial HTML is English everywhere except the `/es/...` pages; Spanish UI strings are applied client-side after hydration.
10. **Duplicate design tokens**: `packages/ui` is unused; two `design.ts` copies must be kept in sync by hand. `PAYPAL_ENABLED` is likewise duplicated in both apps.
11. **Schema bootstrap.** Alembic history lacks the core-table creation; fresh databases rely on `bootstrap_db.py` (`create_all`) followed by migrations. `Procfile` and `Dockerfile` carry the same start command with different default ports (8080 vs 8000); `railway.toml` selects the Dockerfile.
12. **Lead status vocabulary.** Realtors may set `schedule`, which admins' endpoint, the dashboard status set and the GHL tag map (`new/assigned/contacted/closed`) do not recognise.
13. **Config drift.** `PORT` is declared in `config.py` but unused; `ENVIRONMENT` other than `production` disables HSTS and secure cookies.
14. **Secrets hygiene.** `docs/env_stuff.md` holds production secrets in plain text. That file is git-ignored (never committed), but in the previous maintainer's checkout it sits in a OneDrive-synced folder. Move those values into a password manager and delete the file.
15. **Seed script** (`seed.py`) contains a hard-coded demo password and writes users directly to `users`; it must never be run against production.
