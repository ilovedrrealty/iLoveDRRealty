# API Reference

**Status:** Live. Verified against the code in `realty-api` (October 2026). The code is the source of truth; when this file and the code disagree, trust the code and fix this file.

**Base URL:** `https://api.ilovedrrealty.com` (production) / `http://localhost:8000` (local dev)
**Stack:** FastAPI + SQLAlchemy + Alembic, Supabase Postgres + Storage, Resend (email), PayPal REST v2, GoHighLevel (GHL) CRM
**Interactive docs:** FastAPI serves Swagger at `/docs` and OpenAPI JSON at `/openapi.json`.
**Related:** [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODELS.md](DATA_MODELS.md), [ENV.md](ENV.md), [ROLES.md](ROLES.md)

---

## Contents

1. [Conventions](#conventions) (auth, errors, pagination, rate limits, CORS)
2. [Endpoint reference](#endpoint-reference): Auth, Listings, Bookings, Leads, Inquiries, Saved homes, Upgrade requests, Public / stats / chat, Admin, Webhooks, Health
3. [Background jobs](#background-jobs)
4. [External integrations](#external-integrations) (PayPal, GHL, Resend, Supabase Storage)
5. [Gotchas and known risks](#gotchas-and-known-risks)

---

## Conventions

### Authentication

| Item | Value |
|------|-------|
| Mechanism | Self-issued JWT (HS256, signed with `JWT_SECRET`). Supabase Auth is **not** used; users, passwords (hashed) and Google sign-in are handled by this API. |
| Primary transport | HttpOnly cookie `ildr_token`, set by `/auth/login`, `/auth/verify`, `/auth/google`, `/auth/refresh`. |
| Alternative transport | `Authorization: Bearer <jwt>` header. If both are sent, the header wins. |
| Lifetime | **24 hours** (`TOKEN_EXPIRE_HOURS = 24`). Cookie `max_age` matches. There is no sliding session; the client calls `POST /auth/refresh` to mint a new token. |
| Cookie attributes | `HttpOnly`, `Path=/`. Production: `Secure` + `SameSite=None`. Non-production: `SameSite=Lax`, not `Secure`. `Domain` = `COOKIE_DOMAIN` env (set to `.ilovedrrealty.com` in production so landing and dashboard subdomains share it; empty = host-only). |
| JWT payload | `sub` (user id), `role`, `email`, `exp`. **Only `sub` is used** server-side; role and status are re-read from the database on every request, so role changes and suspensions take effect immediately. |
| Per-request checks | User must exist, `email_verified = true`, `status = active`. Otherwise `401` (no/invalid token, unknown user) or `403` (unverified, suspended). |
| Roles | `buyer`, `owner`, `realtor`, `admin`. Enforced per endpoint by `require_role(...)` / `require_admin`, or by inline ownership checks. |

Auth column legend used below: **Public** = no auth; **Optional** = works anonymously, enriches the record when a valid session is present; **Any user** = any authenticated, active, verified user; otherwise the required role(s).

### Error format

Errors raised by the API use FastAPI's standard shape:

```json
{ "detail": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Business-rule failure (wrong state, bad CSV, invalid code) |
| `401` | Missing/invalid token, bad credentials |
| `402` | PayPal authorization failed (booking creation) |
| `403` | Wrong role, not the owner of the resource, suspended or unverified account |
| `404` | Not found (also used to hide resources the caller does not own) |
| `409` | Conflict (duplicate, already reviewed, dates taken) |
| `413` / `415` | Upload too large / unsupported type |
| `422` | Validation failure. For Pydantic errors `detail` is an **array** of `{loc, msg, type}`; for hand-raised 422s it is a string. |
| `429` | Rate limit hit. Body is `{"error": "Rate limit exceeded: 3 per 1 minute"}` (slowapi default, **not** `detail`), or `{"detail": ...}` for the hand-rolled resend cooldowns. |
| `502` / `503` | Upstream failure (Google, PayPal) / feature not configured |

### Pagination

Only a few list endpoints are paginated. They use **1-based `page` + `page_size`** and return an envelope:

```json
{ "items": [ ... ], "total": 120, "page": 1, "page_size": 24 }
```

| Endpoint | Default `page_size` | Max |
|----------|--------------------:|----:|
| `GET /listings` (adds `median_price`, `avg_roi`) | 24 | 60 |
| `GET /listings/mine/page` | 50 | 200 |
| `GET /admin/listings` | 50 | 500 |

`total` is the count of the filtered set (not just the page). Everything else returns a **bare JSON array with no pagination** (users, leads, bookings, inquiries, upgrade requests, deal requests, edits, `GET /listings/mine`, `GET /listings/deal`). There are no `limit` / `offset` params anywhere (except `limit` on `/admin/activity-log`).

### Rate limiting

slowapi, keyed by client IP (`get_remote_address`), in-memory per process. Only the endpoints marked in the tables below are limited; there is no global limit. Limits are per IP per minute.

### CORS and headers

- Allowed origins: `ALLOWED_ORIGINS` env (comma-separated). `*` or an empty entry aborts startup because credentials are allowed.
- `allow_credentials=true`; methods `GET, POST, PUT, DELETE, OPTIONS`; headers `Content-Type, Authorization`.
- Every response carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; `Strict-Transport-Security` only when `ENVIRONMENT=production`.

### Identifiers and enums

- IDs are UUID strings. `user_code` is a sequential human-readable integer (used by admins and the CSV import to reference users).
- User role: `buyer | owner | realtor | admin`. User status: `active | suspended`.
- Listing status: `draft | pending_approval | active | rejected | archived`. `type`: `villa | apartment | condo | land | commercial`. `transaction`: `sale | rent | both`.
- Booking status: `pending | confirmed | cancelled`. `payment_status`: `unpaid | authorized | captured | voided | refunded`. `payout_status`: `pending | paid | failed`.
- Lead `type`: `property_inquiry | buyer_interest | seller_interest | booking`. Lead `status`: `new | assigned | contacted | closed` (see the lead-status note under Leads for two extra values in use).

---

## Endpoint reference

### Auth (`/auth`)

| Method + path | Auth | Rate limit | Description |
|---|---|---|---|
| `POST /auth/register` | Public | 3/min | Start signup. Body: `display_name` (1-100), `email`, `password` (8-128), `phone?`. Stores a row in `pending_users` (no `users` row yet), emails a 6-digit code (valid 15 min). Returns `201 {email, message}`. `409` if a verified account already has that email (so this **does** reveal account existence). `429` if a code was sent < 60 s ago. Pending rows live 48 h. |
| `POST /auth/verify` | Public | 10/min | Body `{email, code}`. Max 5 wrong attempts (`429`), then request a new code. On success promotes the pending row to a `users` row (`role = buyer`, `email_verified = true`), sets the auth cookie. Returns `{expires_in}` (seconds). |
| `POST /auth/resend-code` | Public | 5/min | Body `{email}`. Generic message whether or not the email is pending. `429` within the 60 s cooldown. |
| `POST /auth/login` | Public | 10/min | Body `{email, password}`. Sets cookie, returns `{expires_in}`. `401` bad credentials; `403` if pending verification, suspended, or unverified. |
| `POST /auth/google` | Public | none | Body `{access_token}` (a Google OAuth **access token**, validated by calling Google's userinfo endpoint; requires verified email). Links to an existing account with the same email, or creates a verified `buyer` directly (skips `pending_users`). `403` if suspended. Sets cookie. |
| `POST /auth/logout` | Public | none | Clears the cookie. |
| `POST /auth/refresh` | Any user | none | Re-issues the token/cookie (24 h again). |
| `GET /auth/me` | Any user | none | `{id, user_code, email, role, display_name, phone, avatar_url, calendly_url, paypal_email, has_password, has_google}`. |
| `PUT /auth/me` | Any user | 20/min | Body: `display_name` (required), `phone?`, `calendly_url?` (<= 500), `paypal_email?`. This is a full replace: omitted optional fields are **set to null**. `calendly_url` stores either a Calendly link or a Google Calendar appointment page; the provider is inferred from the host (`calendar.app.google` / `calendar.google.com` = Google) and only affects email wording. Response echoes only `{display_name, phone, calendly_url}`. |
| `POST /auth/avatar` | Any user | 10/min | `multipart/form-data`, field `file`. JPEG/PNG/WebP detected by magic bytes, max 5 MB (`413`/`415`). Uploads to Supabase Storage, deletes the previous avatar. Returns `{avatar_url}`. |
| `PUT /auth/password` | Any user | 5/min | Body `{current_password, new_password}`. `400` for Google-only accounts (use set-password). |
| `POST /auth/set-password` | Any user | 5/min | Body `{new_password}`. Only for accounts without a password (Google signups); `400` otherwise. |
| `POST /auth/link-google` | Any user | none | Body `{access_token}`. Links a Google identity; `409` if it belongs to another user. |
| `DELETE /auth/unlink-google` | Any user | none | `400` if no Google linked or no password set. |
| `POST /auth/forgot-password` | Public | 3/min | Body `{email}`. Always returns a generic message. If the user exists: stores a SHA-256 hash of a random token (valid 1 h) and emails `{LANDING_URL}/reset-password?token=...`. |
| `POST /auth/reset-password` | Public | 5/min | Body `{token, new_password}`. `400` if invalid/expired. Clears the token and sends a "password changed" email. Does not invalidate existing sessions. |
| `GET /auth/me/agent` | Any user | none | For `owner`: the assigned realtor `{realtor_id, realtor_name, realtor_email, realtor_phone, realtor_calendly_url}` (direct `assigned_realtor_id` first, else the realtor on the user's most recent assigned lead). All-null for other roles. |
| `PUT /auth/me/deactivate` | Any user | none | Sets own `status = suspended` and clears the cookie. `204`. Only an admin can reactivate. |
| `POST /auth/me/delete-request` | Any user | none | Stamps `deletion_requested_at`; **no automated deletion** (manual process). `204`. |

---

### Listings (`/listings`)

Listing response object (`ListingResponse`): `id, title, description, description_es, type, transaction, price, currency (USD|DOP), location, bedrooms, bathrooms (0.5 steps), area_sqft, lot_size_sqft, roi, seller_financing, hoa, hoa_fee, tax_exempt, gated_community, construction_status, year_built, features[], maps_url, latitude, longitude, tag, tags[], video_links[], tour_3d_url, utilities, included_utilities[], association_fee, deposit_policy, images[], share_image_url, status, rejection_reason, is_deal, deal_discount_value, deal_discount_type (pct|fixed), view_count, price_per_day, price_per_month, owner_paypal_email, source_ref, co_listing_* (enabled, brokerage, agent_name, agent_contact, agent_email, brokerage_email, brokerage_phone, commission_split, notes, status, agreement_accepted, agreement_url), leads_count, has_pending_deal_request, has_pending_edit, created_at, updated_at, submitted_by, submitted_by_name, owner_id, assigned_realtor_id`. `leads_count`, `has_pending_*` are only populated by the `/mine` endpoints. `submitted_by_name` is only populated by `GET /listings/{id}` and `/mine*`.

| Method + path | Auth | Description |
|---|---|---|
| `GET /listings` | Public | Paginated search of **active** listings. Returns `{items, total, page, page_size, median_price, avg_roi}`. Query params below. |
| `GET /listings/deal` | Public | All active listings with `is_deal = true` (Deal of the Week). Bare array. |
| `GET /listings/{id}` | Public | One **active** listing (`404` for any other status). `submitted_by_name` is the assigned realtor if one exists, else the submitter. |
| `POST /listings/{id}/view` | Public, 5/min | Increments `view_count` on an active listing. `204`; silent no-op if not found/inactive. |
| `GET /listings/mine` | realtor, owner | Complete unpaginated list of the caller's listings (any status) with `leads_count`, `has_pending_deal_request`, `has_pending_edit`, `submitted_by_name`. Owners: `submitted_by = me` or `owner_id = me`. Realtors: `submitted_by = me` or `assigned_realtor_id = me`. Used by dashboard home widgets. |
| `GET /listings/mine/page` | realtor, owner | Paginated variant. Params: `page`, `page_size` (<= 200), `status`, `q` (title/location substring), `pending_review` (bool: only listings with a pending deal request or pending edit). Ordered by `updated_at` desc. |
| `POST /listings` | realtor, admin, owner | Create. Body = `ListingCreate` (same fields as the response, minus server-managed ones; required: `title, type, transaction, price, location`). Owners may only create `transaction = rent` (`422`). Status is `active` for admins, `pending_approval` for everyone else. Records a `submitted` listing event and generates the share image (best effort; failure is logged and ignored). Returns `201` listing. No admin notification email is sent on submission. |
| `PUT /listings/{id}` | Any user who is `submitted_by`, `assigned_realtor_id`, or admin | Partial update (`ListingUpdate`). **If the listing is `active` and the caller is not an admin, the change is NOT applied**: it is stored as a pending `ListingEdit` (replacing any earlier pending edit) and the unchanged listing is returned with `200`; an admin must approve it. Otherwise it is applied in place; fields sent as `null` are ignored (you cannot clear a field this way); editing a `rejected` listing moves it back to `pending_approval` and clears `rejection_reason`. Share image is regenerated when price/transaction/location/beds/baths/area/images change. |
| `DELETE /listings/{id}` | Same as PUT | Soft delete: `status = archived`. `204`. |
| `POST /listings/{id}/deal-request` | realtor, owner | Ask admin to feature the listing as Deal of the Week. Caller must be `submitted_by` or `assigned_realtor_id` (`403`), listing must be `active` (`400`), not already a deal (`409`), no other pending request by the caller (`409`). Body `{discount_value > 0, discount_type: pct|fixed (default pct, pct < 100), message?}`. `201`. |
| `POST /listings/upload-images` | realtor, admin, owner (20/min) | `multipart/form-data`, field `files` (repeat). Max 25 files, 20 MB each; JPEG/PNG/WebP/HEIC by magic bytes. Returns `{urls: [...]}` (Supabase public URLs); URLs are then passed in `images` on create/update. |
| `POST /listings/upload-agreement` | realtor, admin (10/min) | `multipart/form-data`, field `file`. PDF only (checked by filename extension), max 10 MB. Returns `{url}` for `co_listing_agreement_url`. |

**`GET /listings` query params**

| Param | Type | Behaviour |
|-------|------|-----------|
| `page`, `page_size` | int | See Pagination (24 default, 60 max) |
| `purpose` | `rent` \| `investment` | `rent` = `transaction = rent`; `investment` = `roi >= 7`. Omitted = all active listings (sale **and** rent). |
| `type` | string | Exact listing type (lower-cased); `All` is ignored |
| `region` | string | Case-insensitive substring match on `location` |
| `min_price`, `max_price` | number | Applied to `price`. **Rent listings are exempt from the price filter.** |
| `beds` | int | `bedrooms >= beds` |
| `min_roi` | number | `roi >= min_roi` |
| `features` | repeated | Listing must contain **all** given features (`?features=Pool&features=Gated`) |
| `sort` | `new` (default) \| `low` \| `high` \| `roi` | created desc / price asc / price desc / roi desc; unknown values fall back to `new` |
| `exclude_ids` | repeated UUID | Omit these listings (e.g. de-dupe the Deal of the Week) |
| `include_aggregates` | bool (default true) | Compute `median_price` (sale/both listings in the filtered set) and `avg_roi` (listings with roi > 0). Set false to skip the extra queries. |

`purpose` is not validated: unknown values behave like omitted.

---

### Bookings (`/bookings`)

Short-term rental bookings (listings with `transaction = rent` and a `price_per_day`). Dates are `YYYY-MM-DD` strings; ranges are half-open (a guest may check in the day another checks out). A stay becomes "committed" (blocks dates) only once the owner **accepts** it.

Two record kinds are merged in the booking lists:
- **Booking row**: logged-in user, or a guest who paid through PayPal. `id` is the booking UUID.
- **Lead-only guest request**: logged-out guest who did not pay. Stored only as a `Lead` (`type = booking`); dates/guests are parsed out of `lead.message`. The `id` in the response is the **lead** UUID, and accept/decline operate on it. Lead status `closed` maps to `confirmed`, `cancelled` to `cancelled`, anything else to `pending`.

`BookingResponse`: `id, listing_id, listing_title, listing_location, listing_images[], check_in, check_out, guests, total_price, notes, status, created_at, guest_name, guest_email, guest_phone, ghl_contact_url, payment_status, payout_status, booked_price_per_day, platform_fee, payout_amount, owner_name`.

| Method + path | Auth | Description |
|---|---|---|
| `GET /bookings/unavailable/{listing_id}` | Public | Array of `{check_in, check_out}` already committed (confirmed bookings + accepted guest-request leads). Drives the availability calendar. |
| `POST /bookings/create-payment-auth` | Public | Body `{listing_id, check_in, check_out}`. Creates a PayPal order (`intent = AUTHORIZE`, USD, `price_per_day x nights`). Returns `{paypal_order_id, amount_usd}`. `503` if PayPal is not configured, `400` if not a rent listing / no nightly rate / bad dates, `409` if dates are taken. **Not rate limited.** |
| `POST /bookings` | Optional | Create a booking request. Body: `listing_id, check_in, check_out, guests (1-20, default 1), notes? (<= 1000)`, plus `name, email, phone?` (name and email **required when anonymous**), `paypal_order_id?` (set after the guest approves on PayPal). Validation: `check_out > check_in`, `check_in` not in the past. See behaviour below. Returns `201` `BookingResponse`. |
| `GET /bookings/mine` | Any user | Caller's own bookings (as guest), newest first. |
| `GET /bookings/for-owner` | Any user (rows limited to listings where caller is `submitted_by` or `owner_id`) | Bookings incl. guests and lead-only requests, sorted by `check_in`. Includes `guest_*` and `ghl_contact_url`. |
| `PUT /bookings/{id}/accept` | Listing owner or submitter | Only `pending`. Takes a row lock on the listing, re-checks availability (`409` if overlapping a committed stay), **captures the PayPal authorization** if one exists (`502` on failure), sets `confirmed`, emails the guest. Works on lead UUIDs too (sets lead `closed`; no payment). `204`. |
| `PUT /bookings/{id}/decline` | Listing owner or submitter | Only `pending`. **Voids the PayPal authorization** (guest never charged), sets `cancelled`, emails the guest. Works on lead UUIDs (sets lead `cancelled`). `204`. |
| `PUT /bookings/{id}/cancel` | Booking's guest (`buyer_id`) | Only `pending`/`confirmed` Booking rows (not lead-only requests, and guests without an account cannot cancel). Voids an uncaptured authorization; a **captured** payment is not refunded, the booking is flagged `needs_admin_review` instead. `204`. |
| `POST /bookings/{id}/request-payout` | Listing owner or submitter | Only when `payout_status = failed` (`400` otherwise). Emails the admin notification address asking for a manual payout. `204`. |
| `POST /bookings/{id}/release-payout` | admin | Manually pay out a booking (retry after failure). Requires `payment_status = captured` and `payout_status != paid`. Payee: `listing.owner_paypal_email`, else owner/submitter's profile `paypal_email`. `502` if PayPal fails (and `payout_status = failed`). `204`. |

**`POST /bookings` behaviour**

1. Listing must be `active` and `transaction = rent` (`404`/`400`); requested dates must not overlap a committed stay (`409 "Those dates are no longer available for this listing"`).
2. A `Lead` (`type = booking`) is **always** created and auto-assigned to the listing owner (`owner_id`), else the submitter. Message format is `Check-in: YYYY-MM-DD, Check-out: YYYY-MM-DD, Guests: N[\nNotes: ...]`. **The lead-only parsing depends on this exact format; do not change it without updating `_DATE_RANGE_RE` / `_GUESTS_RE` in `routes/bookings.py`.**
3. Logged-in user: also creates a `Booking` row (`pending`). `409` if the same user already has a non-cancelled booking overlapping on this listing. If `paypal_order_id` is sent and PayPal is configured, the order is **authorized** (amount and currency re-checked against `price_per_day x nights`; mismatch voids the authorization and returns `422`; PayPal error returns `402`). `payment_status = authorized`.
4. Anonymous + `paypal_order_id`: creates a `Booking` row with `buyer_id = null` plus `guest_name/guest_email`. Anonymous without a payment: lead only (response `id` is the lead id, `payment_status = unpaid`).
5. Side effects (all best-effort, failures swallowed): GHL contact created from the lead; lead notification email to the admin notify address; "booking submitted" email to the guest; "new booking" email to the listing owner and, if different, the submitter.

Platform fee is `PLATFORM_FEE_PCT` (default 20%) of `total_price`, deducted at payout time.

---

### Leads

Leads are the CRM records. Public submission goes to `POST /leads`; realtors and admins work them via `/realtor/leads` and `/admin/leads`.

`LeadResponse`: `id, type, name, email, phone, message, property_id, property_title, listing_realtor_id/name, listing_owner_id/name, from_user_id, from_user_code, from_user_name, from_user_avatar_url, assigned_realtor_id, assigned_realtor_name, status, created_at, assigned_at, contacted_at, closed_at, ghl_contact_url (only on realtor/admin endpoints), booking_status`.

| Method + path | Auth | Rate limit | Description |
|---|---|---|---|
| `POST /leads` | Optional | 3/min | Body `{type (default property_inquiry), name (<= 200), email, phone? (<= 50), message? (<= 2000), property_id?}`. `type` is one of `property_inquiry`, `buyer_interest`, `seller_interest`, `booking`. Creates the lead (`status = new`, `from_user_id` set if logged in), pushes it to GHL, emails the admin notify address. Returns `201 {id, status}`. Lead is **not** auto-routed to a realtor; an admin assigns it. A malformed (non-UUID) `property_id` currently causes a `500`. |
| `POST /leads/capture` | Public | 5/min | **Legacy** form endpoint kept for old callers. Same body as above but ignores `property_id`, does not link a user, does **not** sync to GHL; only emails the admin. Returns `201 {id, status: "new"}`. No area-based routing exists (the old design doc described it; it was never built). |
| `GET /leads/mine` | Any user | none | Leads the caller submitted (`from_user_id = me`). |
| `GET /realtor/leads` | realtor, admin | none | Leads where `assigned_realtor_id = me`, newest first, with `ghl_contact_url`. |
| `PUT /realtor/leads/{lead_id}/status` | realtor, admin (must be the assigned realtor) | none | Body `{status}` where status is `schedule`, `contacted`, or `closed` (`400` otherwise). Stamps `contacted_at` / `closed_at`, and pushes the matching GHL tag. `204`. |
| `GET /admin/leads` | admin | none | Optional filters `type`, `status`, `assigned_realtor_id`. Bare array. |
| `PUT /admin/leads/{lead_id}/assign` | admin | none | Body `{realtor_id}` (must be a `realtor`). Sets `assigned_realtor_id`, `status = assigned`. If the lead is a `seller_interest` from a `buyer` user, **promotes that user to `owner`**. Mirrors the realtor onto the submitting user's `assigned_realtor_id` (owner/buyer) so their "My Agent" card works. Emails: assigned realtor (with their scheduling link), and on promotion the new owner ("upgrade approved") and the realtor ("owner assigned to you"). Updates the GHL tag. `204`. |
| `PUT /admin/leads/{lead_id}/status` | admin | none | Body `{status}`: `new | assigned | contacted | closed`. `204`. |

Lead-status note: the model comment lists `new | assigned | contacted | closed`, but the realtor endpoint also accepts `schedule` (not a valid admin value and not mapped to a GHL tag), and booking leads use `cancelled` when a guest request is declined. GHL tags exist only for the four core statuses.

---

### Inquiries (`/inquiries`)

Simple "contact about this listing" messages (separate from leads).

`InquiryResponse`: `id, listing_id, listing_title, name, email, phone, message, created_at`.

| Method + path | Auth | Description |
|---|---|---|
| `POST /inquiries` | Optional | Body `{listing_id?, name (<= 200), email, phone? (<= 50), message (<= 5000)}`. Stores the inquiry (`from_user_id` set if logged in). Returns `201`. **No email is sent and there is no rate limit.** |
| `GET /inquiries/mine` | Any user | Inquiries the caller submitted. |
| `GET /inquiries/for-realtor` | realtor, admin | Inquiries on listings where the caller is `submitted_by` or `assigned_realtor_id`. |
| `GET /inquiries/for-owner` | owner, admin | Inquiries on listings where `owner_id = caller`. |

There is no inquiry status/update endpoint (the old `PUT /inquiries/{id}` and status workflow do not exist).

---

### Saved homes (`/saved-homes`)

| Method + path | Auth | Description |
|---|---|---|
| `GET /saved-homes/mine` | Any user | `[{id, listing_id, listing_title, listing_location, listing_price, listing_transaction, listing_images[], listing_bedrooms, listing_bathrooms, saved_at}]`, newest first. Includes saved listings regardless of their current status. |
| `POST /saved-homes/{listing_id}` | Any user | `201 {status: "saved"}`; `404` unknown listing; `409` already saved. |
| `DELETE /saved-homes/{listing_id}` | Any user | `204`; `404` if not saved. |

---

### Upgrade requests (`/upgrade-requests`)

Buyers apply to become `owner` or `realtor`. (The admin side is under `/admin/upgrade-requests`.)

| Method + path | Auth | Description |
|---|---|---|
| `POST /upgrade-requests` | buyer only (`403` otherwise) | Body `{requested_role: owner|realtor, license_number?, territory?, years_experience?, specialties?, bio?}`. The questionnaire fields are intended for realtor requests (no server-side requirement). `409` if the caller already has a pending request. Returns `201 {id, user_id, requested_role, status, rejection_reason}`. No document uploads. |
| `GET /upgrade-requests/me` | Any user | Caller's requests (same shape, unordered, unpaginated). |

---

### Public, stats and chat

| Method + path | Auth | Description |
|---|---|---|
| `GET /stats/platform` | Public | Homepage/auth marketing numbers: `{active_listings, total_value, realtors, registered_users}`. `total_value` = sum of `price` over active listings (mixes currencies; no conversion). `realtors` = active realtors. `registered_users` = all non-admin users. Not cached. |
| `GET /public/chat/listings` | Public, 30/min | Backend for the website chat widget / external chatbot. Returns up to 5 newest matching active listings pre-formatted as a text message: `{message, count, has_results}`. Optional filters: `location, transaction (sale|rent; also matches "both"), type, bedrooms (>=1), min_price, max_price, min_roi, seller_financing, tax_exempt, gated_community`. The message links to `{LANDING_URL}/listing/{id}` and `/search`. |

---

### Admin (`/admin/*`, all `admin` role)

**Listing moderation**

| Method + path | Description |
|---|---|
| `GET /admin/listings` | Paginated (`page`, `page_size` <= 500). Filters: `status`, `exclude_status`, `co_listing_enabled`, `is_deal`, `q` (title/location substring). Returns `{items, total, page, page_size}` of `AdminListingResponse` (= listing + `submitted_by_name/email`, `reviewed_by_name/email`, `reviewed_at`, `assigned_realtor_name/email`). Newest first. |
| `GET /admin/listings/{id}` | One listing in any status, admin shape. |
| `POST /admin/listings/{id}/approve` | `pending_approval` -> `active` (`409` otherwise). Logs activity + listing event, emails the submitter with the public URL. `204`. |
| `POST /admin/listings/{id}/reject` | Body `{reason}`. Sets `rejected` + `rejection_reason` from **any** status (no state check). Emails the submitter. `204`. |
| `POST /admin/listings/{id}/archive` | Sets `archived` from any status. `204`. |
| `PUT /admin/listings/{id}/assign` | Body `{realtor_id}` (null/omitted = unassign). Target must be a `realtor` or `admin` (`404` otherwise). The assigned realtor becomes the listing's public "Listed by" contact and gets edit rights, inquiries and leads. Logs activity + listing event. `204`. |
| `POST /admin/listings/{id}/set-deal` | Body `{discount_value?, discount_type: pct|fixed}`. Listing must be `active` (`400`) and not already a deal (`409`). `204`. |
| `POST /admin/listings/{id}/clear-deal` | Clears Deal of the Week. `204`. |
| `GET /admin/listings/{id}/history` | Array of listing events (`id, listing_id, event_type, actor_name, actor_email, note, snapshot_before, snapshot_after, created_at`), newest first. Event types written by the code: `submitted`, `edit_submitted`, `approved`, `rejected`, `archived`, `edit_approved`, `edit_rejected`, `realtor_assigned`, `realtor_unassigned`. |
| `POST /admin/listings/{id}/regenerate-share-image` | Rebuild the 1200x630 OG share image for one listing. `204`. Errors in image generation propagate as `500`. |
| `POST /admin/listings/regenerate-share-images` | Bulk. Query `only_missing` (default `true`) skips listings that already have an image; archived listings are always skipped. Runs synchronously in the request. Returns `{processed, succeeded, failed_ids[]}`. |

**Pending edits** (created by non-admin `PUT /listings/{id}` on active listings)

| Method + path | Description |
|---|---|
| `GET /admin/listing-edits` | Pending edits, oldest first: `{id, listing_id, listing_title, listing_location, listing_thumbnail, submitted_by_name/email, submitted_at, status, current_data, proposed_data, rejection_reason}`. |
| `POST /admin/listing-edits/{id}/approve` | Applies `proposed_data` to the listing (only whitelisted fields; `price_per_day`, `price_per_month`, `currency`, `owner_paypal_email` and agreement fields are **not** in the whitelist, so edits to those via the queue are silently dropped). Regenerates share image if needed, writes before/after snapshots to history. `409` if already reviewed. `204`. |
| `POST /admin/listing-edits/{id}/reject` | Body `{reason}`. `204`. |

**Bulk CSV import** (listings)

| Method + path | Description |
|---|---|
| `POST /admin/listings/bulk-import` | `multipart/form-data`, field `csv_file`. Parsed up-front (UTF-8 or Windows-1252); structural errors reject the whole file with `400` (no header, no rows, missing required column, duplicate `source_ref` in file). On success creates a `BulkImportJob` and processes rows in a **FastAPI background task** after returning `202` with the job object (`status = pending`). |
| `GET /admin/listings/bulk-import` | Latest 20 jobs. |
| `GET /admin/listings/bulk-import/{job_id}` | Job status for polling. `BulkImportJobResponse`: `id, status (pending|running|completed|failed), total_rows, processed_rows, succeeded_count, skipped_count, failed_count, results[{row, source_ref, status (succeeded|skipped|failed), listing_id, message}], created_at, completed_at`. Row numbers are CSV line numbers (header = 1). |

CSV rules: required columns `title, property_type, purpose, region, currency, price, description_en, co_listing_enabled, assigned_agent_id`. Optional: `source_ref, description_es, bedrooms, bathrooms, living_area_sqft, lot_size_sqft, features, listing_tags, photo_urls, external_brokerage, external_agent_name, external_agent_email, commission_split_pct, co_listing_notes, co_listing_status`. Multi-value cells (`features`, `listing_tags`, `photo_urls`) are `|`-separated. `property_type` in the listing types; `purpose` in `sale|rent|both`; `currency` `USD|DOP`; `assigned_agent_id` is a **`user_code`** of a realtor or admin. Rows with an existing `source_ref` are `skipped` (idempotent re-runs). Imported listings are created `active` (no approval step), `submitted_by` = the importing admin, `assigned_realtor_id` = the agent. Unknown regions/features/tags import with a warning in `message`. Photos are downloaded server-side (http/https, public IPs only, max 3 redirects, 20 MB, up to 25 per row) and re-uploaded to Storage; failures become warnings. Rows are committed one by one, so a crash mid-job leaves earlier rows imported.

**Users**

| Method + path | Description |
|---|---|
| `GET /admin/users` | **Unpaginated** array. Filters `role`, `status` (`422` if invalid). Item: `{id, user_code, email, role, status, display_name, phone, created_at, avatar_url, assigned_realtor_id, assigned_realtor_name}`. |
| `POST /admin/users` | Body `{display_name, email, password (>= 8), role: buyer|owner|realtor}`. Creates a verified, active user (no email sent). `409` if the email exists. Admins cannot be created this way. `201`. |
| `PUT /admin/users/{id}/role` | Body `{role: buyer|owner|realtor}`. `400` for own account, `403` for target admins. `204`. |
| `PUT /admin/users/{id}/suspend` | `400` on own account. `204`. (No session revocation needed: status is checked per request.) |
| `PUT /admin/users/{id}/unsuspend` | `204`. |
| `PUT /admin/users/{id}/assign-realtor` | Body `{realtor_id}` (null = unassign). Target must be an `owner`; assignee a `realtor`. `204`. |

**Upgrade requests, deals, bookings, settings, dashboard**

| Method + path | Description |
|---|---|
| `GET /admin/upgrade-requests` | Optional `status`. Unpaginated, newest first. Item adds `user_email`, `user_display_name`, `reviewed_by_name`, `reviewed_at` and the realtor questionnaire fields. |
| `POST /admin/upgrade-requests/{id}/approve` | Sets the user's role to the requested role; emails them. `409` if already reviewed. `204`. |
| `POST /admin/upgrade-requests/{id}/reject` | Body `{reason}`; emails the reason. `204`. |
| `GET /admin/deal-requests` | Optional `status`. Item: request + listing title/location/thumbnail, requester, `discount_value`, `discount_type`, `message`, `status`, reviewer fields. |
| `POST /admin/deal-requests/{id}/approve` | Marks the listing `is_deal` with the requested discount (`400` if listing no longer active). Does not unset a previous deal; several listings can be deals at once. `204`. |
| `POST /admin/deal-requests/{id}/reject` | Body `{reason}`. `204`. |
| `GET /admin/bookings` | All bookings across all listings (`BookingResponse[]`, adds `owner_name`, `platform_fee`, `payout_amount`), including lead-only guest requests. Newest first, unpaginated. |
| `GET /admin/leads`, `PUT /admin/leads/{id}/assign`, `PUT /admin/leads/{id}/status` | See [Leads](#leads). |
| `GET /admin/settings` | `{notify_email, updated_at}`. |
| `PUT /admin/settings` | Body `{notify_email?}`. Overrides the `NOTIFY_EMAIL` env var as the address that receives lead/booking/payout alerts. `204`. |
| `GET /admin/stats` | `{active_listings, pending_listings, archived_listings, rejected_listings, total_users}`. |
| `GET /admin/activity-log` | `?limit=` (default 20, max 50). `[{id, event_type, description, created_at}]`, newest first. |

Removed from the original design (do not exist): `/users/*`, `GET/PUT /bookings` generic CRUD, `/leads` pipeline CRUD, `/admin/approvals*`, `PUT /admin/users/{id}` (replaced by the role/suspend/assign endpoints above), `PUT /inquiries/{id}`.

---

### Webhooks (`/webhooks`)

Called by third parties, not by the apps. Both return `200 {"received": true}` for anything they choose to ignore (so the sender does not retry), and `401` only on a failed signature.

| Method + path | Verification | Behaviour |
|---|---|---|
| `POST /webhooks/ghl` | Either (a) HMAC-SHA256 of the raw body, hex, in header `x-ghl-signature` (or `x-ghl-signature-256`; optional `sha256=` prefix), or (b) static secret in query `?key=<secret>` (for GHL Workflow/Automation webhooks, which cannot sign). Secret = `GHL_WEBHOOK_SECRET`. **If the secret is unset every request is rejected.** If a signature header is present it is used and the `key` param is ignored. | Reads `contact_id`/`contactId`/`id` and `tags` (list, or comma-separated string). Maps tags `lead-new`, `lead-assigned`, `lead-contacted`, `lead-closed` to a status; GHL sends *all* tags on the contact, so the **most advanced** status wins. Finds the lead by `ghl_contact_id`, updates `status` and the matching timestamp. Unknown contact, no status tag, or unchanged status = no-op. Note the status is set to the highest tag present even if that is lower than the lead's current status (e.g. if GHL tags were removed), so leads can move backwards. |
| `POST /webhooks/paypal` | PayPal "verify webhook signature" API call using headers `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time` and `PAYPAL_WEBHOOK_ID`. Rejected if the webhook id is unset or verification does not return `SUCCESS`. Verification happens before any DB write. | `PAYMENT.AUTHORIZATION.VOIDED` -> booking (by authorization id) `payment_status = voided`. `PAYMENT.CAPTURE.COMPLETED` -> booking (by capture id) `captured`. `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` -> booking (by `sender_item_id` = booking id) `payout_status = paid`. `PAYMENT.PAYOUTS-ITEM.FAILED` -> `payout_status = failed` and an error log. `CUSTOMER.DISPUTE.CREATED` -> error log only (no state change; monitor logs). Other events ignored. |

Configure in PayPal: webhook URL `https://api.ilovedrrealty.com/webhooks/paypal` subscribed to the five events above. In GHL: point a workflow (on tag added) or Private Integration webhook at `https://api.ilovedrrealty.com/webhooks/ghl` (with `?key=` for workflows).

---

### Health and misc

| Method + path | Description |
|---|---|
| `GET /health`, `POST /health` | `{status: "ok"}`. Railway health check (`/health`, 30 s timeout). |
| `POST /` | Same response (some uptime pingers POST to root). |
| `GET /robots.txt` | `Disallow: /` (the API should not be indexed). |

---

## Background jobs

All run **inside the API process** (asyncio tasks started in the FastAPI lifespan, or FastAPI background tasks). There is no separate worker or scheduler.

| Job | Schedule | What it does |
|-----|----------|--------------|
| Pending-user cleanup | Every hour (first run 1 h after boot) | Deletes `pending_users` rows past `expires_at` (48 h after last register). |
| Payout cron | Daily 00:01 UTC (skipped if `PAYPAL_CLIENT_ID` unset) | Finds bookings with `check_out = yesterday`, `status = confirmed`, `payment_status = captured`, `payout_status = pending`. Payee = `listing.owner_paypal_email`, else owner/submitter profile `paypal_email` (skipped with a log warning if none). Computes fee = `total_price x PLATFORM_FEE_PCT`, pays `total - fee` via PayPal Payouts, stores `platform_fee`, `payout_amount`, sets `payout_status = paid`, emails the owner. On failure sets `failed` and emails the admin notify address. |
| Bulk import | On demand | Triggered by `POST /admin/listings/bulk-import`; see Admin. |

Database migrations run at container start (`python bootstrap_db.py && alembic upgrade head && uvicorn ...` in `Procfile`).

---

## External integrations

| Service | Used for | Config (names only; values live in Railway, see [ENV.md](ENV.md)) |
|---------|----------|------|
| **PayPal REST v2** (`services/paypal.py`) | Orders with `intent = AUTHORIZE` at booking time, authorize on `POST /bookings`, capture on owner accept, void on decline/cancel, Payouts to owners, webhook signature verification. A `refund_capture` helper exists but no route calls it (refunds are manual). OAuth token cached in-process. | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE` (`sandbox` default or `live`), `PLATFORM_FEE_PCT` |
| **GoHighLevel** (`utils/ghl.py`) | On lead/booking creation: create (or reuse duplicate) contact with tags by lead type (`buyer-interest`, `seller-interest`, `property-inquiry`, `booking-request`, plus `website-lead`), add a note and a follow-up task (due +1 day). On status change: add `lead-<status>` tag. Inbound status sync via the GHL webhook. Fire-and-forget: failures are stored in `lead.ghl_sync_error` and never fail the request. Phone is sent only if it starts with `+`. | `GHL_ENABLED`, `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET` |
| **Resend** (`utils/email.py`) | Transactional email: verification code, password reset/changed, listing approved/rejected, upgrade approved/rejected, lead notification, realtor lead assigned, owner assigned, booking submitted/confirmed/declined, owner new booking, payout released/failed/requested. | `RESEND_API_KEY`, `EMAIL_FROM`, `LANDING_URL`, `NOTIFY_EMAIL` (overridable via `/admin/settings`) |
| **Supabase Storage** (`utils/storage.py`) | One public bucket for listing images, share images, avatars, agreement PDFs. | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET` |
| **Google OAuth** | Sign-in/link only: the API calls Google's userinfo endpoint with the access token supplied by the frontend. No client secret on the API. | none |

---

## Gotchas and known risks

Things a new developer should know; most are candidates for cleanup.

1. **Public listing responses expose private fields.** `ListingResponse` is built from every column, so `GET /listings`, `/listings/{id}` and `/listings/deal` include `owner_paypal_email`, `submitted_by`, `owner_id`, and all `co_listing_*` agent/brokerage contact fields to anonymous callers.
2. **Unrate-limited public writes.** `POST /inquiries`, `POST /bookings`, `POST /bookings/create-payment-auth` have no rate limit (the last one creates PayPal orders). Limits are also in-memory per process and keyed on the connecting IP, so behind a proxy/multiple replicas they are only as good as the forwarded-IP and replica setup.
3. **Account enumeration.** `POST /auth/register` returns `409` for an existing email despite a code comment saying the message is generic.
4. **Logout cookie attributes.** `/auth/logout` deletes the cookie without `Secure`/`SameSite` (unlike `/auth/me/deactivate`); verify it actually clears the cookie in production browsers.
5. **Password reset does not revoke sessions**; JWTs stay valid for up to 24 h. Suspension is immediate (checked per request).
6. **Payout cron is exact-date and in-process.** It only picks `check_out == yesterday`; a missed run (deploy at 00:01 UTC) is not retried, so use `POST /bookings/{id}/release-payout`. With multiple API replicas each would run the job (PayPal's `sender_batch_id = booking-<id>` guards against double payment, but not against noise).
7. **Admin list endpoints are unpaginated** (`/admin/users`, `/admin/leads`, `/admin/bookings`, `/admin/upgrade-requests`, `/admin/deal-requests`) and will degrade as data grows. `POST /admin/listings/regenerate-share-images` also runs synchronously in the request.
8. **Edit-approval whitelist** drops `price_per_day`, `price_per_month`, `currency`, `owner_paypal_email`, `co_listing_agreement_*` when a non-admin edits an active listing: the edit is "approved" but those fields never change.
9. **`PUT /listings/{id}` ignores nulls**, so optional fields cannot be cleared through it; and it only lets `submitted_by` / `assigned_realtor_id` / admins edit, so an `owner_id` who is not the submitter cannot.
10. **Lead status vocabulary is inconsistent** (`schedule` allowed for realtors only; `cancelled` used for declined booking leads; neither maps to a GHL tag).
11. **Validation gaps.** `POST /leads` with a non-UUID `property_id` yields `500`; `type`/`transaction` on listing create are free strings validated only by the database enum; `upload-agreement` checks only the filename extension.
12. **Money is mixed-currency.** Listings can be `USD` or `DOP`, but `/stats/platform.total_value`, the `GET /listings` price filters/median and all PayPal flows treat `price` / `price_per_day` as USD.
13. **Account deletion is not automated**: `POST /auth/me/delete-request` only records a timestamp.
