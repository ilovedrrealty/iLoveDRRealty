# Infrastructure

Cross-cutting infrastructure that wires together the landing app, dashboard app, and FastAPI backend: HTTP clients, design tokens, shared navigation, layout shells, i18n, build/deploy configuration, and backend plumbing (configuration, database sessions, storage, rate limiting, background jobs, and migrations). For the big picture see [../ARCHITECTURE.md](../ARCHITECTURE.md); for variables see [../ENV.md](../ENV.md).

---

## Hosting and deploy configuration

| File | Repo | Purpose |
|------|------|---------|
| `apps/landing/next.config.ts` | realty | `output: 'export'` (static HTML in `out/`), `trailingSlash: true`, `images.unoptimized: true` |
| `apps/landing/vercel.json` | realty | Empty `{}`; Vercel auto-detects Next.js |
| `apps/dashboard/vercel.json` | realty | `outputDirectory: dist` and a rewrite of every path to `/index.html` (SPA routing) |
| `apps/dashboard/vite.config.ts` | realty | React plugin and the `@` -> `src` alias |
| `turbo.json` / root `package.json` | realty | Turborepo tasks `build`, `dev`, `preview`, `typecheck`; npm workspaces `apps/*`, `packages/*`; scripts `dev`, `build`, `dev:landing`, `dev:dashboard`, `build:landing`, `build:dashboard` |
| `Dockerfile` | realty-api | `python:3.11-slim`; installs `requirements.txt`; start: `python bootstrap_db.py && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| `railway.toml` | realty-api | Builder `DOCKERFILE`; health check `GET /health` (30 s); restart on failure, max 3 retries |
| `Procfile` | realty-api | Same start command as the Dockerfile (default port 8080); not used when Railway builds from the Dockerfile |
| `.env.example` | all three | Templates for local environment files |

No CI, deploy hooks, or GitHub Actions exist in either repo. Which branch each Vercel/Railway project deploys is configured in their dashboards.

---

### Landing App

#### `src/api/axios.ts`
Pre-configured Axios instance for the landing app. Reads `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:8000`), sets `Content-Type: application/json`, enables `withCredentials` so the `ildr_token` session cookie is sent cross-origin, and serialises array query params as repeated keys (`paramsSerializer: { indexes: null }`) to match FastAPI's `List[str]` parsing. All landing API modules import this singleton.

#### `src/i18n.ts`, `src/components/I18nProvider.tsx`, `src/components/EsLangSync.tsx`
`react-i18next` setup with 15 namespaces under `src/locales/{en,es}/`. The initial language is always `en`; `I18nProvider` switches to `localStorage.ildr_lang` after hydration. `EsLangSync` forces Spanish on the dedicated `/es/*` routes. Every namespace needs an EN and an ES file and must be registered in `i18n.ts`.

#### `src/lib/gtag.ts`, `src/lib/tracking.ts`, `src/components/TrackingCapture.tsx`
Google Ads tag ID and conversion helpers (`trackFormConversion`, `trackWhatsAppConversion`), plus capture of `gclid`/`gbraid`/`wbraid`/`utm_*` into `localStorage.ildr_ad_tracking` so they can be appended to a lead message. IDs are hard-coded constants.

#### `src/lib/features.ts` and `src/lib/constants.ts`
`PAYPAL_ENABLED` master switch for PayPal UI (mirrored in the dashboard), and `STANDALONE_PAGE_PATHS` (pages that render without Navbar/Footer, used by the Spanish ads landing page).

#### `src/hooks/useNav.ts`
Single navigation hook that wraps `next/navigation`'s `useRouter`. Returns a `go(page, slug?, params?)` helper that maps route keys (e.g. `'search'`, `'detail'`) to URL paths (`/<page>[/<slug>][?params]`; `'landing'` maps to `/`). Used by Navbar, Footer, and every page that needs client-side routing without hardcoded paths.

#### `src/design.ts`
Source of truth for brand tokens in the landing app. Exports the `c` color map, `fontSerif`/`fontSans` stacks (Fraunces / Mona Sans), and `NAV_ITEMS`, the ordered list of `[routeKey, label]` pairs consumed by Navbar. Any color or nav label change starts here.

#### `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/listing/[id]/page.tsx`
Build-time SEO plumbing, all `force-static`. `robots.ts` allows crawling only when `NEXT_PUBLIC_SITE_ENV === 'production'`. `sitemap.ts` and `generateStaticParams()` in the listing page both page through `GET {API}/listings?page=N&page_size=60&include_aggregates=false` to collect every active listing, so the API must be reachable at build time. `generateMetadata` builds OG/Twitter tags from the listing and its `share_image_url`.

#### `src/components/Navbar.tsx`
Sticky top navigation bar with responsive desktop/mobile layouts. Calls `getMe()` on mount to detect an active session; when logged in shows an avatar + `UserDropdown` (dashboard link + logout); when logged out shows Log in / Sign up buttons, and hosts the EN/ES toggle (persists `ildr_lang`). `DASHBOARD_URL` is derived from `NEXT_PUBLIC_DASHBOARD_URL` at build time (default `https://app.ilovedrrealty.com`). Exports `Logo` as a named export used elsewhere.

#### `src/components/Footer.tsx`
Site-wide footer rendered on every page except standalone pages. Contains two `NAV_GROUPS` (Discover, Company) whose buttons use `useNav` for client-side routing, plus the contact block and a WhatsApp link that fires the Google Ads WhatsApp conversion. Generates the copyright year dynamically.

---

### Dashboard App

#### `src/api/axios.ts`
Vite-side Axios singleton. Reads `VITE_API_URL` (falls back to `http://localhost:8000`) and enables `withCredentials`. Mirrors the landing client but uses `import.meta.env` rather than `process.env`. All dashboard API modules (`auth`, `admin`, `listings`, `leads`, `bookings`, `inquiries`, `savedHomes`, `upgradeRequests`) import this singleton.

#### `src/App.tsx`, `src/main.tsx`
`main.tsx` mounts `GoogleOAuthProvider` (`VITE_GOOGLE_CLIENT_ID`), `BrowserRouter`, the toast host, and imports `i18n`. `App.tsx` declares routes `/` and `/:view`; `DashboardPage` loads the user via `useCurrentUser()` (`GET /auth/me`), redirects to `<VITE_LANDING_URL>/login` when unauthenticated, and renders `AdminDash` for admins or `Dashboard` for everyone else inside `DashLayout`.

#### `src/i18n.ts`
`react-i18next` with 7 namespaces (`nav, common, admin, buyer, owner, realtor, settings`) from `src/locale/{en,es}/`. Language is read from `localStorage.ildr_lang` at load; `DashLayout` holds the toggle.

#### `src/api/admin.ts`
Full admin API layer. Exports typed interfaces and async functions covering: upgrade-request approval/rejection, listing CRUD + approve/reject/archive, listing-edit review, platform stats, activity log, user management (list, suspend, unsuspend, create, role, assign realtor), deal-request workflow, and per-listing history (`ListingEvent[]`). All calls go through the shared Axios client to `/admin/*` routes.

#### `src/api/upgradeRequests.ts`
User-facing upgrade-request API. Exports `submitUpgradeRequest` (POST `/upgrade-requests`) and `getMyUpgradeRequests` (GET `/upgrade-requests/me`). Pairs with `admin.ts` which handles the admin side of the same flow.

#### `src/layouts/DashLayout.tsx`
Root shell for the entire dashboard. Renders the dark sidebar (`bg-nav`) with role-aware navigation: Admin sees a flat list (home, users, listings, leads, bulk-import, bookings, settings); non-Admin users see a General section plus per-role sections (`Buyer`, `Owner`, `Realtor`) that are locked (with lock icon) when the user's role doesn't have access. Handles mobile drawer, role color theming (`ROLE_TONE`), user avatar/code display, the EN/ES toggle, and logout. `LANDING_URL` links the logo back to the marketing site.

#### `src/pages/Dashboard.tsx`
View router for non-admin users. Maintains an `activeTab` for the home overview (Buyer/Owner/Realtor sub-dashboards) and delegates all other view keys (`'saved'`, `'listings'`, `'leads'`, `'owner-bookings'`, `'realtor-bookings'`, `'earnings'`, `'pipeline'`, `'calendar'`, `'settings'`, `'upgrade'`, etc.) to the correct role-specific page component via a `switch`. Renders `SetupBanners` above owner/realtor screens and the page title from the role's `pages.<view>` locale keys.

#### `src/pages/AdminDash.tsx`
View router for Admin users. Thin shell that maps `view` strings to the admin sub-pages (`AdminHome`, `AdminUsers`, `AdminListings`, `AdminLeads`, `AdminBookings`, `Analytics`, `AdminSettings`, `BulkImportListings`) and renders the page title/subtitle header. Consumed by `App.tsx` when `role === 'Admin'`.

#### `src/lib/scheduling.ts`
Calendly / Google Calendar appointment-page helpers. Both are stored as a URL in `users.calendly_url`; the provider is inferred from the host. Exports provider labels/colors, `validateSchedulingUrl`, `schedulingProvider`, and `schedulingEmbedUrl` (null when the page cannot be iframed, e.g. `calendar.app.google` short links).

#### `src/lib/features.ts`
`PAYPAL_ENABLED` master switch for PayPal UI in the dashboard (payout email, release/request payout, listing-setup gate). Keep in step with the landing app's flag.

#### `src/components/RichTextEditor.tsx`
Tiptap-based rich-text editor shared across listing-submission forms. Accepts `value` (HTML string), `onChange`, and `tone` (brand color for active toolbar states). Supports Bold, Italic, H2, H3, bullet list, and ordered list. Syncs external value resets via a `useEffect` diff against `editor.getHTML()`.

#### `src/utils/phone.ts`
Phone number formatting utility wrapping `libphonenumber-js`. Exports `parsePhone(raw)` -> `{ formatted, country }` and the convenience `fmtPhone(raw)` -> string. Handles `+` prefix, 11-digit US numbers, and falls back to returning the raw string on parse failure.

#### `src/design.ts`
Dashboard brand token file. Identical color map to the landing `design.ts` but adds `sidebar: '#0D1B3E'` and uses `"Inter"` as the primary sans font (vs `"Mona Sans"` on the landing). Keep both files in sync when brand colors change (`packages/ui` is not imported by either app).

---

### Backend API

#### `config.py`
Pydantic `BaseSettings` class that loads all environment variables (`.env` in development, Railway variables in production; unknown variables ignored). Fields: `database_url` and `jwt_secret` (required), `resend_api_key`, `email_from`, `logo_url`, `notify_email`, `landing_url`, `allowed_origins` (comma-separated), `environment`, `cookie_domain`, `port` (unused), `supabase_url`/`supabase_service_key`/`storage_bucket`, `ghl_enabled`/`ghl_api_key`/`ghl_location_id`/`ghl_webhook_secret`, `paypal_mode`/`paypal_client_id`/`paypal_client_secret`/`paypal_webhook_id`, and `platform_fee_pct`. Exposes `origins_list` as a computed property. Single `settings` singleton imported everywhere. See [../ENV.md](../ENV.md).

#### `database.py`
SQLAlchemy setup: creates the `engine` from `settings.database_url` (default pool settings, no `pool_pre_ping`), a `SessionLocal` factory, and the `Base` declarative class that all models extend. Exports `get_db()` as a FastAPI dependency that yields a session and always closes it. All route files depend on this module.

#### `main.py`
FastAPI application entry point. Registers CORS (explicit origins only, raises `RuntimeError` on wildcard/empty), a security-header middleware (X-Frame-Options, nosniff, Referrer-Policy, HSTS in production), the SlowAPI rate-limit handler, and the routers `auth, listings, upgrade_requests, admin, leads, inquiries, saved_homes, bookings, chat, webhooks, stats`. A `lifespan` handler starts two in-process asyncio tasks: `_cleanup_pending_users` (hourly purge of expired email-verification rows) and `_payout_cron` (daily 00:01 UTC PayPal owner payouts for stays that ended the previous day). Also serves `GET /robots.txt` (disallow all) and `GET|POST /health` (plus `POST /`).

#### `bootstrap_db.py`
Runs before Alembic on every start. If the database has no tables at all it creates them from the SQLAlchemy models (`create_all`); if `alembic_version` exists or other tables exist it does nothing. Needed because no migration creates the core tables.

#### `alembic/env.py`
Alembic migration environment. Pulls `database_url` from `settings`, imports `models` (so all ORM tables register with `Base.metadata`), and configures both offline (literal SQL) and online (live connection, `NullPool`) migration modes. `alembic upgrade head` runs automatically on every deploy as part of the container start command.

#### `utils/storage.py`
Supabase Storage abstraction. Lazy-initialises a `supabase` client from `settings`. Exports `upload_image` (`{user_id}/{uuid}.ext`), `upload_avatar` (`avatars/{user_id}/{uuid}.ext`, deletes the previous avatar), `upload_pdf` (`documents/{user_id}/{uuid}.pdf`) and `upload_share_image` (`share/{listing_id}.jpg`, upsert). All return public URLs.

#### `utils/share_image.py`
Pillow renderer for the 1200x630 per-listing share-preview image (price, beds/baths, location baked over the first photo) using the Mona Sans fonts in `assets/fonts/`. Called when a listing is created, when share-relevant fields change, and by the admin regenerate endpoints.

#### `utils/email.py`
Resend wrapper and every email template (verification code, password reset/changed, listing approved/rejected, upgrade approved/rejected, lead alerts and assignment, booking and payout notifications). With no `RESEND_API_KEY` it only logs. All links are built from `settings.landing_url`.

#### `utils/ghl.py`
GoHighLevel client (`httpx`): `create_contact` (contact + note + follow-up task, reuses the existing contact on duplicate), and `update_contact_status` (adds `lead-new|assigned|contacted|closed` tags). No-ops unless `GHL_ENABLED` and `GHL_API_KEY` are set. `TAG_TO_STATUS` is used by the inbound webhook.

#### `services/paypal.py`
PayPal REST v2 client with an in-process OAuth token cache: create order (AUTHORIZE), authorize, capture, void, payouts, refund, and webhook signature verification. Base URL selected by `PAYPAL_MODE`.

#### `utils/bulk_import.py`
Admin CSV listing importer (Windows-1252 and UTF-8, `source_ref` de-duplication, photo download into Storage), run through FastAPI `BackgroundTasks` with progress in `bulk_import_jobs`.

#### `utils/jwt.py`, `utils/auth.py`, `utils/permission.py`, `utils/security.py`, `utils/verification.py`
`jwt.py` issues the 24 h HS256 session token. `auth.py` provides `get_current_user` / `get_optional_user` (cookie `ildr_token` or Bearer header; requires verified email and active status). `permission.py` provides `require_role(...)` and `require_admin`. `security.py` is the bcrypt (passlib) helper; `verification.py` generates 6-digit codes.

#### `utils/limiter.py`
SlowAPI `Limiter` singleton keyed on remote IP (`get_remote_address`), in-memory storage. Imported into `main.py` and used as a decorator on individual route handlers that need per-IP rate limiting.
