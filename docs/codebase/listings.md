# Listings

Listings are the core domain of I Love DR Realty — each record is a Dominican Republic property for sale or rent. The feature spans the public Next.js landing site (browse, search, detail pages, SEO and share previews), the Vite/React dashboard (submit/edit per role, admin review, bulk import) and the FastAPI backend (persistence, edit-approval queue, pagination, image storage, share-image rendering). For the file-by-file quick map see [../LISTINGS.md](../LISTINGS.md); for rental bookings on listings see [bookings-payments.md](bookings-payments.md).

## Lifecycle at a glance

```
create (POST /listings)
  admin   -> status=active                         (no review)
  realtor -> status=pending_approval               (any sale/rent/both)
  owner   -> status=pending_approval               (transaction must be "rent", else 422)
        |
admin approve  -> active          reject(reason) -> rejected     archive -> archived
        |                               |
        |                         submitter edits (PUT) -> back to pending_approval, reason cleared
        v
active listing edited by realtor/owner -> row in listing_edits (status=pending); live listing untouched
        |  admin approves -> proposed_data copied onto the listing (+ share image refresh)
        |  admin rejects  -> edit marked rejected with reason
active listing edited by admin -> applied immediately (no queue, no event)
```

- **Status enum:** `draft | pending_approval | active | rejected | archived` (`draft` is never produced by the API).
- **Who can edit what:** `PUT /listings/{id}` requires the caller to be the `submitted_by` user, the `assigned_realtor_id` user, or an admin. An owner can therefore only edit listings *they submitted* — listings a realtor/admin created on their behalf (`owner_id` set, different `submitted_by`) are read-only for them; the UI shows "Request change" (creates a `seller_interest` lead) instead of "Edit".
- **`DELETE /listings/{id}` is an archive**, not a delete (same permission rule; writes no event).
- **Audit trail:** `listing_events` rows are written for `submitted`, `approved`, `rejected`, `archived`, `edit_submitted`, `edit_approved`, `edit_rejected`, `realtor_assigned`, `realtor_unassigned`. Direct admin edits, re-submission of a rejected listing, owner/realtor archive and deal changes do **not** create listing events (deal changes only write `activity_log`).
- **Deal of the Week:** `is_deal`, `deal_discount_value`, `deal_discount_type` (`pct | fixed`) live on the listing. Realtors/owners submit a `deal_requests` row (`POST /listings/{id}/deal-request`, own active listing, one pending per user/listing); admins approve/reject it, or set/clear a deal directly (`set-deal`, `clear-deal`). Public `GET /listings/deal` feeds the home page.

## Key data fields (`realty-api/models/listing.py`)

| Concern | Columns |
|---|---|
| Core | `title`, `description`, `description_es` (Spanish copy, shown when landing language is `es`, falls back to English), `type` (`villa|apartment|condo|land|commercial`), `transaction` (`sale|rent|both`), `location` (free-text region), `bedrooms`, `bathrooms` (0.5 steps), `area_sqft`, `lot_size_sqft`, `year_built`, `construction_status` |
| Pricing | `price` (always USD in practice), `roi`; rentals add `price_per_day`, `price_per_month`, `association_fee`, `deposit_policy`, `included_utilities`; sale adds `hoa`, `hoa_fee`, `seller_financing`, `tax_exempt`, `gated_community` |
| Rental payout | `owner_paypal_email` (per-listing payout override; the payout cron falls back to the owner/submitter's `users.paypal_email`) |
| Media | `images` (first = thumbnail), `video_links`, `tour_3d_url`, `maps_url`, `latitude`, `longitude`, `share_image_url` |
| Ownership | `submitted_by` (creator), `owner_id` (owner account, set for owner-created listings), `assigned_realtor_id` (public contact; set by admin), `approved_by/approved_at`, `rejection_reason` |
| Co-listing | `co_listing_enabled` + `co_listing_brokerage/agent_name/agent_contact/agent_email/brokerage_email/brokerage_phone/commission_split/notes/status`, `co_listing_agreement_accepted`, `co_listing_agreement_url` (PDF via `POST /listings/upload-agreement`, realtor/admin, 10 MB) |
| Import | `source_ref` (unique; dedup key for CSV import), `currency` (`USD` default) |
| Counters | `view_count` (`POST /listings/{id}/view`, 5/min per IP, active only), `leads_count` and pending flags are computed per request |

Migrations live in `realty-api/alembic/versions/` (e.g. `f4a6b8c2d0e1` view_count, `o3p4q5r6s7t8` share_image_url, `p4q5r6s7t8u9` assigned_realtor_id, `q5r6s7t8u9v0` source_ref/currency, `r6s7t8u9v0w1` bulk_import_jobs, `t8u9v0w1x2y3` description_es, `u9v0w1x2y3z4` status+created_at index).

---

### Landing App

| File | What it does |
|---|---|
| `apps/landing/src/api/listings.ts` | HTTP client. `fetchListings(query)` (server-side filter/sort/pagination, returns `ListingsPage` with `total`, `medianPrice`, `avgRoi`), `fetchListingById`, `fetchDealListings`, `recordListingView`. Maps API rows to the card shape (sqft -> m2, tag tuples via `TAG_TONES`). **Never reads `currency`**; all prices are treated as USD. |
| `apps/landing/src/api/imgUrl.ts` | `supabaseImgUrl(url, width)` rewrites Supabase Storage public URLs to the `/render/image/` resizer for thumbnails. |
| `apps/landing/src/app/listing/[id]/page.tsx` | Server route. `generateStaticParams` walks `GET /listings` in pages of 60 (`include_aggregates=false`) at build; `generateMetadata` builds title ("3BR Villa . $450,000"), canonical `/listing/{id}/`, Open Graph/Twitter tags using `share_image_url` (cache-busted with `?v=<updated_at ms>`, falling back to the first photo); injects JSON-LD (`Accommodation` for rent, else `Product`); renders `PropertyDetail id={id}`. |
| `apps/landing/src/app/detail/page.tsx` | Client-side variant `/detail?id=<uuid>`; this is what in-app cards (`go('detail?id=...')`) navigate to, so brand-new listings work before the static page exists. |
| `apps/landing/src/views/PropertyDetail.tsx` | Detail page: gallery + lightbox, specs, features, tags, map embed, videos, 3D tour, EN/ES description, USD/DOP toggle (live rate), mortgage calculator, inquiry form (`property_inquiry` lead), share button (Web Share API / copy link), view counter, rental pricing (daily/monthly), availability calendar and booking/PayPal widget (see [bookings-payments.md](bookings-payments.md)). |
| `apps/landing/src/views/Search.tsx` + `app/search/page.tsx` | Search page (page wrapped in `Suspense` for `useSearchParams`). Filters/sort/page are mirrored into the URL; each change refetches `GET /listings` (24 per page, price/ROI sliders debounced 350 ms); "You might also like" fetches 3 extra listings with `exclude_ids`. Shows insights (count, median price, avg ROI) from the aggregates. |
| `apps/landing/src/components/SearchFilterSidebar.tsx` | Filter inputs (purpose, type, region incl. "more regions", price, beds, ROI, amenities). |
| `apps/landing/src/components/SearchMapSidebar.tsx`, `SearchInventoryMap.tsx`, `data/searchMap.ts` | **Google Maps** (`@react-google-maps/api`) with a larger sidebar and expandable desktop/mobile dialog. Saved coordinates produce exact-position markers and bounded clusters; dashed area summaries represent listings without coordinates. No individual property location is fabricated from its region. |
| `apps/landing/src/views/Landing.tsx` | Home page: `fetchListings({pageSize:50})`, `fetchDealListings()`, and `usePlatformStats` (`GET /stats/platform`: active listings, total value, realtors, registered users). |
| `apps/landing/src/app/sitemap.ts`, `robots.ts` | `force-static`; sitemap paginates `/listings` the same way as `generateStaticParams`; robots disallows everything unless `NEXT_PUBLIC_SITE_ENV === 'production'`. |
| `apps/landing/src/app/es/...`, `views/SpanishLandingPage.tsx` | Spanish lead-gen page (see [leads.md](leads.md)); it does not list properties. Per-listing Spanish copy is `description_es`, rendered by `PropertyDetail` when `i18n.language === 'es'`. |

The landing app is a **static export** (`output: 'export'`, `trailingSlash: true`), so SEO pages exist only for listing IDs present at build time.

The search map loads the filtered inventory through `GET /listings/map`, independently of card pagination. Panning can request a bounded viewport; changing the card page does not recenter or restrict the map to that page. Clusters limit native marker count, and a truncated response asks the visitor to zoom or narrow filters. Approximate area summaries use known region centers, show an area label/count and apply location filters when selected; they do not identify a property's address. Saved coordinates are displayed as supplied, not certified by the map. The expanded dialog's property cards remain the current results page.

---

### Dashboard App

#### API clients
- `apps/dashboard/src/api/listings.ts` — `Listing` / `ListingCreate` / `ListingUpdate` types; `getMyListings()` (unpaginated, used by home widgets), `getMyListingsPage({page,pageSize,status,q,pendingReview})` (tables), `submitListing`, `updateListing`, `uploadListingImages` (up to 25 files, 20 MB each), `uploadAgreementPdf`, `submitDealRequest`.
- `apps/dashboard/src/api/admin.ts` — `AdminListing`, `AdminListingEdit`, `DealRequest`, `BulkImportJob` types and calls: `getAdminListings(query)` (paginated), `getAdminListing`, approve/reject/archive, `assignAdminListing`, edit approve/reject, deal request approve/reject, `setListingDeal`/`clearListingDeal`, `getListingHistory`, `bulkImportListings`/`getBulkImportJob`/`listBulkImportJobs`.

#### Per-role screens (see `pages/Dashboard.tsx` for routing; `listings` and `submit-listing` views switch on role)

| Role | Files | Behaviour |
|---|---|---|
| Realtor | `pages/realtor/Listings.tsx`, `pages/realtor/SubmitListing.tsx` (exports `SubmitListing` and `EditListing`) | Table of own listings (submitted or assigned) via `/listings/mine/page`, 50 per page, status pills (All / Active / Review / Rejected / Archived), debounced search, "Pending reviews" sidebar from `pendingReview=true`. The form has sale **and** rent modes and ten sections: basics (incl. EN + ES description via `RichTextEditor`), details, construction, financials/rent pricing (daily + monthly, USD/DOP toggle), community, included utilities (rent), media (photos with star = thumbnail, videos, 3D tour, Google Maps URL -> lat/lng), utilities, co-listing (with signed-agreement PDF), tags. Rent requires a daily or monthly price; a daily rate also requires the owner's PayPal email while `PAYPAL_ENABLED`. Co-listing requires accepting the agreement. |
| Owner | `pages/owner/Listings.tsx`, `pages/owner/SubmitListing.tsx` (`OwnerSubmitListing`, create + edit) | Same paginated table plus an "agent banner" (`GET /auth/me/agent`). Owners can add **rental-only** listings with a nightly rate (single `price_per_day`, stored as both `price` and `price_per_day`, USD) — the form has no monthly rate, Spanish description, payout email or co-listing fields, and only the ten `POPULAR_AREAS` regions. Edit is offered only for listings the owner submitted; others get "Request change" (lead). |
| Admin | `pages/admin/Listings.tsx`, `pages/admin/SubmitListing.tsx` (`AdminSubmitListing`, `AdminEditListing`), `pages/admin/BulkImportListings.tsx` | Everything below. Region dropdown uses the full national list from `src/data/regions.ts` (`POPULAR_AREAS` + all 31 provinces and the Distrito Nacional), as do the realtor form and the API's `utils/listing_constants.py`. |

Gating: "Add listing" buttons, the setup banners and the submit view are controlled by `useListingSetup` in `components/dashboard/SetupBanners.tsx` — realtors need a connected scheduling link, owners need a scheduling link **and** (when `PAYPAL_ENABLED`) a PayPal payout email. **This gate is front-end only**; `POST /listings` does not check it. See [owner-realtor.md](owner-realtor.md).

Currency handling in the forms: the user may type DOP; the form converts to USD with the live rate from `open.er-api.com` (fallback 59.5) before submitting. The API therefore only ever receives USD.

#### Shared / admin components
- `components/listings/ListingDetailPanel.tsx` — right slide-in used by owners and realtors (`role`, `selfManaged`, `openDeal`, `onEdit`, `realtorCalendlyUrl` props). Image carousel, specs, rental rates, videos, 3D tour, rejection reason, pending-edit/deal banners, "Deal of the Week" request form (`canRequestDeal`: active, not already a deal, no pending request, and not a realtor-managed listing viewed by an owner). `components/realtor/ListingDetailPanel.tsx` is a one-line re-export.
- `components/admin/ListingDetailPanel.tsx` — admin panel: full details, approve / reject (reason) / archive, edit, set/clear deal, **assign realtor** (`RealtorCombobox`, `PUT /admin/listings/{id}/assign`), history.
- `components/admin/ListingEditReviewPage.tsx` — the full-page side-by-side current vs proposed review with per-field highlights; approve/reject (with reason). `ListingEditDiffPanel.tsx` is an older slide-out variant and is **unused**.
- `components/admin/ListingHistoryPanel.tsx` — renders `GET /admin/listings/{id}/history`.
- `pages/admin/Approvals.tsx` is an unused mock; the real approval queue is the top of `AdminListings` (pending listings, pending edits, deal requests, active deals).

`AdminListings` loads in two layers: one `Promise.all` for the side sections (pending 200, deals 50, edits, deal requests, activity, realtors, stats) and a separate server-paginated query (`PAGE_SIZE = 50`, status/co-listing/search) for the main table that reloads on filter/page change; `?openId=<listing id>` deep-links a listing panel.

---

### Backend API

#### `realty-api/routes/listings.py` (prefix `/listings`)

| Endpoint | Auth | Notes |
|---|---|---|
| `GET /listings` | public | Paginated active listings -> `ListingPageResponse`. Query: `page`, `page_size` (default 24, max 60), `purpose` (`rent`; `investment` = ROI >= 7), `type`, `region` (substring match on `location`), `min_price`/`max_price` (rent listings are exempt from price filters), `beds` (minimum), `min_roi`, `features` (array containment), `sort` (`new|low|high|roi`), `exclude_ids`, `include_aggregates` (median sale price and average ROI over the filtered set). `_apply_listing_filters` is shared by the item query, the count and the aggregates so they cannot drift. |
| `GET /listings/deal` | public | Active listings with `is_deal`. |
| `GET /listings/{id}` | public (active only) | Returns the listing with `submitted_by_name` = assigned realtor if any, else the submitter. |
| `POST /listings/{id}/view` | public, 5/min | Increments `view_count`. |
| `POST /listings` | realtor / admin / owner | See lifecycle above; generates the share image (errors logged, not fatal). Owner: `transaction` must be `rent`. |
| `PUT /listings/{id}` | submitter / assigned realtor / admin | Active + non-admin -> `ListingEdit` queue (supersedes and deletes any earlier pending edit); otherwise direct update. |
| `DELETE /listings/{id}` | submitter / assigned realtor / admin | Sets `archived`. |
| `GET /listings/mine` | realtor / owner | Unpaginated; owners see `submitted_by` or `owner_id`, realtors see `submitted_by` or `assigned_realtor_id`; includes `leads_count`, `has_pending_deal_request`, `has_pending_edit`. |
| `GET /listings/mine/page` | realtor / owner | Paginated (`page_size` max 200) with `status`, `q`, `pending_review`; ordered by `updated_at desc`. |
| `POST /listings/{id}/deal-request` | realtor / owner | Own active listing only. |
| `POST /listings/upload-images` | realtor / admin / owner, 20/min | <= 25 files, <= 20 MB, magic-byte checked (`filetype`), stored in Supabase Storage (`utils/storage.py`) under `<user_id>/`. |
| `POST /listings/upload-agreement` | realtor / admin, 10/min | PDF <= 10 MB. |

Static routes (`/mine`, `/mine/page`, `/deal`) are declared before `/{listing_id}`; keep that order when adding routes.

#### `realty-api/routes/admin.py` — listing endpoints
Listed in [admin-tools.md](admin-tools.md). Notes specific to listings:
- `approve` only works from `pending_approval` (409 otherwise) and emails the submitter via `send_listing_approved_email`; `reject` and `archive` work from any state; `reject` emails the reason.
- `approve_listing_edit` copies only keys in `EDIT_FIELDS` (module constant) from `proposed_data` onto the listing, skips `null` for the not-null booleans, refreshes the share image if a displayed field changed and logs `edit_approved` with before/after snapshots. `list_listing_edits` returns `current_data` (same field list) next to `proposed_data`.
- `assign` sets `assigned_realtor_id` (realtor or admin only); that user then sees the listing in `/listings/mine`, receives leads/bookings routing based on it (`_build_response` in `routes/leads.py` uses `assigned_realtor_id or submitted_by`) and appears as the public "Listed by" contact.

#### Models and schemas
- `models/listing.py` — enums `listing_status`, `listing_type`, `transaction_type` (Postgres enums, created via Alembic).
- `models/listing_edit.py` — `listing_edits(listing_id, submitted_by, proposed_data JSONB, status, submitted_at, reviewed_by/at, rejection_reason)`; the stored JSON is `ListingUpdate.model_dump(exclude_unset=True)`, so only fields the client sent are present (never change that to `exclude_none` — it would make clearing a field impossible).
- `models/listing_event.py` — append-only audit log (`event_type`, `actor_id`, `note`, `snapshot_before/after`).
- `models/deal_request.py` — `deal_requests` (`discount_value`, `discount_type` `pct|fixed`, `message`, status, reviewer).
- `models/bulk_import_job.py` — `bulk_import_jobs(status, total/processed/succeeded/skipped/failed counts, results JSONB, created_by, created_at, completed_at)`.
- `schemas/listing.py` — `ListingCreate`, `ListingUpdate` (all optional), `ListingResponse`, `AdminListingResponse` (adds submitter/reviewer/assigned-realtor identity), `ListingPageResponse`, `AdminListingPageResponse`, bulk-import schemas; `Bathrooms` = non-negative multiple of 0.5. `schemas/listing_edit.py`, `listing_event.py`, `deal_request.py` (discount type validation, percentage < 100).

---

### Bulk CSV import

Admin-only (`Bulk Import` in the sidebar). Flow: `BulkImportListings.tsx` uploads the CSV (`csv_file`) -> `POST /admin/listings/bulk-import` parses/validates structure synchronously (`utils/bulk_import.parse_csv`; 400 on bad encoding/missing columns/duplicate `source_ref` in the file), creates a `BulkImportJob` and returns **202** -> `run_bulk_import` runs as a FastAPI `BackgroundTask` with its own DB session, one row at a time, committing after every row and updating `processed/succeeded/skipped/failed` and the JSONB `results` -> the page polls `GET /admin/listings/bulk-import/{job_id}` every 3 s.

CSV format (`utils/bulk_import.py`): UTF-8 (BOM ok) or Windows-1252. Required columns: `title, property_type, purpose, region, currency, price, description_en, co_listing_enabled, assigned_agent_id`. Optional: `source_ref, description_es, bedrooms, bathrooms, living_area_sqft, lot_size_sqft, features, listing_tags, photo_urls` (pipe-separated lists), `external_brokerage, external_agent_name, external_agent_email, commission_split_pct, co_listing_notes, co_listing_status`.

Row rules: `source_ref` already in the DB -> `skipped` (idempotent re-runs); `property_type` in `villa|apartment|condo|land|commercial`; `purpose` in `sale|rent|both`; `currency` `USD|DOP`; `assigned_agent_id` is the realtor/admin's numeric **`user_code`** (not a UUID) and becomes `assigned_realtor_id`; the importing admin is `submitted_by`. Unknown region/feature/tag values only add warnings (the constants mirror the dashboard lists in `utils/listing_constants.py` — keep them in sync). Imported listings are created **`active` immediately** (no review), with a `submitted` event noted "Bulk CSV import". Photos are downloaded server-side (max 25, 20 MB, SSRF-guarded: public http(s) hosts only, no redirects to private addresses, max 3 redirects) and re-hosted in Supabase Storage.

### Share-preview images

`realty-api/utils/share_image.py` renders a branded 1200x630 JPEG (first photo, price, FOR SALE/FOR RENT pill, region, beds/baths/area, "I LOVE DR REALTY" wordmark; Mona Sans fonts in `realty-api/assets/fonts/`) and uploads it to `share/<listing_id>.jpg` (stable path, overwritten). It is used as `og:image`/`twitter:image` by `app/listing/[id]/page.tsx`.
- Generated on `POST /listings`, and on edits that change `price, transaction, location, bedrooms, bathrooms, area_sqft, images` (`maybe_regenerate_share_image`, also after edit approval).
- Only fetches photos hosted on the configured Supabase host (SSRF guard); returns `None` if there is no usable first photo, leaving `share_image_url` as is.
- Manual: `POST /admin/listings/{id}/regenerate-share-image` and `POST /admin/listings/regenerate-share-images?only_missing=true` (backfill). No dashboard button exists for either.

---

### Gotchas and risks found in the code

1. **Edits to rental pricing fields are silently dropped on approval.** `EDIT_FIELDS` in `routes/admin.py` does not include `price_per_day`, `price_per_month`, `owner_paypal_email`, `currency`, `co_listing_agreement_accepted` or `co_listing_agreement_url`. When a realtor/owner edits an *active* listing those keys land in `proposed_data`, but approving the edit does not apply them (and `ListingEditReviewPage` does not show them). Direct edits (non-active listings, or admin) do apply them.
2. **Public listing endpoints return private fields.** `ListingResponse` is used for `GET /listings` and `GET /listings/{id}`, so anyone can read `owner_paypal_email`, `owner_id`, `submitted_by`, and the co-listing commission split/notes/agent contact and agreement URL. Consider a trimmed public schema.
3. **`currency` is not honoured anywhere.** Forms always store USD; the landing app ignores `listings.currency`. A bulk-imported `DOP` row keeps its raw number and will be displayed as dollars.
4. **Approval email link is wrong.** `approve_listing` builds `{LANDING_URL}/property?id=<id>`, but the landing routes are `/listing/<id>/` and `/detail?id=<id>`; `/property` does not exist.
5. **Static export means new listings have no `/listing/{id}/` page until the landing site is rebuilt** (share links, canonical URL and sitemap all use that path). `/detail?id=` works immediately. Check the deploy process in [infrastructure.md](infrastructure.md) for how landing rebuilds are triggered.
6. **Direct updates use `exclude_none`**, so a non-active listing (or an admin edit) cannot null a field; only queued edits (`exclude_unset`) can clear values.
7. **Owner "edit" of admin/realtor-created listings** is impossible by design (permission check uses `submitted_by`/`assigned_realtor_id`, not `owner_id`).
8. **The setup gate (scheduling link / PayPal) is enforced only in the UI.** A direct API call creates listings regardless.
9. **Bulk-imported listings have no share image** until the backfill endpoint is called, and the share image prints `$` and `/mo` for every rental regardless of the daily/monthly fields or currency.
10. `GET /listings` filters `purpose=rent` with `transaction == 'rent'`, so `both` listings only appear in unfiltered/sale searches.
