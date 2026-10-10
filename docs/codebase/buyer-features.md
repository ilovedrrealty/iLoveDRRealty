# Buyer Features

The default role for a new account is `buyer`. A buyer can browse the public listing search on the landing site, save listings, send property inquiries, and request rental bookings. Actions are started on the landing site (`apps/landing`, Next.js 15) and reviewed in the dashboard (`apps/dashboard`, Vite + React). Both apps talk to the FastAPI backend (`realty-api`) with a cookie session (`ildr_token`, `withCredentials: true`); there is no Supabase client auth in the browser.

The three buyer actions escalate in commitment:

| Action | What it does | Backend record | Notifies |
|---|---|---|---|
| Save a home | Passive bookmark, heart on search cards | `saved_homes` row | Nobody |
| Inquiry | Message tied to a listing, sent from the listing page | **`leads` row** (`type=property_inquiry`) via `POST /leads` | Notify email + GHL contact; see [leads.md](leads.md) |
| Booking | Request (optionally pre-paid via PayPal) to stay at a `rent` listing | `bookings` row and/or `leads` row (`type=booking`) | Guest, owner, notify email. Full detail in [bookings-payments.md](bookings-payments.md) |

A buyer who owns property or practices as a realtor uses the Upgrade page in the dashboard: a "List My Property" form (submits a `seller_interest` lead) and a "Realtor Application" modal (submits an upgrade request for admin approval). Until an admin acts, the buyer sees only their own activity. The landing marketing pages (`Buying`, `Selling`, `Calculator`, `Contact`, and the Spanish landing page) educate visitors and push them to search or the contact form; of these only the contact-style forms write data (leads).

---

## Landing App

The landing app is a Next.js 15 site (App Router pages in `src/app/**` are thin wrappers that set metadata and render a client view from `src/views/**`). Its axios client (`src/api/axios.ts`) uses `NEXT_PUBLIC_API_URL`, sends cookies, and serializes array params as repeated keys. Buyer-facing API modules are thin: only the mutations a visitor can trigger plus the public availability read. A buyer's own history is read in the dashboard. UI copy is i18n (`src/locales/{en,es}/*.json`, one namespace per page; `I18nProvider`).

### `src/api/bookings.ts`

Exports `createBooking` (`POST /bookings`, returns void), `createPaymentAuth` (`POST /bookings/create-payment-auth`, returns the PayPal order id) and `getUnavailableDates` (`GET /bookings/unavailable/{listingId}`). The `BookingCreate` payload carries guest `name`/`email`/`phone` and optional `paypal_order_id` in addition to listing, dates, guests, notes. It is used only by `src/views/PropertyDetail.tsx`. Full flow, pricing, and PayPal behavior: [bookings-payments.md](bookings-payments.md).

### `src/api/savedHomes.ts`

Exports `getMySavedIds()` (`GET /saved-homes/mine`, mapped to `listing_id[]`), `saveHome(listingId)` (`POST /saved-homes/:id`) and `unsaveHome(listingId)` (`DELETE`). Only `src/views/Search.tsx` uses it: on mount it fetches saved ids (a 401 is swallowed and the visitor is treated as logged out), and the heart on each `PropertyCard` toggles optimistically, rolling back on error. A logged-out click calls `go('login')`. `PropertyDetail.tsx` has no save button. The dashboard has its own `savedHomes.ts` returning the richer `SavedHome[]`.

### `src/api/inquiries.ts`

Two functions, both writing to **`POST /leads`** (not `/inquiries`):

- `submitInquiry(data)` sends `type: 'property_inquiry'` with `property_id: data.listing_id`, name, email, phone, message. Called by the inquiry form in the sidebar of `src/views/PropertyDetail.tsx`; failures are swallowed and the form stays open.
- `submitContactLead(data)` sends `buyer_interest` or `seller_interest` (from the `tab`), with the chosen interest prepended to the message (truncated to 2000 chars). Called by `src/views/Contact.tsx` and `src/views/SpanishLandingPage.tsx`.

`POST /leads` is rate-limited to 3 requests/minute per client and attaches `from_user_id` when the visitor is logged in. See [leads.md](leads.md) for the pipeline.

### `src/views/Buying.tsx` and `src/views/Selling.tsx`

Client components (`'use client'`) rendered by `src/app/buying/page.tsx` and `src/app/selling/page.tsx` (which add SEO metadata). No API calls and no state beyond `useNav`. Copy comes from the `buying` / `selling` i18n namespaces; `src/data/buyingData.ts` and `src/data/sellingData.ts` only supply icon paths, the hero background URL, and (for Selling) the REACH stats. Buying CTAs go to `search` and `contact`; every Selling CTA goes to `contact` with `{ type: 'sell' }` so the contact form opens on the seller tab. An inline `Icon` helper renders SVG paths from the data files.

### `src/views/Calculator.tsx`

Client component at `src/app/calculator/page.tsx`; no API calls. Holds 17 `useState` inputs (`scenario` rent/vacation/flip, `price`, `downPct`, `closingPct`, `reno`, `rate`, `term`, `financing` mortgage/cash/hard/seller, `rent`, `occupancy`, `rentGrowth`, `propTaxPct`, `mgmtPct`, `maintPct`, `insPct`, `confoturYrs`, `appRate`). `setScenarioMode` resets rent/occupancy/reno defaults when the scenario changes. Outputs come from one `useMemo` whose dependency list is those inputs plus the i18n `t`. The flip scenario yields its own KPI set (profit, ROI, hold, resale) with no chart; rent and vacation yield KPI cards, a 5-year bar chart built from `<div>`s, a break-even bar, and a four-row scenario comparison (current, all-cash, leverage, CONFOTUR). Bottom CTAs go to `contact` and `search`. The listing page also links here (`sidebar.analyze`).

### Contact, Spanish pages, and shared pieces

- `src/views/Contact.tsx` (`/contact`): buyer/seller tab form that calls `submitContactLead`.
- `src/views/SpanishLandingPage.tsx` rendered by `src/app/es/bienes-raices-republica-dominicana/page.tsx` (es-DO metadata, `RealEstateAgent` JSON-LD, canonical/hreflang pointing at `/buying/` for English): lead form with buyer/seller intent that calls `submitContactLead`, plus WhatsApp and form conversion tracking (`src/lib/gtag.ts`, `src/lib/tracking.ts` adds a tracking reference line to the message). `src/app/es/article/[slug]/page.tsx` serves Spanish blog articles (`src/data/blogData.es.ts`).
- `src/components/EsLangSync.tsx`: used by `/es/*` routes to switch client i18n to Spanish and persist `ildr_lang` in localStorage.
- `src/components/LeadCaptureModal.tsx` / `LeadCaptureProvider.tsx`: site-wide buyer/seller capture popup (see [leads.md](leads.md)).

---

## Dashboard App

The dashboard is a Vite + React SPA (paths below are under `apps/dashboard/`). Its axios client (`src/api/axios.ts`) uses `VITE_API_URL` with `withCredentials: true`, so it authenticates with the same `ildr_token` cookie the API sets; no auth headers are injected. Routing is `/:view` (`src/App.tsx`), and `src/pages/Dashboard.tsx` switches on the view key (`saved`, `inquiries`, `calculator`, `resources`, `bookings`, `upgrade`; nav entries in `src/layouts/DashLayout.tsx`). Owners, realtors and admins also get the Buyer tab (`ROLE_ACCESS` in `Dashboard.tsx`), so these pages are not buyer-only. Shared `Card`, `CardLink`, `StatusPill`, `fmtPrice` live in `src/components/dashboard/shared.tsx`. Strings use the i18n namespace `buyer`.

### `src/api/bookings.ts`

Superset of the landing module with the full `Booking` type (listing metadata, guest contact, payment and payout fields). Buyers use only `getMyBookings` (`GET /bookings/mine`) and `cancelBooking` (`PUT /bookings/:id/cancel`); `getOwnerBookings`/`getRealtorBookings` (both `GET /bookings/for-owner`), `acceptBooking`, `declineBooking`, `releasePayout`, `requestPayout`, `getAdminBookings` serve other roles. Its `createBooking` is unused. Details: [bookings-payments.md](bookings-payments.md).

### `src/api/savedHomes.ts`

`getMySavedHomes()` (`GET /saved-homes/mine`, returns the full `SavedHome[]` snapshot: title, location, price, `listing_transaction`, images, beds, baths, `saved_at`), `saveHome`, `unsaveHome`. Used by `pages/buyer/SavedHomes.tsx` and the `BuyerHome` KPI.

### `src/api/inquiries.ts`

Wraps the dedicated `/inquiries` routes: `submitInquiry` (`POST /inquiries`), `getMyInquiries` (`/inquiries/mine`), `getOwnerInquiries` (`/inquiries/for-owner`), `getRealtorInquiries` (`/inquiries/for-realtor`). **These read a different table from the one the landing site writes to.** Landing inquiries become `leads` rows (see above), and no UI calls `submitInquiry` here, so the `inquiries` table only receives rows from direct API calls or `seed.py`. Consumers of this module: `components/dashboard/BuyerHome.tsx` (Inquiries KPI and recent-inquiries card), `components/dashboard/OwnerHome.tsx` (leads KPI/card) and `pages/owner/Leads.tsx`. In practice those cards stay empty for real traffic (see Gotchas). `getRealtorInquiries` has no caller.

### `src/pages/buyer/Bookings.tsx`

Exports `BuyerBookings`, shown for the `bookings` view when the role is not Admin. Loads `getMyBookings()`, sorts by `check_in` descending, tabs all / upcoming (`check_in >= today`, not cancelled) / past (`check_out < today`, not cancelled) / cancelled with counts computed from the full list. Rows show thumbnail, title, location, dates, nights, guests, `total_price` and a status pill. Cancel appears for `pending` or `confirmed` bookings whose check-in is today or later, behind a `ConfirmModal`, then updates local state optimistically. It shows no payment status, and the modal copy does not mention that captured payments are non-refundable. Only Booking rows from `buyer_id` are listed (guest and lead-only requests never appear here). Empty state links to `VITE_LANDING_URL/search`.

### `src/pages/buyer/Inquiries.tsx`

Exports `Inquiries`. Calls `getMyLeads()` (`GET /leads/mine`, from `src/api/leads.ts`) and keeps `type === 'property_inquiry'`. Table columns: property (`property_title`, else "general inquiry"), message, relative sent time, and a status pill (`new` shown as "Pending", others shown raw; `STATUS_COLOR` has no entry for `schedule`, which falls back to grey). This is the correct source for landing-submitted inquiries because they are leads.

### `src/pages/buyer/SavedHomes.tsx`

Exports `SavedHomes`. Loads `getMySavedHomes()`; each row shows thumbnail, title-cased title, location with bed/bath counts, `fmtPrice`, a For Rent / For Sale pill, and a trash button that calls `unsaveHome` and removes the row locally. The "Browse more" `CardLink` in the header has no `onClick`, so it does nothing. Empty state links to the landing search page.

### `src/pages/buyer/ROICalculator.tsx`

Stub `Card` with a button opening the hard-coded `https://ilovedrrealty.com/calculator` in a new tab (not driven by `VITE_LANDING_URL`). The calculator itself lives in the landing app. No state, no API calls.

### `src/pages/buyer/Resources.tsx`

Renders `BUYER_RESOURCES` exported from `components/dashboard/BuyerHome.tsx`: four hard-coded English entries (guide, property law, residency/visa, cost of living) with a read time. The "Read" `CardLink` has no handler or URL, so the resources are placeholders. No API calls.

### `src/pages/buyer/Upgrade.tsx`

Exports `Upgrade` (view key `upgrade`) plus `OwnerLeadModal` and `RealtorModal`, which `components/dashboard/LockedView.tsx` reuses for the locked Owner/Realtor tabs on the multi-role home. On mount it calls `getMyUpgradeRequests()` (`GET /upgrade-requests/me`) and `getMyLeads()` in parallel and renders nothing until both settle. State: `pending` (first request with `status === 'pending'`), `ownerPending` (any lead of the user with `type === 'seller_interest'` and no `property_id`, including old or closed ones), `ownerFormOpen`, `ownerDone`, `realtorModalOpen`.

- **Owner path ("List My Property")**: `OwnerLeadForm` prefills name, email and phone from `getMe()` and asks for property location and a message. `PhoneInput` (`react-international-phone`) is validated with `isPossiblePhoneNumber` (`libphonenumber-js`); an invalid phone is silently dropped rather than blocking submit. It calls `submitLead({ type: 'seller_interest', ... })` (`POST /leads`, rate limited), which does not change the role by itself. The role changes when an admin assigns a realtor to that lead: `admin_assign_lead` in `realty-api/routes/leads.py` promotes a `buyer` to `owner`, mirrors the realtor onto the user, and sends the approval and realtor emails (see [leads.md](leads.md)).
- **Realtor path**: `RealtorModal` collects license number, territory, years of experience, specialties, bio and calls `submitUpgradeRequest('realtor', ...)` (`POST /upgrade-requests`), creating a `pending` request. Admin approves or rejects in the admin panel (`/admin/upgrade-requests/{id}/approve|reject`, see [admin-tools.md](admin-tools.md)). While a request is pending the page shows a "pending review" card instead of the role cards; rejection reasons are not displayed here.
- There is no way to apply for the owner role through `/upgrade-requests` from this page (`requested_role` supports `owner`, but only the realtor path uses it).

---

## Backend API

The backend (`realty-api`) is FastAPI + SQLAlchemy on PostgreSQL. Auth dependencies live in `utils/auth.py`: `get_current_user` and `get_optional_user` read a Bearer header or the `ildr_token` cookie and validate the API's own JWT (see [auth.md](auth.md)); role gates use `require_role(...)` / `require_admin` from `utils/permission.py`.

### `routes/bookings.py`

Booking, availability, PayPal, and payout endpoints. Everything about this router (guest vs logged-in, overlap rules, state machine, fees, cron, emails) is documented in [bookings-payments.md](bookings-payments.md). Buyer-relevant endpoints: `GET /bookings/mine`, `PUT /bookings/{id}/cancel`, plus the public `POST /bookings`, `POST /bookings/create-payment-auth`, and `GET /bookings/unavailable/{listing_id}`. Every booking also creates a `leads` row (`type=booking`).

### `routes/inquiries.py`

Four endpoints under `/inquiries`, backed by the `inquiries` table, which the current landing site does not use:

- `POST /inquiries`: `get_optional_user`, so anonymous callers work; stores `from_user_id` when logged in and returns `InquiryResponse` with the listing title. No rate limit, no lead, no email, no GHL contact.
- `GET /inquiries/mine`: the caller's own rows (left-joined to listings).
- `GET /inquiries/for-realtor`: role `realtor` or `admin`; inquiries on listings where `submitted_by == user.id` **or** `assigned_realtor_id == user.id`.
- `GET /inquiries/for-owner`: role `owner` or `admin`; inquiries on listings where `owner_id == user.id`.

Because the landing site posts property inquiries to `POST /leads` (`routes/leads.py`: rate limit 3/min, creates a `Lead` with `status=new`, creates the GHL contact, emails the notify address), real buyer inquiries are in `leads`, not `inquiries`.

### `routes/saved_homes.py`

Three endpoints under `/saved-homes`, all requiring login (`get_current_user`):

- `GET /saved-homes/mine`: `saved_homes` joined to `listings` (any listing status), newest first, as `SavedHomeResponse`. Uses `float(listing.price)`, so a listing with a null price would break the response.
- `POST /saved-homes/{listing_id}`: 404 if the listing does not exist (status is not checked, so inactive listings can be saved), 409 `Already saved` if the pair exists, otherwise inserts and returns `{"status": "saved"}` (201).
- `DELETE /saved-homes/{listing_id}`: 404 `Not saved` if absent, else deletes (204).

### `routes/stats.py`

`GET /stats/platform` is public and returns counts used for landing marketing stats (active listings, total value, realtors, registered users); consumed by `usePlatformStats` in the landing `Landing` and `Login` views. It is not buyer-specific.

### `models/booking.py`

`bookings` table; columns and status/payment fields are described in [bookings-payments.md](bookings-payments.md#data-model-bookings). Dates are `Text` (ISO strings), and `buyer_id` is nullable for PayPal guest bookings.

### `models/inquiry.py`

`inquiries` table: `id`, `listing_id` (nullable FK), `name`, `email`, `phone`, `message`, `from_user_id` (nullable FK), `created_at`. The same file defines `AnonymousLead` (`anonymous_leads`: `name`, `email`, `phone`, `area`, `intent`), which no route or UI references (dead model).

### `models/saved_home.py`

`saved_homes`: `id`, `user_id` and `listing_id` (both non-null FKs), `created_at`, with `UniqueConstraint(user_id, listing_id)` as a DB-level backstop to the route's 409 check.

### `schemas/booking.py`

`BookingCreate` (guest `name`/`email`/`phone`, `paypal_order_id`, `guests` 1-20, notes max 1000, validator: `check_out > check_in` and `check_in` not in the past) and `BookingResponse`, `CreatePaymentAuthRequest/Response`. See [bookings-payments.md](bookings-payments.md).

### `schemas/inquiry.py`

`InquiryCreate`: `EmailStr` email, `name` max 200, `message` max 5000 (required), optional `listing_id` and `phone` (max 50). `InquiryResponse` adds `id`, nullable `listing_title`, `created_at`.

### `schemas/saved_home.py`

`SavedHomeResponse` only (no create schema, since creation is a simple `POST /{listing_id}` with no body). Carries the full listing snapshot: `listing_title`, `listing_location`, `listing_price` (float), `listing_transaction` (string: `rent` or `sale`), `listing_images` (list of strings), `listing_bedrooms` (optional int), `listing_bathrooms` (optional float), and `saved_at` (datetime). `model_config = {"from_attributes": True}`.

---

## Key Flows

### 1. How a visitor saves a home (landing → dashboard)

1. A logged-in user opens `/search` on the landing site. `Search.tsx` calls `getMySavedIds()` (`GET /saved-homes/mine`); success marks the visitor logged in and fills the saved-id set (a 401 is ignored).
2. The visitor clicks the heart on a `PropertyCard`. If not logged in, `go('login')`. Otherwise the set toggles optimistically and `saveHome` (`POST /saved-homes/:id`) or `unsaveHome` (`DELETE`) is sent; on failure the toggle is reverted.
3. The API checks the listing exists, returns 409 if already saved, otherwise inserts a `SavedHome` and returns `{"status": "saved"}`.
4. In the dashboard, `SavedHomes` (view `saved`) and the `BuyerHome` KPI call `getMySavedHomes()`. The trash button calls `unsaveHome` and removes the row locally.

### 2. How a buyer sends an inquiry (landing -> leads pipeline)

1. On a listing page (`PropertyDetail.tsx`) the visitor opens the inquiry form in the sidebar (name, email, phone, message; prefilled from `getMe()` when logged in; works anonymously).
2. `submitInquiry()` sends `POST /leads` with `type: 'property_inquiry'` and `property_id`. The API creates a `Lead` (`status=new`, `from_user_id` if logged in), creates the GHL contact, and emails the notify address. Limit 3/min per client; errors are swallowed and the form stays open.
3. The lead appears in the admin Leads page. Admin assigns a realtor (`PUT /admin/leads/{id}/assign`) or advances status. The assigned realtor sees it under `GET /realtor/leads`. There is no automatic assignment for property inquiries (unlike bookings, which auto-assign to the listing owner/submitter).
4. The buyer sees it in the dashboard `Inquiries` page via `GET /leads/mine` (status `new` is labelled "Pending").
5. Owners do **not** see these inquiries on their Leads page or home KPI, because those read `GET /inquiries/for-owner` (the unused `inquiries` table). Treat that as a known gap, see Gotchas.

### 3. How a buyer books a rental (summary)

1. On a `rent` listing, the visitor opens "Request to book", picks free dates on the availability calendar, and either pays via PayPal (authorize only) or sends a plain request. Guests and logged-in users both work.
2. `POST /bookings` re-checks availability, creates a Lead (and a Booking row when logged in or when PayPal was used), and emails the guest and owner. The booking starts `pending`.
3. The listing owner/submitter accepts (captures any authorized payment, status `confirmed`) or declines (voids the authorization, status `cancelled`). The buyer can cancel from `Bookings` in the dashboard.
4. After check-out a nightly cron pays the owner minus the platform fee; admins can release or retry from the admin Bookings page.

Full details and failure modes: [bookings-payments.md](bookings-payments.md).

### 4. How a buyer requests a role upgrade

1. The buyer opens the `upgrade` view in the dashboard (`/upgrade`). The page loads `GET /upgrade-requests/me` and `GET /leads/mine` in parallel.
2. A pending realtor request replaces the page with a "pending review" card. An existing `seller_interest` lead with no property turns the owner card into "Request Pending".
3. **Owner path:** "List My Property" opens `OwnerLeadForm` (prefilled via `getMe()`), which posts a `seller_interest` lead. The role changes only when an admin assigns a realtor to that lead; then the API promotes `buyer` to `owner` and sends the emails.
4. **Realtor path:** the `RealtorModal` questionnaire posts `POST /upgrade-requests` (`pending`). An admin approves or rejects it, which updates the role and emails the user.
5. The dashboard reads the user's role from `GET /auth/me` (not from the JWT claims), so the new role appears once the app re-fetches it (reload or re-login).

## Gotchas

- **Inquiries live in two places.** Landing (`POST /leads`) and dashboard buyer Inquiries page (`GET /leads/mine`) use `leads`. `BuyerHome` Inquiries card/KPI, `OwnerHome` leads KPI and `pages/owner/Leads.tsx` use `/inquiries/*` and will show nothing for real traffic. Either migrate those readers to leads or start writing inquiries to both.
- **Saved homes:** only search cards have a heart; the "Browse more" link and the Resources "Read" links are no-ops; saved listings are not filtered by status.
- **Calculator link:** `ROICalculator.tsx` hard-codes the production URL.
- **Upgrade:** `ownerPending` is true for any past `seller_interest` lead without a property, so a user cannot resubmit even if the earlier lead was closed.
- **`POST /leads` rate limit (3/min)** is shared by inquiries, contact forms, and the owner lead form for the same client IP.
- **Removed/renamed:** the old doc's references to Supabase-session auth headers, a `/buyer/upgrade` URL, and landing inquiries going to `/inquiries` were wrong; the files `src/api/*.ts`, `src/views/{Buying,Selling,Calculator}.tsx`, `src/pages/buyer/*.tsx` all still exist. `Buying`/`Selling` copy moved from data files into `src/locales`.
5. An admin reviews the request in the admin panel, approves or rejects it, and updates the user's role accordingly. Once approved, the user's JWT will reflect the new role on next login, and the dashboard routing will redirect them to the appropriate owner or realtor view instead of the buyer pages.
