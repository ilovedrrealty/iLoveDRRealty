# Frontend — Remaining Work

Only pending frontend work is described here. Implemented detail lives in `docs/archive/plan_v6/frontend.md`.

> Appended 2026-10-10: the "Phases 39–53" section directly below documents frontend work shipped Aug 15 – Sep 18 2026 (all complete). Open frontend items are further down (Phase 28, 24, 23, 26, 27).

---

## Phases 39–53 — Implemented Aug–Sep 2026 (all `[COMPLETE]`)

Paths are relative to `apps/landing/src` (L) or `apps/dashboard/src` (D).

### Phase 39 — Team page realtor agents + PayPal feature flag (2026-08-15)
- **L `views/Team.tsx`, `data/teamData.ts`, `locales/{en,es}/team.json`, `public/team/francy.jpeg`** — new "realtor agents" section under the principals; Francy Dominguez added as the first agent (a `hotfix/team-francy` branch carries the same change).
- **L `lib/features.ts`, D `lib/features.ts`** — `PAYPAL_ENABLED` master switch. While `false` it hid: the landing PayPal checkout on rentals (`PropertyDetail.tsx`), the owner payout-email capture (`Settings.tsx`, `OwnerHome.tsx`), payout release/request actions (`BookingDetailPanel.tsx`, `admin/Bookings.tsx`, owner/realtor `Bookings.tsx`) and the PayPal gates in admin/realtor `SubmitListing.tsx` and the `ListingDetailPanel`s. Backend is unaffected by the flag. **Now `true` in both apps** (Phase 51); the two flags must be kept in step.

### Phase 40 — All DR regions + lead modal fix (2026-08-18)
- **D `data/regions.ts`** (new): `POPULAR_AREAS` (10 tourist localities, values unchanged so existing listings still match), `DR_PROVINCES` (31 provinces + Distrito Nacional), `OTHER_PROVINCES`, `REGION_GROUPS`, `ALL_REGIONS`. Admin + realtor `SubmitListing.tsx` render the two groups (EN/ES labels in `admin.json`/`realtor.json`).
- **L `data/searchData.ts`, `components/SearchFilterSidebar.tsx`, `SearchMapSidebar.tsx`, `views/Search.tsx`** — same grouping in search; price ceiling fixed.
- **L `components/LeadCaptureProvider.tsx`** — `normalizePath()` strips the trailing slash (`trailingSlash: true` made `usePathname()` return `/login/`, so `EXCLUDED_PATHS` never matched) so the lead modal no longer opens over login/signup.
- Note: `realty-api/utils/listing_constants.py` mirrors these region lists for import warnings — keep both in step.

### Phase 42 — Contact channels, buy/sell flows, share links (2026-09-07)
- **L `data/contactData.ts`, `components/Footer.tsx`** — real business number (WhatsApp `wa.me` link and displayed phone).
- **L `views/Contact.tsx`** — Buyer / Seller tab switch; separate interest option lists (`form.interest_options` / `form.interest_options_selling` in `contact.json` EN+ES); `?type=sell` preselects the seller tab (`Selling.tsx` CTA links there). **`api/inquiries.ts`** now derives the lead type from `tab` (`seller_interest` vs `buyer_interest`) instead of matching the interest label.
- **L `views/PropertyDetail.tsx`** — WhatsApp / X / SMS share text carries price, beds, baths, area and a region hashtag. **`app/listing/[id]/page.tsx`** — page title `NBR <title> · <price>`, description built from bed/bath/area/tag/location, `og:image` = `share_image_url` (fallback first photo, then logo), cache-busted with `?v=<updated_at>` (Phase 44).

### Phase 43 — Real platform stats (2026-09-07)
- **L `api/stats.ts` + `hooks/usePlatformStats.ts`** → `GET /stats/platform`. `views/Landing.tsx`, `Login.tsx`, `Signup.tsx` use it in place of hardcoded numbers (`data/landingData.tsx` keeps copy only; the unused auth.json string removed).
- Compact price formatters (`data/listings.ts`, `SearchMapSidebar.tsx`, `Calculator.tsx`, dashboard `components/dashboard/shared.tsx`, `pages/admin/shared.tsx`, admin/owner/realtor `Listings.tsx`, `realtor/Pipeline.tsx`) now handle B (billions) and T (trillions).

### Phase 45 — Spanish landing page + Google Ads (2026-09-09)
- **L `app/es/bienes-raices-republica-dominicana/page.tsx` + `views/SpanishLandingPage.tsx`** — standalone paid-traffic page (title/description/OG, canonical `/es/bienes-raices-republica-dominicana/`, hreflang `es-DO`/`en`→`/buying/`, `RealEstateAgent` JSON-LD, `EsLangSync` forces ES). Listed in `sitemap.ts` with language alternates.
- **L `lib/constants.ts`** `STANDALONE_PAGE_PATHS` + `isStandalonePage()` — `Navbar.tsx` and `Footer.tsx` render nothing on those paths so ad visitors stay on the form.
- **L `lib/gtag.ts`** — sitewide Google Ads tag is loaded in `app/layout.tsx`; `trackFormConversion()` fires only after the lead POST succeeds (`Contact.tsx`); `trackWhatsAppConversion()` on WhatsApp link clicks (Footer). **`lib/tracking.ts` + `components/TrackingCapture.tsx`** store `gclid`/`gbraid`/`wbraid`/UTM params in localStorage and `getTrackingReferenceLine()` appends `Referencia: k=v | …` to the contact message. (The Ads account/conversion IDs live in `gtag.ts`; they are public tag IDs, not secrets.)
- **L `app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`** (new) — footer privacy/terms buttons now link to them; both in the sitemap.

### Phase 46 — Display polish (2026-09-09/10)
- Bed / bath / living-area / ROI chips render only when the value is non-zero: L `views/Search.tsx`; D `components/listings/ListingDetailPanel.tsx`, `components/admin/ListingDetailPanel.tsx`, `ListingEditReviewPage.tsx`.
- L `views/PropertyDetail.tsx` — sticky sidebar capped by viewport height so "Send" stays above the Tidio bubble.

### Phase 47 — Reassign listing to a realtor (2026-09-10)
- **D `components/admin/RealtorCombobox.tsx`** (new, extracted from `LeadDetailPanel.tsx`, which shrank by ~120 lines) — searchable realtor picker reused by lead assignment and listing assignment.
- **D `components/admin/ListingDetailPanel.tsx`** (+ `pages/admin/Listings.tsx`) — "assigned realtor" control calling `assignAdminListing(id, realtorId|null)` → `PUT /admin/listings/{id}/assign`. `AdminListing` gained `assigned_realtor_id/name/email`. **`ListingHistoryPanel.tsx`** — `realtor_assigned` / `realtor_unassigned` events with neutral (non-red) note styling.

### Phase 48 — Bulk import UI + Spanish descriptions (2026-09-14/15)
- **D `pages/admin/BulkImportListings.tsx`** (new; routed in `AdminDash.tsx`, nav entry in `DashLayout.tsx`, `nav.json`) — CSV upload, job list and per-row results polling `GET /admin/listings/bulk-import[/{id}]`; API helpers in `api/admin.ts`; EN/ES strings in `admin.json`.
- **L `views/PropertyDetail.tsx`** shows `description_es` when the UI language is Spanish (fallback to `description`). **D admin + realtor `SubmitListing.tsx`** — EN/ES toggle on the description editor.

### Phase 49 — Server-side pagination (2026-09-15)
- **L `api/listings.ts`** (paged fetch + filters), `api/axios.ts`, `data/searchData.ts`, `views/Search.tsx` (≈220 lines changed), `views/Landing.tsx` — filters/sort/page are sent to `GET /listings`; median price and avg ROI come from the response. Pagination controls above and below the results.
- **D `api/listings.ts`, `api/admin.ts`, `pages/admin/Listings.tsx`, `owner/Listings.tsx`, `realtor/Listings.tsx`, `admin/Home.tsx`** — use `/admin/listings` (paged) and `/listings/mine/page`; paging strings in EN/ES locale files.
- **L `app/listing/[id]/page.tsx` `generateStaticParams()` and `app/sitemap.ts`** now loop over the paginated endpoint. Before this fix both parsed a bare array, so the `output: 'export'` build failed and the sitemap was empty. **Any new build-time consumer of `GET /listings` must page through `{items,total}`.** Static export means listings approved after a build have no `/listing/<id>/` page or sitemap entry until the landing site is rebuilt/redeployed; no rebuild trigger exists in either repo (see `docs/ARCHITECTURE.md`), while the client-rendered `/detail?id=` route works for new listings. The build now pages 60 listings per API call (about 90 calls if the planned ~5,300-listing co-listing import is loaded).

### Phase 51/52 — Booking UI conflicts (2026-09-18)
- **L `views/PropertyDetail.tsx`** — `rangeBooked()` / `isCheckoutBlocked()` use half-open ranges: check-in/check-out pickers reject ranges that span a booked stay; a 409 from the API shows `booking.error_date_unavailable`.
- **D `pages/owner/Bookings.tsx`, `pages/realtor/Bookings.tsx`** — accept/decline failures with 409 show a dismissible `bookings_page.dates_conflict` alert (`data-testid="booking-action-error"`).
- `PAYPAL_ENABLED = true` in both apps (commit `90f3dce`).

### Phase 53 — Scheduling providers + setup reminders (2026-09-18)
- **D `lib/scheduling.ts`** — `SchedulingProvider = 'calendly' | 'google'`; both are a public https URL saved in `calendly_url`, provider inferred from host (`calendar.app.google`, or `calendar.google.com/…/appointments/…`; everything else is treated as Calendly). `validateSchedulingUrl()` is strict when connecting; `schedulingEmbedUrl()` returns an iframe URL or `null`.
- **D `components/dashboard/SchedulingFrame.tsx`** (new) — Calendar page body: inline iframe when framing is allowed, otherwise a card that opens the page in a new tab (Google `calendar.app.google` short links send `X-Frame-Options: SAMEORIGIN`; only the long `calendar.google.com/calendar/appointments/schedules/…` URL embeds). Used by `owner/Calendar.tsx` and `realtor/Calendar.tsx`; connect UI (provider picker) in `pages/Settings.tsx`.
- **D `components/dashboard/SetupBanners.tsx`** (new) — `useListingSetup(user, kind)`: realtors need a scheduling link; owners need a scheduling link and, while `PAYPAL_ENABLED`, a PayPal email. `Dashboard.tsx` renders the banners above every owner/realtor screen (the Calendar page hides the Calendly banner because it has its own prompt); every add-listing button (Home, Listings, empty states) uses the same rule and tooltip. Copy moved to `common.json` EN/ES (`setup_banner.*`, `scheduling.*`).

---

## Phase 38 — Admin Bookings & Request Payout (post-archive additions)

### `apps/dashboard/src/pages/admin/Bookings.tsx` (new)
- Full-page admin view of all bookings across all listings.
- Filter chips: All / Failed Payout / Pending Payment (live counts).
- Each row: guest avatar, name, booking/payment/payout status badges, listing title, owner name, dates, price/payout breakdown.
- Inline "Release Payout" button for `payout_status !== 'paid'` (i.e., pending or failed — matches what the backend accepts); two-step confirmation: first click shows "Confirm" + "Cancel" inline; "Confirm" fires `handleReleasePayout` and optimistically sets `payout_status: 'paid'`.
- `confirmPayoutId: string | null` state drives the two-step confirm for both desktop table rows and mobile cards.
- Click any row to open `BookingDetailPanel` with `isAdmin` and `onReleasePayout`.
- Loads via `getAdminBookings()` from `api/bookings.ts`.

### `apps/dashboard/src/pages/AdminDash.tsx` (bug fix)
- Was missing `import { AdminBookings }` and `case 'bookings'` in `renderView()`.
- Also added `'bookings'` to the valid `pageKey` list so the page title renders from locale instead of falling back to "home".
- Root cause: admin routing lives in `AdminDash.tsx`, not `Dashboard.tsx`; the `case 'bookings'` added to `Dashboard.tsx` never ran for admin users.

### `apps/dashboard/src/layouts/DashLayout.tsx`
- Added `{ Icon: Bell, view: 'bookings' }` to `ADMIN_NAV` between leads and settings.

### `apps/dashboard/src/components/dashboard/BookingDetailPanel.tsx`
- Added `onRequestPayout?: () => Promise<void>` prop.
- Added `payoutRequested` local state.
- Non-admin with `payment_status === 'captured'` and `payout_status === 'failed'` sees amber "Request Payout" button; flips to "Payout request sent ✓" after click.
- Admin `showRelease` condition: `payout_status !== 'paid'` (was `=== 'failed'`); shows for all captured bookings not yet paid out.
- Added `confirmRelease: boolean` state; "Release Payout" click sets it `true`; footer expands to show a warning + "Confirm Release" / "Cancel" pair before firing the callback.

### `apps/dashboard/src/pages/owner/Bookings.tsx`
- Replaced dead "Release Payout" (required `isAdmin`) with "Request Payout" visible to owners on failed payout bookings.
- Calls `requestPayout()` (email to admin); no optimistic payout_status update.
- Added `payoutRequested` local state per row; shows "Payout Requested ✓" after click.

### `apps/dashboard/src/pages/realtor/Bookings.tsx`
- Same "Request Payout" button added for realtors on failed-payout bookings.
- `handleRequestPayout` calls `requestPayout()` and sets row-level `payoutRequested` state.
- `BookingDetailPanel` wired with `onRequestPayout`.

### `apps/dashboard/src/api/bookings.ts`
- Added `owner_name: string | null` to `Booking` interface.
- Fixed `releasePayout`: changed `client.put` → `client.post` (HTTP method mismatch with backend `@router.post`).
- Added `requestPayout(id: string): Promise<void>` → `POST /bookings/{id}/request-payout`.
- Added `getAdminBookings(): Promise<Booking[]>` → `GET /admin/bookings`.

### `apps/dashboard/src/api/admin.ts`
- Added `owner_paypal_email: string | null` to `AdminListing` interface (was missing; caused TS error in `admin/SubmitListing.tsx` edit form init).

### `apps/dashboard/src/pages/owner/Calendar.tsx` + `realtor/Calendar.tsx` (bug fix)
- `Card`'s `sub` prop is `string | undefined`; both files were passing a JSX element with an `<a>` tag inside.
- Fix: external link icon moved into the `title` prop (accepts `ReactNode`); `sub` now receives the plain translated string.

### Locale files
- `en/admin.json` + `es/admin.json`: added `"bookings"` page entry under `"pages"` (title + sub).
- `en/owner.json` + `es/owner.json`: added `request_payout` and `payout_requested` keys under `bookings_page`.
- `en/realtor.json` + `es/realtor.json`: added `request_payout` and `payout_requested` keys under `bookings_page`.

---

## Phase 38 — Dual-Pricing Rental Type Selector

### `apps/landing/src/views/PropertyDetail.tsx`
- Added `rentalType` state (`'daily' | 'monthly'`, default `'daily'`).
- Renders a "Daily / Monthly" pill toggle only when `listing.price_per_day && listing.price_per_month` are both set.
- PayPal buttons condition: `PAYPAL_CLIENT_ID && transaction === 'rent' && price_per_day && rentalType === 'daily'`.
- Normal submit button condition: shows when PayPal is absent, listing is not rent, no daily rate, or `rentalType === 'monthly'`.
- Key decision: toggle defaults to `'daily'` so the PayPal flow stays the default for dual-priced listings.

### `apps/landing/src/locales/en/property_detail.json`
- Added under `booking`: `"rental_type"`, `"daily"`, `"monthly"`.

### `apps/landing/src/locales/es/property_detail.json`
- Added under `booking`: `"rental_type": "Tipo de renta"`, `"daily": "Diario"`, `"monthly": "Mensual"`.

---

## Phase 28 — Content Marketing Engine

### Adding a post (workflow)
1. Add the `Article` object to `ARTICLES` in `apps/landing/src/data/blogData.ts` (set `catKey`, `facts`, `body` blocks, `faqs`, `metaTitle`/`metaDescription`/`keywords`, a working image URL, `author: 'iLoveDRRealty Team'`).
2. Add a card to `GUIDES` (and optionally `EDITOR_PICKS` / `FEATURED`) so it appears on the index.
3. Cross-link 5–10 relevant internal links via `[[label|page]]` / `[[label|article|slug]]`; CTAs point to `search` / `calculator` / `contact`.
4. Run `npx tsc --noEmit` in `apps/landing`.

### Adding a Spanish translation
1. Mirror the post in `ARTICLES_ES` in `blogData.es.ts` (same slug, same block order/types — translate only visible text).
2. Add a `CARDS_ES[slug]` entry (title, desc, optional tag/read/role) for the index cards.
3. EN remains the fallback for any untranslated slug. Each translated slug automatically gets a `/es/article/[slug]` page.

### Staging / publishing posts
- `HIDDEN_GUIDES` in `blogData.ts` holds the 9 Week 2–4 cards (not imported anywhere → not visible). Their `Article` entries stay in `ARTICLES` so pages build and are reachable by direct URL.
- To publish: move the entry from `HIDDEN_GUIDES` into `GUIDES`; update `date` to the publish date string. Mirror the date in `blogData.es.ts` in Spanish format.

### Remaining translations (9 posts)
Mirror each into `ARTICLES_ES` + add a `CARDS_ES` entry:
- `can-canadians-buy`
- `property-taxes-ipi`
- `las-terrenas`
- `best-places-to-retire`
- `dr-real-estate-safe`
- `living-punta-cana`
- `confotur-explained`
- `dr-vs-miami`
- `living-cabarete-sosua`

### Newsletter signup wiring
- Add `subscribeNewsletter(email: string)` to `apps/landing/src/api/inquiries.ts` → `POST /public/newsletter`.
- Wire the inert email input on `apps/landing/src/views/Blog.tsx` and the landing signup section.
- Show success/error toast; disable input while in-flight.
- Add locale keys: `newsletter.subscribe`, `newsletter.subscribing`, `newsletter.success`, `newsletter.error` to `en/blog.json` + `es/blog.json`.

### Dummy-data cleanup
- Replace the hero stat strip values in `apps/landing/src/views/Home.tsx` with real or neutral copy.
- Replace per-article `reads` counts in `blogData.ts` with neutral values or remove them.
- **Done (verified 2026-10-10):** hero/login/signup stats are bound to live `GET /stats/platform` (Phase 43); every article's `reads` is now `'—'` in `blogData.ts`. Newsletter wiring and the 9 ES translations above are still open (`ARTICLES_ES` holds only `can-americans-buy`, `closing-costs-dr`, `punta-cana-airbnb-roi`; `HIDDEN_GUIDES` still holds the 9 staged cards).

---

## Phase 24 — Admin Site Settings

> **Partially built (verified 2026-10-10).** `api/admin.ts` already has `getPlatformSettings()` / `updatePlatformSettings()` but typed for `notify_email` only, and the Platform tab in `pages/admin/Settings.tsx` loads/saves just that one field (admin notification address for payout failures). The tab has no `contact_email`, `platform_name`, deal-of-week toggle or featured-count fields yet; tabs are `profile | platform | security` only.

**File:** `apps/dashboard/src/api/admin.ts`
- Add `PlatformSettings` interface: `{ contact_email, platform_name, deal_of_week_enabled, featured_listing_count, updated_at? }`.
- Add `getPlatformSettings(): Promise<PlatformSettings>` → `GET /admin/settings`.
- Add `updatePlatformSettings(data: Partial<PlatformSettings>): Promise<void>` → `PUT /admin/settings`.

**File:** `apps/dashboard/src/pages/admin/Settings.tsx` — Platform tab
- On mount: call `getPlatformSettings()`; populate form fields; loading skeleton while fetching.
- Save: call `updatePlatformSettings(data)`; toast on success/error; disable button while in-flight.
- Fields: contact email, platform name, deal-of-week toggle, featured listing count.

---

## Phase 23 — GoHighLevel CRM (frontend, remaining)

**File:** `apps/dashboard/src/pages/admin/Settings.tsx` — add an Integrations / GHL section (build Phase 24 first):
- Fields: API key (password input), location ID, enable/disable toggle.
- Saved via the same `PUT /admin/settings`; extend `PlatformSettings` with `ghl_enabled`, `ghl_api_key`, `ghl_location_id`.

---

## Phase 26 — Account Deactivation / Deletion (frontend, remaining)

**File:** `apps/dashboard/src/pages/Settings.tsx` — after `deactivateAccount()` succeeds, call `logout()` and redirect to the landing site with `?msg=deactivated`. Currently the page stays open after the cookie is cleared.

> **Update 2026-10-10 (verified):** `handleDeactivate` in `pages/Settings.tsx` already redirects to the landing origin with `?msg=deactivated` (added in `36b4a63`, 2026-06-29). What is still open is only optional polish: the landing app does not read the `msg` param, so no "account deactivated" notice is shown; and the origin is derived with `window.location.origin.replace('dashboard', 'ilovedrrealty.com')`, and the production dashboard host (`app.ilovedrrealty.com`, per ARCHITECTURE.md) contains no "dashboard" substring, so in production this redirect appears to land back on the dashboard origin rather than the marketing site. Recommended fix: build the URL from `VITE_LANDING_URL` (already used in `App.tsx`). Worth a quick manual test.

---

## Phase 27 — Tidio Live Chat (no frontend remaining)

All frontend work is done (widget embedded, custom button removed). Remaining work is in the Tidio dashboard — plan upgrade, Flow wiring, Lyro data sources.
