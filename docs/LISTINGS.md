# Listings — File Map

All files that touch listing functionality across the three apps, grouped by layer. Paths are relative to the `realty` repo (`apps/...`) or the `realty-api` repo (`realty-api/...`). For explanations, lifecycle rules and known gotchas see [codebase/listings.md](codebase/listings.md).

---

## Dashboard pages (`apps/dashboard/src/pages`)

### Admin

| File | What it does |
|---|---|
| `admin/Listings.tsx` | Admin listings hub: KPI cards, server-paginated main table (50/page; status, co-listing and text filters), and stacked queues for pending listings, pending edits, deal requests and active deals. Opens the detail panel, review page and history panel; supports `?openId=`. |
| `admin/SubmitListing.tsx` | `AdminSubmitListing` / `AdminEditListing` — full form (all fields, co-listing, both descriptions). New admin listings are `active` immediately; admin edits apply directly with no queue. |
| `admin/BulkImportListings.tsx` | CSV upload page with progress polling and import history (`/admin/listings/bulk-import`). |
| `admin/Approvals.tsx` | **Unused** mock page (static data). The real approval queue is in `admin/Listings.tsx`. |

### Realtor

| File | What it does |
|---|---|
| `realtor/Listings.tsx` | Paginated table of the realtor's own/assigned listings (`/listings/mine/page`), status filters, search, pending-review sidebar, inline `EditListing`. |
| `realtor/SubmitListing.tsx` | `SubmitListing` and `EditListing` — sale and rent forms (daily/monthly rates, EN/ES descriptions, co-listing + agreement PDF). New listings are `pending_approval`; editing an active listing queues a `listing_edits` row. |

### Owner

| File | What it does |
|---|---|
| `owner/Listings.tsx` | Same paginated table plus the assigned-agent banner; "Request change" lead for realtor-managed listings; edit only for listings the owner submitted. |
| `owner/SubmitListing.tsx` | `OwnerSubmitListing` (create/edit) — rental-only form with a single nightly rate and the ten popular regions. |

---

## Dashboard components (`apps/dashboard/src/components`)

| File | What it does |
|---|---|
| `listings/ListingDetailPanel.tsx` | Shared owner/realtor right-hand detail panel (gallery, specs, daily/monthly rates, videos, 3D tour, rejection reason, pending banners, Deal of the Week request). `realtor/ListingDetailPanel.tsx` re-exports it. |
| `admin/ListingDetailPanel.tsx` | Admin panel: full detail, approve / reject / archive, edit, set/clear deal, assign realtor, open history. |
| `admin/ListingEditReviewPage.tsx` | Full-page side-by-side current vs proposed edit review with approve / reject. |
| `admin/ListingEditDiffPanel.tsx` | Older slide-out diff — **unused**. |
| `admin/ListingHistoryPanel.tsx` | Timeline of `listing_events` (actor, note, before/after snapshots). |
| `admin/RealtorCombobox.tsx` | Searchable realtor picker (listing assignment, lead assignment). |
| `dashboard/SetupBanners.tsx` | `useListingSetup` — the front-end gate (scheduling link; PayPal email for owners) controlling every "add listing" button. |
| `RichTextEditor.tsx` | Rich-text field for descriptions and utility notes (output is sanitized with DOMPurify when displayed). |

Other dashboard files: `data/regions.ts` (popular areas + all provinces), `api/listings.ts` (own listings, uploads, deal requests), `api/admin.ts` (admin listing/edit/deal/bulk-import calls).

---

## Landing (`apps/landing/src`)

| File | What it does |
|---|---|
| `api/listings.ts` | `fetchListings` (server-side filters, sort, pagination, aggregates), `fetchListingById`, `fetchDealListings`, `recordListingView`. |
| `api/imgUrl.ts` | Supabase image resizer URL helper for thumbnails. |
| `views/Search.tsx`, `app/search/page.tsx` | Search page, URL-synced filters, 24 per page, "you might also like". |
| `components/SearchFilterSidebar.tsx`, `components/SearchMapSidebar.tsx` | Filter UI; Google Maps pin map. |
| `views/PropertyDetail.tsx` | Detail page, inquiry form, share button, bilingual description, booking widget. |
| `app/listing/[id]/page.tsx` | Statically generated SEO page: metadata, share image, JSON-LD. |
| `app/detail/page.tsx` | Client-side `/detail?id=` route used by in-app links. |
| `views/Landing.tsx`, `hooks/usePlatformStats.ts`, `api/stats.ts` | Home page listings, deals and public platform stats. |
| `data/searchData.ts` | `DR_REGIONS` and coordinates for pins/filters. |
| `app/sitemap.ts`, `app/robots.ts` | SEO plumbing (listing URLs come from the paginated API). |

---

## Backend (`realty-api`)

### Routes

| File | What it does |
|---|---|
| `routes/listings.py` | `GET /listings` (public, paginated + filters + aggregates), `/deal`, `/mine`, `/mine/page`, `/{id}`, `POST /listings`, `PUT /{id}` (queues an edit when the listing is active and the caller is not admin), `DELETE /{id}` (archive), `POST /{id}/view`, `/{id}/deal-request`, `/upload-images`, `/upload-agreement`. |
| `routes/admin.py` | Listing review (`approve/reject/archive/assign`), `listing-edits`, `deal-requests`, `set-deal`/`clear-deal`, history, `bulk-import`, share-image regeneration, `/admin/listings` (paginated), plus users/leads-adjacent admin endpoints. |
| `routes/chat.py` | `GET /public/chat/listings` — unauthenticated, rate-limited (30/min) listing search for a chatbot; returns a formatted text message and links to `/listing/{id}`. |
| `routes/stats.py` | `GET /stats/platform` — public counts used on the landing page. |

### Models and schemas

| File | What it does |
|---|---|
| `models/listing.py` | `Listing` table (see column groups in codebase/listings.md). |
| `models/listing_edit.py` | `ListingEdit` — pending/approved/rejected edit with `proposed_data` JSONB. |
| `models/listing_event.py` | `ListingEvent` audit log. |
| `models/deal_request.py` | `DealRequest` (Deal of the Week requests). |
| `models/bulk_import_job.py` | `BulkImportJob` — CSV import progress and per-row results. |
| `schemas/listing.py` | `ListingCreate/Update/Response`, `AdminListingResponse`, `ListingPageResponse`, `AdminListingPageResponse`, bulk-import schemas. `ListingUpdate` is all-Optional and dumped with `exclude_unset=True` for the edit queue. |
| `schemas/listing_edit.py`, `listing_event.py`, `deal_request.py` | Edit review, history and deal-request payloads. |

### Utilities

| File | What it does |
|---|---|
| `utils/bulk_import.py` | CSV parsing/validation and the background import runner (photo download with SSRF guard). |
| `utils/listing_constants.py` | Region, feature and tag lists mirrored from the dashboard (used only for import warnings). |
| `utils/share_image.py` | Renders the 1200x630 share-preview JPEG; `maybe_regenerate_share_image`. |
| `utils/storage.py` | Supabase Storage uploads (`upload_image`, `upload_share_image`, `upload_pdf`, `upload_avatar`). |
| `assets/fonts/` | Mona Sans files used by the share image. |

---

## How the main flows connect these files

```
Realtor/owner creates a listing
  → pages/{realtor,owner}/SubmitListing.tsx → api/listings.ts submitListing()
  → routes/listings.py POST /listings  (status=pending_approval, ListingEvent "submitted", share image)

Realtor/owner edits an ACTIVE listing
  → SubmitListing.tsx (EditListing / OwnerSubmitListing) → updateListing() → PUT /listings/{id}
  → routes/listings.py  (deletes older pending edit, inserts ListingEdit with exclude_unset data)

Admin reviews
  → pages/admin/Listings.tsx (queues) → components/admin/ListingEditReviewPage.tsx
  → api/admin.ts approveListingEdit()/rejectListingEdit()
  → routes/admin.py  (applies only EDIT_FIELDS keys, refreshes share image, logs ListingEvent + ActivityLog)

Admin views history
  → components/admin/ListingHistoryPanel.tsx → api/admin.ts getListingHistory()
  → routes/admin.py GET /admin/listings/{id}/history → models/listing_event.py

Admin bulk import
  → pages/admin/BulkImportListings.tsx → POST /admin/listings/bulk-import (202)
  → utils/bulk_import.run_bulk_import (BackgroundTask) → models/bulk_import_job.py (polled every 3 s)

Public browse
  → views/Search.tsx → api/listings.ts fetchListings() → GET /listings (page_size 24)
  → views/PropertyDetail.tsx → GET /listings/{id}; share/OG data from app/listing/[id]/page.tsx
```
