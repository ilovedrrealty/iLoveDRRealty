# Backend — Remaining Work

Only pending backend work is described here. Implemented detail lives in `docs/archive/plan_v6/backend.md`.

> Appended 2026-10-10: the "Phases 39–53" section directly below documents backend work shipped Jul 2 – Sep 18 2026 (all complete). Open backend items are further down (Phase 28 newsletter, Phase 24 remainder, Phase 26 delete-confirm).

---

## Phases 39–53 — Implemented Aug–Sep 2026 (all `[COMPLETE]`, repo `realty-api`)

Alembic chain order, oldest to newest of this period (single head: `bc364345c64b`):
`n2o3p4q5r6s7` → `o3p4q5r6s7t8` → `p4q5r6s7t8u9` → `q5r6s7t8u9v0` → `r6s7t8u9v0w1` → `s7t8u9v0w1x2` → `t8u9v0w1x2y3` → `u9v0w1x2y3z4` → `ed856ef1081c` → `7c5858ba04a9` → `4f1c3506e1d4` → `0049637f62fa` → `b813c2be2e88` → `f9901a9c3ae1` → `6c8499222d3a` → `bc364345c64b`.

| Revision | Adds |
|---|---|
| `o3p4q5r6s7t8` | `listings.share_image_url` |
| `p4q5r6s7t8u9` | `listings.assigned_realtor_id` |
| `q5r6s7t8u9v0` | `listings.source_ref` (unique), `listings.currency` (default `USD`), `listings.co_listing_agent_email` |
| `r6s7t8u9v0w1` | `bulk_import_jobs` table |
| `s7t8u9v0w1x2` | data backfill of NULL `users.user_code` |
| `t8u9v0w1x2y3` | `listings.description_es` |
| `u9v0w1x2y3z4` | index on `listings(status, created_at)` |
| `ed856ef1081c`, `7c5858ba04a9`, `4f1c3506e1d4`, `0049637f62fa`, `b813c2be2e88`, `f9901a9c3ae1`, `6c8499222d3a`, `bc364345c64b` | The PayPal-branch schema: rental prices / co-listing PDF / Calendly, brokerage email + phone, `users.assigned_realtor_id`, `users.paypal_email`, booking payment fields, guest booking fields, payout fee fields, `listings.owner_paypal_email`. Re-keyed when `feature/paypal` was merged into `dev` (the older numbered IDs quoted in the Phase 38 notes below are stale) and made idempotent in `365dead` (`ADD COLUMN IF NOT EXISTS` / `DROP … IF EXISTS`) because production already had these columns. |

### Phase 41 — API start on a brand-new database (2026-08-18) + `user_code`
- **`bootstrap_db.py`** (new) runs before `alembic upgrade head` in both `Procfile` and `Dockerfile`. On a database with no tables it calls `Base.metadata.create_all()`; if `alembic_version` exists it is a no-op; if tables exist without `alembic_version` it refuses and asks for an explicit `alembic stamp`. It deliberately does not stamp, so the whole migration chain still runs (some schema, e.g. `users_user_code_seq`, exists only in migrations).
- Six older migrations guarded with `IF NOT EXISTS` so the chain works on a `create_all` schema.
- **`models/user.py`**: `user_code` now declares `Sequence('users_user_code_seq')`; previously SQLAlchemy sent an explicit NULL, overriding the DB default, so new users got no code.
- **`s7t8u9v0w1x2`** (2026-09-14) backfills accounts created while `user_code` was NULL, without touching codes already in use.

### Phase 43 — Platform stats (2026-09-07)
- **`GET /stats/platform`** (`routes/stats.py`, public, no auth) → `{ active_listings, total_value, realtors, registered_users }`. `total_value` = sum of `price` over `status='active'` listings; `realtors` = active realtors; `registered_users` = all non-admin users.

### Phase 44 — Branded share image (2026-09-07)
- **`utils/share_image.py`** renders a 1200×630 card (Pillow + Mona Sans fonts in `assets/fonts/`, `Pillow` added to `requirements.txt`) from the listing's first photo plus price, beds/baths, location. Source photos are only fetched over https from the configured Supabase storage host (SSRF guard, no redirects, 20 MB cap). Uploaded through `utils/storage.upload_share_image`; stored in `listings.share_image_url`.
- Generated on listing create and on edit/approval when a field in `SHARE_IMAGE_FIELDS` changed (`maybe_regenerate_share_image`).
- Admin: `POST /admin/listings/{id}/regenerate-share-image` (204) and `POST /admin/listings/regenerate-share-images?only_missing=true` (bulk, returns a summary).

### Phase 47 — Admin reassign listing (2026-09-10)
- **`PUT /admin/listings/{listing_id}/assign`** (admin only, 204), body `{ realtor_id: uuid | null }`. Target must be role `realtor` or `admin` (404 otherwise); `null` unassigns. Writes activity-log entries (`listing_assigned` / `listing_unassigned`) and listing events (`realtor_assigned` / `realtor_unassigned`).
- `Listing.assigned_realtor_id` is honoured in `routes/listings.py`, `leads.py` and `inquiries.py` (visibility, inquiry/lead routing, edits; public contact shows the assigned realtor). `AdminListingResponse` gained `assigned_realtor_name` / `assigned_realtor_email`.

### Phase 48 — CSV bulk import (2026-09-14/15)
- **`POST /admin/listings/bulk-import`** (admin only, multipart `csv_file`) → 202 `BulkImportJobResponse`; work runs in a FastAPI background task (`utils/bulk_import.run_bulk_import`). **`GET /admin/listings/bulk-import`** (last 20 jobs) and **`GET /admin/listings/bulk-import/{job_id}`** (progress + per-row results).
- Required columns: `title, property_type, purpose, region, currency, price, description_en, co_listing_enabled, assigned_agent_id`. Decoding tries UTF-8 (with BOM) then Windows-1252 (Excel "CSV"). Duplicate `source_ref` inside a file blocks the whole import (400); a `source_ref` already in the DB is skipped (dedup via the unique column). Currency `USD`|`DOP`; types villa/apartment/condo/land/commercial; purposes sale/rent/both. Unknown regions/features/tags only warn (`utils/listing_constants.py`).
- Photos are downloaded server-side with a private/loopback/link-local IP guard, 20 MB cap, 25 photos per listing.
- `description_es` stored; the co-listing agent's contact field is populated from `co_listing_agent_email` and both new fields flow through the pending-edit tracker. `bulk_import_jobs` columns: status, total/processed/succeeded/skipped/failed counts, `results` JSONB, `created_by`, timestamps.

### Phase 49 — Server-side pagination (2026-09-15)
- **`GET /listings`** (public) now returns `ListingPageResponse { items, total, page, page_size, median_price, avg_roi }`. Query: `page`, `page_size` (default 24, max 60), `purpose`, `type`, `region`, `min_price`, `max_price`, `beds`, `min_roi`, `features[]`, `sort` (`new|low|high|roi`), `include_aggregates` (default true; the landing build passes `false` to skip the median/avg queries). Rent listings are exempt from the sale-price filter. One `_apply_listing_filters` helper feeds the item, count and aggregate queries. **Breaking change for any client that parsed a bare array.**
- **`GET /listings/mine/page`** (realtor/owner) — paginated "My Listings" (`page`, `page_size` default 50 / max 200, `status`, `q`, `pending_review`). `GET /listings/mine` is unchanged and unpaginated (home-dashboard widgets rely on it).
- **`GET /admin/listings`** now returns `AdminListingPageResponse { items, total, page, page_size }` (page_size default 50, max 500) with `status`, `exclude_status`, `co_listing_enabled`, `is_deal`, `q` (title/location) filters. New **`GET /admin/listings/{id}`**. Admin stats now also return `archived_listings` and `rejected_listings`.
- `u9v0w1x2y3z4` adds the `(status, created_at)` index.

### Phase 50 — Session lifetime (2026-09-15)
- `utils/jwt.py` `TOKEN_EXPIRE_HOURS` 1 → 24; `routes/auth.py` cookie `max_age` is derived from it.

### Phase 51 — Double-booking prevention + PayPal go-live (2026-09-18)
- **`routes/bookings.py`**: `_blocked_ranges()` returns committed stays (confirmed `Booking` rows plus accepted/`closed` booking Leads with no Booking row of their own, so a Booking's status stays the source of truth). `_dates_available()` uses half-open ranges (a guest may check in on another's check-out day). Overlaps return **409** with `DATES_TAKEN_MSG` on `POST /bookings/create-payment-auth` (before PayPal authorization), on `POST /bookings`, and on `PUT /bookings/{id}/accept` (booking path and lead path, both under `_lock_listing()` which serialises concurrent accepts per listing). `GET /bookings/unavailable/{listing_id}` reuses `_blocked_ranges`. Logged-in users also get 409 for their own overlapping booking.
- Merge commit `83df4be` brings `feature/paypal` into `dev` (payments, guest bookings, payouts, availability).
- `config.py` still defaults `paypal_mode` to `"sandbox"`; the payout cron (`main.py`) is a no-op while `PAYPAL_CLIENT_ID` is empty.

### Phase 52 — Admin bookings include guest-request leads (2026-09-18)
- `GET /admin/bookings` also returns booking Leads with `from_user_id IS NULL` that have no linked Booking row (via `routes.bookings._lead_to_booking_response`), `owner_name` filled from the listing owner, whole list re-sorted by `created_at DESC`.

### Phase 53 — Scheduling provider naming in emails (2026-09-18)
- `users.calendly_url` now holds either a Calendly or a Google Calendar appointment link (no schema change). `utils/email.py` `_is_google_scheduling_url()` (hosts `calendar.app.google`, `calendar.google.com`) picks the label in the lead-assigned email; the button `href` is HTML-escaped.

### Housekeeping
- 2026-07-02: Railway health-check 404s silenced (`/health` also accepts POST, `POST /` handled) and GHL webhook log noise reduced (`main.py`, `routes/webhooks.py`).

---

## Phase 38 — Admin Bookings & Request Payout (post-archive additions)

### `realty-api/main.py` — payout cron bug fix
- Line in the payout `try` block logged `owner.paypal_email`, but `owner` is only queried in the fallback branch when `listing.owner_paypal_email` is absent.
- For realtor-submitted listings where `listing.owner_paypal_email` is the primary source, `owner` is never assigned → `NameError` → `except` caught it → `payout_status = 'failed'` even though PayPal payout succeeded.
- Fix: changed `owner.paypal_email` to `payout_email` in the log line.

### `realty-api/utils/email.py` — new function
- Added `send_payout_request_email(to_email, owner_name, listing_title, check_in, check_out, total_price, payout_amount)`.
- Uses existing `_send()` + `_email_wrap()` pattern. Sends HTML table with booking details and a dashboard link.

### `realty-api/schemas/booking.py`
- Added `owner_name: Optional[str] = None` to `BookingResponse`.

### `realty-api/routes/bookings.py`
- Updated `_booking_response()` helper to accept and pass through `owner_name`.
- Added `POST /bookings/{id}/request-payout` (status 204):
  - Auth: `get_current_user` (owner or realtor of the listing).
  - Validates `booking.payout_status == 'failed'`; 400 otherwise.
  - Resolves admin notify email via `_notify_email(db)`; 503 if not configured.
  - Calls `send_payout_request_email()` with owner name, listing title, dates, total, payout amount.

### `realty-api/routes/admin.py`
- Added `GET /admin/bookings` (admin only):
  - Joins `Booking → Listing → User (guest) → User aliased as Owner`.
  - Returns `List[BookingResponse]` ordered by `created_at DESC` (corrected from initial `check_out DESC`).
  - Populates `owner_name` from the aliased Owner join.

---

## Phase 38 — PayPal Go-Live Prerequisites

All code is implemented. Pending external setup before going live:

```
Railway env vars required:
  PAYPAL_CLIENT_ID=...
  PAYPAL_CLIENT_SECRET=...
  PAYPAL_WEBHOOK_ID=...
  PAYPAL_MODE=sandbox

Vercel env var:
  NEXT_PUBLIC_PAYPAL_CLIENT_ID=...

Alembic (run on Railway):
  alembic upgrade head
  -- applies: o3p4q5r6s8t9, p4q5r6s7t8u9, q5r6s7t8u9v0, r6s7t8u9v0w1, s7t8u9v0w1x2
```

**Status update 2026-10-10 (verified against the repos):**
- Commit `90f3dce` (2026-09-18) states the PayPal credentials are now configured on Vercel and Railway, and flips `PAYPAL_ENABLED` to `true` in both frontends.
- The migration IDs listed above are stale (see the chain table in "Phases 39–53"). `Procfile` and `Dockerfile` run `bootstrap_db.py && alembic upgrade head` on every start, so there is no separate manual migration step; the PayPal-branch migrations were made idempotent in `365dead` specifically so production (which already had the columns, with `alembic_version` at `u9v0w1x2y3z4`) would not crash-loop.
- **Confirm (not provable from the repo):** Railway `PAYPAL_MODE` (code default is `sandbox`; set `live` with live credentials for real payments), `PAYPAL_WEBHOOK_ID` matches a registered webhook, PayPal Payouts API access approved, and `alembic_version` on production is at `bc364345c64b`.

---

## Phase 38 — Dual-Pricing Bug Fixes & Booking Calendar

### `realty-api/routes/bookings.py`
- **Bug fix — price field mismatch**: `create_booking` was computing `total` from `listing.price` (which stores the monthly rate on some listings) instead of `listing.price_per_day`. This caused the PayPal amount-mismatch guard to void valid authorizations. Fixed: `price_per_day = float(listing.price_per_day) if listing.price_per_day else None`.
- **Bug fix — calendar blocking**: `get_unavailable_dates` only queried Lead rows with `status == "closed"`. Accepting a platform booking sets `booking.status = "confirmed"` but never closes the lead. Added a second query: `Booking` rows with `status == "confirmed"` are now also returned as blocked ranges.

### `realty-api/main.py`
- **Bug fix — month-end cron crash**: `tomorrow.replace(day=tomorrow.day + 1)` raised `ValueError` on Jan 31, Mar 31, etc. Fixed: `tomorrow += timedelta(days=1)`.
- **Bug fix — connection leak**: `db.close()` was inside the `try` block; an exception before `commit()` left the connection open. Moved `db = SessionLocal()` before `try` and `db.close()` to a `finally` block.

---

## Phase 38 — Email Notifications (implemented)

### `realty-api/utils/email.py` — 6 new functions

All use the existing `_send()` + `_email_wrap()` pattern.

| Function | Recipient | Trigger |
|---|---|---|
| `send_booking_submitted_email(to_email, guest_name, listing_title, check_in, check_out, guests, total_price, is_paypal)` | Guest | On `POST /bookings` |
| `send_booking_confirmed_email(to_email, guest_name, listing_title, check_in, check_out, total_price)` | Guest | On `PUT /{id}/accept` |
| `send_booking_declined_email(to_email, guest_name, listing_title, check_in, check_out)` | Guest | On `PUT /{id}/decline` |
| `send_owner_new_booking_email(to_email, owner_name, guest_name, listing_title, check_in, check_out, guests)` | Owner + Realtor | On `POST /bookings` |
| `send_owner_payout_released_email(to_email, owner_name, listing_title, check_in, check_out, payout_amount)` | Owner (platform user only) | On cron payout success |
| `send_admin_payout_failed_email(to_email, listing_title, booking_id, payout_email, payout_amount)` | Admin notify address | On cron payout exception |

### `realty-api/routes/bookings.py` — wiring

- **`POST /bookings`** (`create_booking`):
  - After `send_lead_notification`, fires `send_booking_submitted_email` to guest (fire-and-forget, `try/except`).
  - Resolves `listing.owner_id` → notifies owner if they have a platform account.
  - Resolves `listing.submitted_by` → also notifies realtor/submitter if different from the owner.
  - Both owner and realtor notifications wrapped in a single `try/except`.
- **`PUT /{id}/accept`** (`accept_booking`):
  - Booking path: queries `User` by `b.buyer_id` for email; falls back to `b.guest_email` for PayPal-guest bookings. Fires `send_booking_confirmed_email`.
  - Lead-only path: parses dates from `lead.message` via `_DATE_RANGE_RE`; fires `send_booking_confirmed_email` with `total_price=None`.
  - Changed `b, _ = row` to `b, listing = row` to have the listing title available.
- **`PUT /{id}/decline`** (`decline_booking`):
  - Same guest-email resolution pattern as accept. Fires `send_booking_declined_email`.
  - Changed `b, _ = row` to `b, listing = row`.

### `realty-api/main.py` — payout cron

- Added `from utils.email import send_owner_payout_released_email, send_admin_payout_failed_email` (lazy import inside `_payout_cron`).
- Payout email resolution now stores the queried `User` as `owner_user`; used for both PayPal email and notification email.
- On success: fires `send_owner_payout_released_email` to `owner_user.email` (skipped for off-platform owners who have no User row).
- On exception: fires `send_admin_payout_failed_email` to `settings.notify_email` if configured.

---

## Phase 28 — Content Marketing Engine (newsletter endpoint)

**`POST /public/newsletter`** (unauthenticated, rate-limited)
- Body: `{ email: EmailStr }`
- Validate the email; forward to provider (Resend audience list / GHL contact with `newsletter` tag).
- Return `{ ok: true }`.
- Rate-limit to match `/public/chat/listings` (same pattern in `main.py`).

---

## Phase 24 — Admin Site Settings

> **Partially built (verified 2026-10-10).** Migration `l3m4n5o6p7q8` created the `settings` table; `models/site_settings.py` (`SiteSettings`) exists; `GET /admin/settings` and `PUT /admin/settings` (204) are implemented in `routes/admin.py` but handle **only `notify_email`** (the admin address used for payout-failure emails). The remaining fields below (`contact_email`, `platform_name`, `deal_of_week_enabled`, `featured_listing_count`) and a `schemas/settings.py` are still to do. The sections below are the original plan for the full version.

### Migration — `add_settings_table`
```sql
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO settings (id, data) VALUES (1, '{}') ON CONFLICT DO NOTHING;
```

### `models/settings.py` (new)
```python
class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, default=1)
    data = Column(JSONB, nullable=False, server_default="{}")
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
```

### `schemas/settings.py` (new)
```python
class PlatformSettings(BaseModel):
    contact_email: Optional[str] = None
    platform_name: str = "I Love DR Realty"
    deal_of_week_enabled: bool = True
    featured_listing_count: int = 4
    # Phase 23 GHL fields (extend here when building the GHL tab):
    # ghl_enabled: bool = False
    # ghl_api_key: Optional[str] = None
    # ghl_location_id: Optional[str] = None

class PlatformSettingsResponse(PlatformSettings):
    updated_at: Optional[datetime] = None
```

### `routes/admin.py` — new endpoints
- `GET /admin/settings` (admin only) — fetch row id=1; return defaults if absent.
- `PUT /admin/settings` (admin only) — body `PlatformSettings`; upsert row id=1; return `PlatformSettingsResponse`.

---

## Phase 26 — Account Deactivation / Deletion (remaining)

### `POST /auth/me/delete-confirm` (not yet implemented — re-verified 2026-10-10: `routes/auth.py` has only `delete-request`)
- Auth required.
- Check `user.deletion_requested_at` is set and the 30-day grace period has passed.
- Hard-delete the user row.
- Before deletion: anonymize associated leads (null out PII fields) and listings (set `owner_id = NULL` or mark deleted).
- Return 204.

---

## Phase 23 — GoHighLevel CRM (no backend remaining)

Two-way sync, HMAC webhook, and all lead status hooks are live. No further backend work — the Admin Settings GHL tab is a frontend task that extends the Phase 24 `PUT /admin/settings` endpoint with `ghl_enabled`, `ghl_api_key`, `ghl_location_id` fields.
