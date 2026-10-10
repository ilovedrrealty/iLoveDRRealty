# Data Models

Last verified against the code: October 2026 (Alembic head `bc364345c64b`). The source of truth is `realty-api/models/` (SQLAlchemy ORM) and `realty-api/alembic/versions/` (migrations). If this document and the code disagree, the code wins.

## Overview

- Database: PostgreSQL hosted on Supabase, but used as **plain Postgres**. The API connects with SQLAlchemy (psycopg2) via the `DATABASE_URL` env var (`realty-api/database.py`).
- Authentication is **not** Supabase Auth. `users` is a standalone table with its own `password_hash`, optional `google_id`, and API-issued JWTs. There is no foreign key to `auth.users`.
- Supabase is also used for file storage only (`utils/storage.py`, via `supabase-py` and the service key).
- No Row-Level Security policies are defined in the models or migrations. All authorization (roles, ownership checks) is enforced in the FastAPI layer. Any RLS configured in the Supabase dashboard lives outside this repo.
- Models: `realty-api/models/` (15 tables, registered in `models/__init__.py`). Migrations: `realty-api/alembic/versions/`. See [Migrations](#migrations) for how the schema is created and upgraded.
- Many "enum" columns are plain `text` with the allowed values enforced only in application code. They are marked "text (app-enforced)" below. Real PostgreSQL enum types are listed in [Enums](#enums).

### Tables at a glance

| Table | Purpose |
|-------|---------|
| `users` | Accounts for all roles (buyer, owner, realtor, admin) |
| `pending_users` | Unverified signups, promoted to `users` on email verification |
| `listings` | Properties for sale or rent |
| `listing_edits` | Proposed edits to active listings awaiting admin approval |
| `listing_events` | Per-listing audit trail |
| `deal_requests` | Requests to mark a listing as a "deal of the week" |
| `bookings` | Rental stays with PayPal payment and payout tracking |
| `leads` | Unified lead/booking-request inbox, routed to realtors and synced to GoHighLevel (GHL) |
| `inquiries` | Contact messages about a listing |
| `anonymous_leads` | Model exists; no route writes to it today |
| `saved_homes` | Buyer favourites |
| `upgrade_requests` | Buyer requests to become owner or realtor |
| `activity_log` | Admin dashboard activity feed |
| `settings` | Singleton row of site-wide JSON settings |
| `bulk_import_jobs` | Progress and results of admin CSV listing imports |

Column notation: "Nullable" means NULL is allowed. "Default" shows either a DB-side `server_default` (written as SQL) or a Python-side default (marked "app default", not present in the DDL).

---

## users

Application accounts for every role. Table name `users`, model `models/user.py`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `user_code` | `integer` | yes | `nextval('users_user_code_seq')` | Human-readable sequential account number shown in the UI (oldest account = 1). UNIQUE. See note below |
| `email` | `text` | no | | UNIQUE login email |
| `password_hash` | `text` | yes | | NULL for Google-only accounts (made nullable by migration `c3d4e5f6a7b8`) |
| `google_id` | `text` | yes | | Google OAuth subject id. UNIQUE |
| `avatar_url` | `text` | yes | | Profile image URL |
| `role` | enum `user_role` | no | `'buyer'` | `buyer`, `owner`, `realtor`, `admin` |
| `status` | enum `user_status` | no | `'active'` | `active`, `suspended`. Deactivating an account sets `suspended`; suspended users cannot log in |
| `display_name` | `text` | no | | Full name or business name |
| `phone` | `text` | yes | | |
| `email_verified` | `boolean` | no | app default `false` (migration `434d4c5bb8b6` also sets DB default `false` on legacy DBs) | |
| `verification_code` | `text` | yes | | Legacy email-verification columns (`verification_code`, `verification_code_expires_at`, `verification_attempts`, `last_code_sent_at`). The current signup flow keeps these on `pending_users` instead; `routes/auth.py` no longer reads them from `users` |
| `verification_code_expires_at` | `timestamptz` | yes | | Legacy (see above) |
| `verification_attempts` | `integer` | no | `0` | Legacy (see above) |
| `last_code_sent_at` | `timestamptz` | yes | | Legacy (see above) |
| `created_at` | `timestamptz` | no | `now()` | |
| `deletion_requested_at` | `timestamptz` | yes | | Set by `POST /auth/me/delete-request`. Only a flag for an admin to act on; nothing deletes the account automatically |
| `password_reset_token` | `text` | yes | | SHA-256 hash of the emailed reset token (the raw token is never stored). Cleared after use |
| `password_reset_expires` | `timestamptz` | yes | | |
| `calendly_url` | `text` | yes | | Public booking page for owners and realtors. Holds either a Calendly link or a Google Calendar appointment-schedule link; the provider is inferred from the host. (Column name predates Google Calendar support) |
| `assigned_realtor_id` | `uuid` | yes | | FK to `users.id` ON DELETE SET NULL. For an owner: the realtor an admin assigned to manage them |
| `paypal_email` | `text` | yes | | PayPal address for booking payouts to owners (see bookings) |

**Indexes and constraints**
- PK `id`; UNIQUE on `email`, `user_code`, `google_id`.
- `ix_users_password_reset_token` on `password_reset_token`.
- `ix_users_assigned_realtor_id` on `assigned_realtor_id` (created by migration only).
- Migrations also add `uq_users_user_code` (unique on `user_code`) and `ix_users_google_id` (partial unique, `WHERE google_id IS NOT NULL`). On a database created by `bootstrap_db.py` these duplicate the unique constraints that `create_all` already made. See [Known drift](#known-drift-and-risks).

**`user_code` sequence.** `user_code` is drawn from the sequence `users_user_code_seq`. Migration `e5f6a7b8c9d0` created the sequence, backfilled existing users in `created_at` order, advanced the sequence, set the column DEFAULT, and bound the sequence to the column. The model must keep `Sequence("users_user_code_seq")` on the column: without it SQLAlchemy sends an explicit NULL on insert, which overrides the DB default and leaves new users without a code. That bug did occur in production; migration `s7t8u9v0w1x2` backfilled the affected rows (existing codes untouched, some are referenced externally by a co-listing partner) and re-synced the sequence. The column is nullable only for that history.

**Seed accounts.** `seed.py` creates `buyer@seed.com`, `owner@seed.com`, `realtor@seed.com` and `admin@seed.com` (see [Seeding demo data](#seeding-demo-data)).

---

## pending_users

Staging table for unverified email/password signups (`models/pending_user.py`). A row is created at signup; when the user enters the correct emailed code, the row is promoted into `users` and deleted. Google signups do not use this table.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `email` | `text` | no | | UNIQUE. Re-registering the same email updates the existing row |
| `password_hash` | `text` | no | | |
| `display_name` | `text` | no | | |
| `phone` | `text` | yes | | |
| `verification_code` | `text` | yes | | |
| `verification_code_expires_at` | `timestamptz` | yes | | 15 minute code lifetime |
| `verification_attempts` | `integer` | no | `0` | Max 5 attempts |
| `last_code_sent_at` | `timestamptz` | yes | | 60 s resend cooldown |
| `expires_at` | `timestamptz` | no | | Row TTL (48 hours after signup). An hourly asyncio task in `main.py` (`_cleanup_pending_users`) deletes rows where `expires_at < now()` |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes:** PK; UNIQUE on `email` (plus `uq_pending_users_email` from the migration, a duplicate on bootstrapped DBs); `ix_pending_users_expires_at` on `expires_at`.

---

## Removed from earlier versions of this document

The June 2026 design draft described a `profiles` table, a `territories` table, `listings.realtor_id`, `price_period`, `inquiries.to_user_id`/`status`, a separate Supabase-Auth-backed `users.id`, and RLS policies. None of these exist in the code. Profile fields (`display_name`, `phone`, `avatar_url`, `calendly_url`, `paypal_email`) live directly on `users`. The `anonymous_leads` table exists in the models but is a stripped-down version of the draft (see below).

---

## listings

Properties for sale or rent (`models/listing.py`). Table name `listings`.

Who is who: `submitted_by` is whoever created the row (realtor, owner or admin). `owner_id` is set only when an owner submitted it (owners may only submit `rent` listings). `assigned_realtor_id` is the realtor an admin assigned to handle it; that realtor can edit it, receives its inquiries, and is shown as the public contact.

**Core fields**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `title` | `text` | no | | Headline |
| `description` | `text` | yes | | English description |
| `description_es` | `text` | yes | | Spanish description (populated by bulk import) |
| `type` | enum `listing_type` | no | | `villa`, `apartment`, `condo`, `land`, `commercial` |
| `transaction` | enum `transaction_type` | no | | `sale`, `rent`, `both` |
| `price` | `numeric(12,2)` | no | | Listed price, in `currency` |
| `currency` | `text` | no | `'USD'` | ISO currency code of `price` |
| `location` | `text` | no | | Free text, e.g. "Punta Cana, La Altagracia" (region names are not constrained in the DB) |
| `bedrooms` | `integer` | yes | | |
| `bathrooms` | `numeric(3,1)` | yes | | Allows half-baths (migration `d5e6f7a8b9c0` converted this from integer) |
| `area_sqft` | `integer` | yes | | Interior area |
| `lot_size_sqft` | `integer` | yes | | Lot size |
| `year_built` | `integer` | yes | | |
| `construction_status` | `text` | yes | | Free text (e.g. completed / under construction) |
| `latitude` | `numeric(10,7)` | yes | | Map pin |
| `longitude` | `numeric(10,7)` | yes | | Map pin |
| `maps_url` | `text` | yes | | Google Maps link |
| `tag` | `text` | yes | | Single legacy badge (e.g. `featured`, `new`) |
| `tags` | `text[]` | no | `'{}'` | Multiple badges |
| `features` | `text[]` | yes | `'{}'` | Amenity strings |
| `images` | `text[]` | yes | `'{}'` | Image URLs (Supabase Storage) |
| `video_links` | `text[]` | no | `'{}'` | |
| `tour_3d_url` | `text` | yes | | |
| `share_image_url` | `text` | yes | | Generated branded preview image (price, beds/baths, location baked in) used for link previews. Regenerated on create/edit; admins have a backfill endpoint |
| `view_count` | `integer` | no | `0` | Incremented on public detail views |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Set by the app on edits (no DB trigger) |

**Investment, HOA and rental terms**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `roi` | `numeric(5,2)` | yes | | Estimated ROI percent |
| `seller_financing` | `boolean` | no | `false` | |
| `hoa` | `boolean` | no | `false` | |
| `hoa_fee` | `numeric(10,2)` | yes | | |
| `tax_exempt` | `boolean` | no | `false` | |
| `gated_community` | `boolean` | no | `false` | |
| `utilities` | `text` | yes | | Free-text utilities note (rentals) |
| `included_utilities` | `text[]` | no | `'{}'` | |
| `association_fee` | `numeric(12,2)` | yes | | |
| `deposit_policy` | `text` | yes | | |
| `price_per_day` | `numeric(12,2)` | yes | | Nightly rate. Booking totals are computed from this |
| `price_per_month` | `numeric(12,2)` | yes | | Monthly rate |
| `owner_paypal_email` | `text` | yes | | Per-listing payout email. Overrides the owner's `users.paypal_email` when paying out bookings |

**Ownership, approval and workflow**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `status` | enum `listing_status` | no | `'pending_approval'` | See [Listing status workflow](#listing-status-workflow) |
| `submitted_by` | `uuid` | no | | FK to `users.id`. Creator |
| `owner_id` | `uuid` | yes | | FK to `users.id`. Set for owner-submitted rentals |
| `assigned_realtor_id` | `uuid` | yes | | FK to `users.id`. Realtor assigned by an admin |
| `approved_by` | `uuid` | yes | | FK to `users.id`. Admin who last approved, rejected or archived the listing |
| `approved_at` | `timestamptz` | yes | | Time of that admin action |
| `rejection_reason` | `text` | yes | | Shown to the submitter; cleared when a rejected listing is resubmitted |

**Deal of the week**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `is_deal` | `boolean` | no | `false` | Listing is currently a featured deal |
| `deal_discount_value` | `numeric(12,2)` | yes | | Discount amount (originally `deal_discount_pct`, renamed by `b2c3d4e5f6a7`) |
| `deal_discount_type` | `text` | no | `'pct'` | `pct` (percent) or a fixed amount (app-enforced text) |

**Co-listing (partner brokerage)**

Used when the listing is shared with an outside brokerage. The bulk importer fills these from the partner's CSV.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `co_listing_enabled` | `boolean` | no | `false` | |
| `co_listing_brokerage` | `text` | yes | | |
| `co_listing_brokerage_email` | `text` | yes | | |
| `co_listing_brokerage_phone` | `text` | yes | | |
| `co_listing_agent_name` | `text` | yes | | |
| `co_listing_agent_contact` | `text` | yes | | Kept on purpose: bulk import fills it from the agent's email and the dashboard displays it |
| `co_listing_agent_email` | `text` | yes | | |
| `co_listing_commission_split` | `numeric(5,2)` | yes | | |
| `co_listing_notes` | `text` | yes | | |
| `co_listing_status` | `text` | yes | | Free text |
| `co_listing_agreement_accepted` | `boolean` | no | `false` | |
| `co_listing_agreement_url` | `text` | yes | | Uploaded agreement PDF |

**Import**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `source_ref` | `text` | yes | | External identifier from a bulk CSV import (UNIQUE when not null). Used to skip rows already imported |

**Indexes and constraints**
- PK `id`; UNIQUE on `source_ref` (bootstrapped DBs also get the partial `ix_listings_source_ref`).
- `ix_listings_assigned_realtor_id` on `assigned_realtor_id` (migration).
- `ix_listings_status_created_at` on `(status, created_at DESC)` (migration `u9v0w1x2y3z4`) backing the paginated public search and admin lists.
- FKs: `submitted_by`, `owner_id`, `approved_by` reference `users.id` with no ON DELETE action. `assigned_realtor_id` references `users.id`; ON DELETE SET NULL only on databases that went through the migration path (see [Known drift](#known-drift-and-risks)).
- There are no indexes on `submitted_by`, `owner_id`, `type`, `transaction`, or `location`.

---

## listing_edits

Pending edits to an `active` listing (`models/listing_edit.py`). When a non-admin edits an active listing, the change is stored here instead of being applied, so the live listing is not disrupted until an admin approves. Submitting a new edit deletes any earlier pending edit for the same listing.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK (migration uses `gen_random_uuid()`) |
| `listing_id` | `uuid` | no | | FK to `listings.id` ON DELETE CASCADE. Indexed |
| `submitted_by` | `uuid` | no | | FK to `users.id` |
| `proposed_data` | `jsonb` | no | | The proposed field changes (only the fields the editor sent). On approval only whitelisted fields (`EDIT_FIELDS` in `routes/admin.py`) are applied |
| `status` | enum `listing_edit_status` | no | `'pending'` | `pending`, `approved`, `rejected` |
| `submitted_at` | `timestamptz` | no | `now()` | |
| `reviewed_by` | `uuid` | yes | | FK to `users.id` |
| `reviewed_at` | `timestamptz` | yes | | |
| `rejection_reason` | `text` | yes | | |

**Indexes:** `ix_listing_edits_listing_id`.

---

## listing_events

Append-only audit trail per listing (`models/listing_event.py`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | `gen_random_uuid()` / app default | PK |
| `listing_id` | `uuid` | no | | FK to `listings.id` ON DELETE CASCADE. Indexed |
| `event_type` | `text` (app-enforced) | no | | Values written by the code: `submitted`, `approved`, `rejected`, `archived`, `edit_submitted`, `edit_approved`, `edit_rejected`, `realtor_assigned`, `realtor_unassigned` |
| `actor_id` | `uuid` | yes | | FK to `users.id` ON DELETE SET NULL |
| `note` | `text` | yes | | Rejection reason, import note ("Bulk CSV import"), etc. |
| `snapshot_before` | `jsonb` | yes | | Listing fields before an edit (edit events) |
| `snapshot_after` | `jsonb` | yes | | Applied/proposed fields (edit events) |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes:** `ix_listing_events_listing_id`.

---

## deal_requests

Requests from realtors/owners to feature one of their active listings as a deal (`models/deal_request.py`). On approval the admin sets `listings.is_deal`, `deal_discount_value` and `deal_discount_type`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `listing_id` | `uuid` | no | | FK to `listings.id` (no cascade) |
| `requested_by` | `uuid` | no | | FK to `users.id` |
| `discount_value` | `numeric(12,2)` | no | | Originally `discount_pct`, renamed by `b2c3d4e5f6a7` |
| `discount_type` | `text` | no | `'pct'` | `pct` or fixed amount (app-enforced) |
| `message` | `text` | yes | | Requester's note |
| `status` | enum `deal_request_status` | no | `'pending'` | `pending`, `approved`, `rejected` |
| `rejection_reason` | `text` | yes | | |
| `reviewed_by` | `uuid` | yes | | FK to `users.id` |
| `reviewed_at` | `timestamptz` | yes | | |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes (migration `a1b2c3d4e5f6`):** `ix_deal_requests_listing_id`, `ix_deal_requests_status`. Each requester can have at most one pending request per listing, and only `active` listings that are not already a deal can be requested (both checked in `routes/listings.py`, not by DB constraints).

---

## Listing status workflow

`listings.status` is the Postgres enum `listing_status`: `draft`, `pending_approval`, `active`, `rejected`, `archived`.

```
 create (realtor / owner) ──> pending_approval ──approve──> active ──archive──> archived
 create (admin) ───────────────────────────────> active        │
                                   │                           └─ edit by non-admin: stored in
                                   └──reject──> rejected          listing_edits (listing stays active)
                                                   │
                                   edit + resave ──┘ (back to pending_approval, rejection_reason cleared)
```

- Public endpoints (search, detail, deals, stats, chat, booking) only expose `status = 'active'`.
- New listings from realtors and owners start `pending_approval`; admin-created listings start `active` immediately.
- Admin `approve` is only allowed from `pending_approval` (409 otherwise). It sets `approved_by`/`approved_at`, writes an `activity_log` row and a `listing_events` row, and emails the submitter. `reject` stores `rejection_reason`; `archive` can be applied from any state. Both also stamp `approved_by`/`approved_at`.
- A submitter's or admin's `DELETE /listings/{id}` is a soft delete: it sets `status = 'archived'`. Rows are never hard-deleted by the API.
- Editing a `rejected` listing resets it to `pending_approval`. Editing an `active` listing as a non-admin creates a `listing_edits` row (status `pending`), and the listing remains live with its old data until an admin approves or rejects the edit.
- `draft` is defined in the enum but no current route assigns it.
- The old June 2026 values `under_offer`, `sold` and `rented` do not exist.

---

## inquiries

Contact messages about a listing (`models/inquiry.py`, `routes/inquiries.py`). Deliberately minimal: no status, recipient or source columns. A row is written by `POST /inquiries` (anonymous or logged in), and the only read endpoint (`GET /inquiries/mine`) returns the signed-in sender's own inquiries.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `listing_id` | `uuid` | yes | | FK to `listings.id` (no cascade) |
| `name` | `text` | no | | Sender name |
| `email` | `text` | no | | Sender email |
| `phone` | `text` | yes | | |
| `message` | `text` | yes | | |
| `from_user_id` | `uuid` | yes | | FK to `users.id`. NULL for anonymous senders |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes:** PK only (no index on `listing_id` or `from_user_id`).

---

## anonymous_leads

Landing-form lead captures from visitors without an account (`models/inquiry.py`, class `AnonymousLead`). The table exists in the models, but no route reads or writes it today. Landing-page leads are written to `leads` (via `POST /leads/capture`). Safe to ignore unless this table is revived.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `name` | `text` | no | | |
| `email` | `text` | no | | |
| `phone` | `text` | yes | | |
| `area` | `text` | yes | | Area of interest |
| `intent` | `text` | yes | | Free text (buy / sell / rent / invest were the drafted values) |
| `created_at` | `timestamptz` | no | `now()` | |

No migration references this table; it only exists on databases created through `bootstrap_db.py` / `create_all`.

---

## bookings

Rental stays, with PayPal payment and owner payout tracking (`models/booking.py`, `routes/bookings.py`, payout cron in `main.py`, PayPal calls in `services/paypal.py`). There is no viewing/appointment booking in this table; viewings are scheduled through each user's `calendly_url` link.

A booking is created in one of three shapes:
- Logged-in buyer: `buyer_id` set, PayPal order authorized at booking time.
- Guest with PayPal: `buyer_id` NULL, `guest_name`/`guest_email` set, PayPal order authorized.
- Guest without PayPal payment: only a `leads` row (type `booking`) is created, no `bookings` row. The dashboard treats such a lead as a pending booking (the dates live in the lead's `message` text).

Every booking request also creates a `leads` row of type `booking`, and `bookings.lead_id` links back to it (set after both rows exist; plain UUID, no FK). The lead is auto-assigned to the listing owner (or submitter).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `listing_id` | `uuid` | no | | FK to `listings.id` |
| `buyer_id` | `uuid` | yes | | FK to `users.id`. NULL for guest bookings (made nullable by `f9901a9c3ae1`) |
| `guest_name` | `text` | yes | | Guest contact, used when `buyer_id` is NULL |
| `guest_email` | `text` | yes | | |
| `lead_id` | `uuid` | yes | | The matching `leads.id` (no FK). Used to de-duplicate booking and lead rows in owner views |
| `check_in` | `text` | no | | ISO date string `YYYY-MM-DD`. **Stored as text, not `date`**; comparisons are string comparisons (works because ISO dates sort lexically) |
| `check_out` | `text` | no | | ISO date string. Departure day: `check_out` of one stay may equal `check_in` of the next |
| `guests` | `integer` | yes | app default `1` | |
| `total_price` | `numeric(12,2)` | yes | | Nights x nightly rate at booking time |
| `booked_price_per_day` | `numeric(10,2)` | yes | | Snapshot of the listing's nightly rate when booked, so later price changes do not alter the booking |
| `notes` | `text` | yes | | |
| `status` | `text` (app-enforced) | no | app default `'pending'` | `pending`, `confirmed`, `cancelled`. (`completed` was drafted but is never set) |
| `created_at` | `timestamptz` | no | `now()` | |
| `paypal_order_id` | `text` | yes | | PayPal order approved by the buyer |
| `paypal_authorization_id` | `text` | yes | | Authorization created from the order (funds held, not yet captured) |
| `paypal_capture_id` | `text` | yes | | |
| `payment_status` | `text` (app-enforced) | no | `'unpaid'` | `unpaid`, `authorized`, `captured`, `voided`, `refunded`. (`refunded` is listed in the model comment but no code sets it yet) |
| `payout_status` | `text` (app-enforced) | no | `'pending'` | `pending`, `paid`, `failed`. Whether the owner has been paid out |
| `needs_admin_review` | `boolean` | no | `false` | Set when a booking is cancelled after the payment was already captured, meaning an admin must refund manually |
| `platform_fee` | `numeric(12,2)` | yes | | Platform cut taken at payout: `total_price * PLATFORM_FEE_PCT` (default 20%, `config.py`) |
| `payout_amount` | `numeric(12,2)` | yes | | `total_price - platform_fee`, sent to the owner |

**Payment and payout lifecycle**
1. Booking created: `status = pending`, `payment_status = authorized` (or `unpaid` if no PayPal payment).
2. Owner/realtor confirms: PayPal authorization is captured, `status = confirmed`, `payment_status = captured`.
3. Cancelled or declined: authorization is voided (`payment_status = voided`, `status = cancelled`). If it was already captured, `needs_admin_review = true`.
4. Payout: a daily task (`_payout_cron` in `main.py`, 00:01 UTC) pays out bookings where `check_out` was yesterday, `status = confirmed`, `payment_status = captured`, `payout_status = pending`. It sets `platform_fee`, `payout_amount` and `payout_status = paid` (or `failed`, with an admin email). An admin can also trigger or retry a payout manually (`POST /bookings/{id}/release-payout`). PayPal webhooks (`routes/webhooks.py`) also update `payment_status` and `payout_status`. The cron does nothing when PayPal credentials are not configured.
5. Payout destination resolves in order: `listings.owner_paypal_email`, then the owner's `users.paypal_email` (owner, else submitter). If neither exists the payout is skipped with a log warning.

**Indexes and constraints:** PK only. There are no indexes on `listing_id`, `buyer_id`, `lead_id`, `check_in`/`check_out`, or the status columns, even though availability checks and the payout cron filter on them. Overlap protection is enforced in application code (`routes/bookings.py`), not by a DB exclusion constraint.

---

## leads

Unified inbox for property inquiries, booking requests and buyer/seller interest (`models/lead.py`, `routes/leads.py`). Leads are assigned to a realtor (or owner, for booking leads), pushed to GoHighLevel (GHL) as contacts, and kept in sync with GHL status tags.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `type` | `text` (app-enforced) | no | | `property_inquiry`, `booking`, `buyer_interest`, `seller_interest` |
| `name` | `text` | no | | Contact name |
| `email` | `text` | no | | |
| `phone` | `text` | yes | | |
| `message` | `text` | yes | | Free text. For `booking` leads this holds "Check-in: ..., Check-out: ..., Guests: ..." which the dashboard parses back out |
| `property_id` | `uuid` | yes | | FK to `listings.id` ON DELETE SET NULL |
| `from_user_id` | `uuid` | yes | | FK to `users.id` ON DELETE SET NULL. Submitting account, if logged in |
| `assigned_realtor_id` | `uuid` | yes | | FK to `users.id` ON DELETE SET NULL. Realtor/owner handling the lead |
| `status` | `text` (app-enforced) | no | `'new'` | `new`, `assigned`, `contacted`, `closed`. Booking leads can also be `cancelled` |
| `created_at` | `timestamptz` | no | `now()` | |
| `assigned_at` | `timestamptz` | yes | | First time the status became `assigned` |
| `contacted_at` | `timestamptz` | yes | | First time it became `contacted` |
| `closed_at` | `timestamptz` | yes | | First time it became `closed` |
| `ghl_contact_id` | `text` | yes | | GoHighLevel contact id for this lead. Used to deep-link to GHL and to match incoming webhooks |
| `ghl_sync_error` | `text` | yes | | Last error from pushing this lead to GHL, if any |
| `ghl_synced_at` | `timestamptz` | yes | | Last successful sync |

**Status notes**
- Timestamps are stamped only the first time a status is reached (`_apply_status_timestamp`).
- Status mirrors GHL tags: `new` / `assigned` / `contacted` / `closed` map to tags `lead-new`, `lead-assigned`, `lead-contacted`, `lead-closed` (`utils/ghl.py`). Changing status in the app pushes the tag to GHL; the GHL webhook (`routes/webhooks.py`) pulls it back, picking the highest-priority tag when several arrive.
- For `booking` leads, `closed` means the stay was confirmed and `cancelled` means it was cancelled; the booking UI maps these to booking statuses `confirmed` / `cancelled`.
- Assigning a `seller_interest` lead upgrades the submitting buyer account to the `owner` role.
- Code quirk: `PUT /realtor/leads/{id}/status` accepts `schedule`, `contacted`, `closed`. `schedule` is not part of the status vocabulary above and would be stored as-is.

**Indexes (migration `g8h9i0j1k2l3`):** `ix_leads_status`, `ix_leads_assigned_realtor_id`, `ix_leads_from_user_id`. No index on `property_id`.

---

## saved_homes

Buyer favourites (`models/saved_home.py`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `user_id` | `uuid` | no | | FK to `users.id` (no cascade) |
| `listing_id` | `uuid` | no | | FK to `listings.id` (no cascade) |
| `created_at` | `timestamptz` | no | `now()` | |

**Constraints:** UNIQUE `(user_id, listing_id)`, so a listing can be saved once per user. Because of the missing cascades, deleting a user or listing row that has saved homes fails; the API only archives listings, so this is not hit in normal use.

---

## upgrade_requests

Requests from existing buyer accounts (only role `buyer` may submit) to become an owner or realtor (`models/upgrade_request.py`, `routes/upgrade_requests.py`). On approval the admin endpoint sets `users.role` to `requested_role`, logs `upgrade_approved`, and emails the user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `user_id` | `uuid` | no | | FK to `users.id` ON DELETE CASCADE |
| `requested_role` | enum `requested_role_check` | no | | `owner` or `realtor` |
| `status` | enum `upgrade_status` | no | `'pending'` | `pending`, `approved`, `rejected` |
| `notes` | `text` | yes | | Applicant's notes |
| `license_number` | `text` | yes | | Realtor license, for realtor requests |
| `territory` | `text` | yes | | Free-text area/territory the applicant wants to cover |
| `years_experience` | `integer` | yes | | Realtor questionnaire (migration `i0j1k2l3m4n5`) |
| `specialties` | `text` | yes | | Realtor questionnaire |
| `bio` | `text` | yes | | Realtor questionnaire |
| `reviewed_by` | `uuid` | yes | | FK to `users.id`. Reviewing admin |
| `reviewed_at` | `timestamptz` | yes | | |
| `rejection_reason` | `text` | yes | | |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes:** PK only. A user may have only one `pending` request at a time (checked in `routes/upgrade_requests.py`, not by a constraint). The earlier design's `documents` column was never implemented.

---

## activity_log

Feed of admin-relevant events for the admin dashboard (`models/activity_log.py`; newest 20-50 returned by `GET /admin/activity-log`). Written by the admin routes via `_log()`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `event_type` | `text` (app-enforced) | no | | Values written by the code: `listing_approved`, `listing_rejected`, `listing_archived`, `listing_assigned`, `listing_unassigned`, `edit_approved`, `edit_rejected`, `deal_approved`, `deal_rejected`, `deal_cleared`, `upgrade_approved`, `upgrade_rejected`, `role_changed`, `realtor_assigned`, `realtor_unassigned`, `user_created` |
| `description` | `text` | no | | Human-readable sentence shown in the feed |
| `actor_id` | `uuid` | yes | | Acting admin's `users.id`. Plain UUID, **no FK**, so entries survive user deletion |
| `created_at` | `timestamptz` | no | `now()` | |

**Indexes (migration `e2f3a4b5c6d7`):** `ix_activity_log_created_at`. This table is a general feed; per-listing history is in `listing_events`.

---

## settings

Singleton row of site-wide JSON settings (`models/site_settings.py`, table name `settings`). Exactly one row, `id = 1`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `integer` | no | app default `1` | PK |
| `data` | `jsonb` | no | `'{}'` | Settings object. Currently the only key used is `notify_email` (where admin notification emails go; falls back to the `NOTIFY_EMAIL` env var). Edited via `GET/PUT /admin/settings` |
| `updated_at` | `timestamptz` | yes (model) / no (migration) | `now()` | Updated on write |

**Constraints:** migration `l3m4n5o6p7q8` adds `CHECK (id = 1)` (`settings_single_row`) and inserts the seed row `(1, '{}')`. On a database bootstrapped through `create_all` the table is created first, so the CHECK is **not** present (see [Known drift](#known-drift-and-risks)); the seed row is still inserted by the migration. The API also creates row 1 on first save if it is missing.

---

## bulk_import_jobs

Progress tracking for the admin CSV bulk listing import (`models/bulk_import_job.py`, `utils/bulk_import.py`, endpoints under `/admin/listings/bulk-import`). The upload returns `202` with a job id; a background task processes rows and updates the job, which the UI polls. Rows are de-duplicated by `listings.source_ref`; imported listings are written through the normal listing path (event `submitted` with note "Bulk CSV import").

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | no | app default `uuid4()` | PK |
| `status` | `text` (app-enforced) | no | `'pending'` | `pending`, `running`, `completed`, `failed` |
| `total_rows` | `integer` | no | `0` | Data rows in the uploaded CSV |
| `processed_rows` | `integer` | no | `0` | |
| `succeeded_count` | `integer` | no | `0` | Listings created |
| `skipped_count` | `integer` | no | `0` | Rows whose `source_ref` was already imported |
| `failed_count` | `integer` | no | `0` | Rows rejected by validation or crashed |
| `results` | `jsonb` | no | `'[]'` | Per-row outcome array: `{row, source_ref, status: succeeded\|skipped\|failed, message}`. The `row` number is the CSV line (header = line 1, first data row = 2) |
| `created_by` | `uuid` | yes | | FK to `users.id` ON DELETE SET NULL. The admin who uploaded |
| `created_at` | `timestamptz` | no | `now()` | |
| `completed_at` | `timestamptz` | yes | | |

**Indexes (migration `r6s7t8u9v0w1`):** `ix_bulk_import_jobs_created_at`. The job list endpoint returns the 20 most recent. Jobs run in-process: a deploy or restart mid-import leaves the job stuck in `running`.

---

## Entity Relationship Diagram

Foreign keys only (arrows point from the referencing column to the referenced table). "(SN)" = ON DELETE SET NULL, "(C)" = ON DELETE CASCADE, no tag = no ON DELETE action. Columns shown as plain UUIDs without a FK are listed at the bottom.

```
users
  ├── users.assigned_realtor_id ───────────────> users (SN)
  ├── upgrade_requests.user_id (C), .reviewed_by
  ├── bulk_import_jobs.created_by (SN)
  ├── saved_homes.user_id
  ├── inquiries.from_user_id
  ├── bookings.buyer_id
  ├── deal_requests.requested_by, .reviewed_by
  ├── listing_edits.submitted_by, .reviewed_by
  ├── listing_events.actor_id (SN)
  ├── leads.from_user_id (SN), leads.assigned_realtor_id (SN)
  └── listings.submitted_by, .owner_id, .assigned_realtor_id, .approved_by

listings
  ├── listing_edits.listing_id (C)
  ├── listing_events.listing_id (C)
  ├── deal_requests.listing_id
  ├── saved_homes.listing_id
  ├── inquiries.listing_id
  ├── bookings.listing_id
  └── leads.property_id (SN)

Plain UUID columns with no FK:
  bookings.lead_id  (-> leads.id, by convention)
  activity_log.actor_id (-> users.id, by convention)

No relationships: pending_users, anonymous_leads, settings
```

---

## Enums

Only these columns are real PostgreSQL enum types. Everything else that looks like an enum (lead `type`/`status`, booking `status`/`payment_status`/`payout_status`, `event_type`, bulk import `status`, `deal_discount_type`) is a `text` column validated only in application code.

```sql
-- users.role (new signups start as buyer; owner/realtor granted via upgrade request or admin)
CREATE TYPE user_role AS ENUM ('buyer', 'owner', 'realtor', 'admin');

-- users.status ('pending' from the old draft does not exist; unverified signups live in pending_users)
CREATE TYPE user_status AS ENUM ('active', 'suspended');

-- listings.type
CREATE TYPE listing_type AS ENUM ('villa', 'apartment', 'condo', 'land', 'commercial');

-- listings.transaction
CREATE TYPE transaction_type AS ENUM ('sale', 'rent', 'both');

-- listings.status (see "Listing status workflow")
CREATE TYPE listing_status AS ENUM ('draft', 'pending_approval', 'active', 'rejected', 'archived');

-- upgrade_requests.status
CREATE TYPE upgrade_status AS ENUM ('pending', 'approved', 'rejected');

-- upgrade_requests.requested_role
CREATE TYPE requested_role_check AS ENUM ('owner', 'realtor');

-- listing_edits.status
CREATE TYPE listing_edit_status AS ENUM ('pending', 'approved', 'rejected');

-- deal_requests.status
CREATE TYPE deal_request_status AS ENUM ('pending', 'approved', 'rejected');
```

Gotcha: PostgreSQL enums can gain values (`ALTER TYPE ... ADD VALUE`) but cannot lose them. Adding a value to a SQLAlchemy `SAEnum(...)` in the model does **not** change the database; it needs a hand-written migration (none exists yet for any enum change).

### Text-valued "enums" (app-enforced)

| Column | Values |
|--------|--------|
| `leads.type` | `property_inquiry`, `booking`, `buyer_interest`, `seller_interest` |
| `leads.status` | `new`, `assigned`, `contacted`, `closed` (+ `cancelled` for booking leads) |
| `bookings.status` | `pending`, `confirmed`, `cancelled` |
| `bookings.payment_status` | `unpaid`, `authorized`, `captured`, `voided`, `refunded` |
| `bookings.payout_status` | `pending`, `paid`, `failed` |
| `bulk_import_jobs.status` | `pending`, `running`, `completed`, `failed` |
| `listings.deal_discount_type`, `deal_requests.discount_type` | `pct` (default), otherwise a fixed amount |
| `listing_events.event_type` | `submitted`, `approved`, `rejected`, `archived`, `edit_submitted`, `edit_approved`, `edit_rejected`, `realtor_assigned`, `realtor_unassigned` |
| `activity_log.event_type` | see the `activity_log` section |

---

## Migrations

Alembic 1.18.x, configuration in `realty-api/alembic.ini` and `realty-api/alembic/env.py`. `env.py` ignores the placeholder URL in `alembic.ini` and uses `settings.database_url` (the `DATABASE_URL` env var) and the models' metadata. Migration files are in `realty-api/alembic/versions/`.

### Current head

There is exactly **one head: `bc364345c64b`** (add `owner_paypal_email` to listings), and one root: `434d4c5bb8b6`. This was determined by walking every `down_revision` in the 39 migration files. Check at any time with `alembic heads` (must print one line) and `alembic current`.

The graph is linear except for a harmless shortcut: `e2f3a4b5c6d7` declares two parents, `('d5e6f7a8b9c0', 'f4a6b8c2d0e1')`. Because `f4a6b8c2d0e1` is already an ancestor of `d5e6f7a8b9c0` (via `a2b3c4d5e6f7` and `b1c2d3e4f5a6`), this is a redundant merge, not a real branch. Alembic accepts it. If `alembic heads` ever shows two heads, someone created a revision off an old parent; fix it with `alembic merge`.

### The chain, in order

Revision ids are random-looking; the file names carry the meaning. "Idempotent" means the migration uses `IF NOT EXISTS` / `if_not_exists=True` / conditional `DO $$` blocks so it can run against a schema that already has the change.

| # | Revision | Purpose |
|---|----------|---------|
| 1 | `434d4c5bb8b6` | Root. Adds `users.email_verified`, `verification_code`, `verification_code_expires_at`. Assumes `users` already exists |
| 2 | `b3d3d4b931c8` | Listings: lot size, ROI, seller financing, HOA, tax exempt, gated community, construction status, year built, features, maps URL, tag |
| 3 | `c1e5f8a2d934` | Users: `verification_attempts`, `last_code_sent_at` (rate limiting) |
| 4 | `f4a6b8c2d0e1` | Listings: `view_count`, `updated_at` |
| 5 | `a2b3c4d5e6f7` | Listings: `latitude`, `longitude` |
| 6 | `b1c2d3e4f5a6` | Create `listing_edits` + `listing_edit_status` enum |
| 7 | `d5e6f7a8b9c0` | `listings.bathrooms` integer to `numeric(3,1)` (only if still integer) |
| 8 | `e2f3a4b5c6d7` | Create `activity_log` (redundant merge of #7 and #4) |
| 9 | `a1b2c3d4e5f6` | Deal of the week: `listings.is_deal`, `deal_discount_pct`, create `deal_requests` + enum |
| 10 | `b2c3d4e5f6a7` | Rename deal columns `*_pct` to `*_value` (numeric 12,2), add `*_type` (`pct` default) |
| 11 | `c3d4e5f6a7b8` | Google login: `users.google_id` + partial unique index, `password_hash` nullable |
| 12 | `d4e5f6a7b8c9` | `users.avatar_url` |
| 13 | `e5f6a7b8c9d0` | `users.user_code`: sequence, backfill by join date, DEFAULT, unique index |
| 14 | `e5f6a7b8c9d1` | Create `pending_users` |
| 15 | `a3b4c5d6e7f8` | Listings: `tags`, `video_links`, `tour_3d_url`, `utilities`, `included_utilities`, `association_fee`, `deposit_policy` |
| 16 | `f7a8b9c0d1e2` | Create `listing_events` |
| 17 | `g8h9i0j1k2l3` | Create `leads` + indexes |
| 18 | `h9i0j1k2l3m4` | Leads: `assigned_at`, `contacted_at`, `closed_at` |
| 19 | `i0j1k2l3m4n5` | Upgrade requests: `years_experience`, `specialties`, `bio` |
| 20 | `j1k2l3m4n5o6` | Leads: GHL columns `ghl_contact_id`, `ghl_sync_error`, `ghl_synced_at` |
| 21 | `k2l3m4n5o6p7` | Listings: `co_listing_*` columns |
| 22 | `l3m4n5o6p7q8` | Create `settings` singleton (`CHECK id = 1`) and seed row |
| 23 | `m1n2o3p4q5r6` | `users.deletion_requested_at` |
| 24 | `n2o3p4q5r6s7` | `users.password_reset_token` (+ unique index), `password_reset_expires` |
| 25 | `o3p4q5r6s7t8` | `listings.share_image_url` |
| 26 | `p4q5r6s7t8u9` | `listings.assigned_realtor_id` (FK, SET NULL) + index |
| 27 | `q5r6s7t8u9v0` | Listings: `source_ref` (partial unique index), `currency`, `co_listing_agent_email` |
| 28 | `r6s7t8u9v0w1` | Create `bulk_import_jobs` |
| 29 | `s7t8u9v0w1x2` | Data fix: backfill NULL `users.user_code`, re-sync the sequence (not reversible) |
| 30 | `t8u9v0w1x2y3` | `listings.description_es` |
| 31 | `u9v0w1x2y3z4` | Index `listings (status, created_at DESC)` for paginated lists |
| 32 | `ed856ef1081c` | Listings: `price_per_day`, `price_per_month`, `co_listing_agreement_accepted/url`; `users.calendly_url` |
| 33 | `7c5858ba04a9` | Listings: `co_listing_brokerage_email`, `co_listing_brokerage_phone` |
| 34 | `4f1c3506e1d4` | `users.assigned_realtor_id` (FK, SET NULL) + index |
| 35 | `0049637f62fa` | `users.paypal_email` |
| 36 | `b813c2be2e88` | Bookings: PayPal order/authorization/capture ids, `payment_status`, `payout_status`, `booked_price_per_day`, `needs_admin_review` |
| 37 | `f9901a9c3ae1` | Guest bookings: `buyer_id` nullable, `guest_name`, `guest_email`, `lead_id` |
| 38 | `6c8499222d3a` | Bookings: `platform_fee`, `payout_amount` |
| 39 | `bc364345c64b` | **Head.** `listings.owner_paypal_email` |

### Idempotency (important for production)

- **Revisions #32 to #39** (`ed856ef1081c` through `bc364345c64b`) were deliberately made idempotent. Production already had these columns because they were applied by hand outside Alembic before the revisions existed (the PayPal/booking work), so a plain `ADD COLUMN` would have aborted the deploy. They use `op.add_column(..., if_not_exists=True)` or `ADD COLUMN IF NOT EXISTS`, and their downgrades use `if_exists=True`. The API commit "Make the PayPal migrations idempotent so they can deploy onto production" introduced this pattern for the PayPal/booking-era revisions.
- **Revisions #19, #21, #22, #23, #24** (and most others) carry a comment that they use `IF NOT EXISTS` "so the chain can also run against a create_all-built schema". Nearly every revision in the chain uses `IF NOT EXISTS` / `DO $$ ... IF EXISTS` guards; this is the repo convention, so write new migrations the same way.
- Conditional logic worth knowing: #7 only alters `bathrooms` if it is still an integer; #9 only adds `deal_discount_pct` when `deal_discount_value` is absent; #10 only renames columns that still have the old name; #6, #9 create enum types inside `EXCEPTION WHEN duplicate_object` blocks.
- Not idempotent / not safely reversible: #29 (data backfill, `downgrade` is a no-op), #37's downgrade (re-adds `NOT NULL` to `bookings.buyer_id`, which fails once any guest booking exists), #13's downgrade (drops `user_code` and its sequence, destroying the numbers).

### How to run migrations

From `realty-api/` with `DATABASE_URL` set (in `.env` locally):

```bash
alembic upgrade head      # apply everything not yet applied
alembic current           # show the revision recorded in alembic_version
alembic heads             # must show exactly one head (bc364345c64b)
alembic history           # print the chain
alembic downgrade -1      # step back one revision (rarely safe, see above)
```

The container runs `alembic upgrade head` automatically on every start (see below), so a new migration is applied the next time the API is deployed or restarted. There is no separate migration step in the repo.

When adding a migration: create it with `alembic revision -m "short description"`, write the SQL by hand with `IF NOT EXISTS` guards, make `down_revision` the current head, and update the model in `models/` too. Avoid `--autogenerate`: the models and migrations have known drift (below), so it will emit unrelated diffs.

### Bringing up a brand-new database

No migration creates the core tables. The oldest revision (`434d4c5bb8b6`) already assumes `users` exists. The schema originally came from `Base.metadata.create_all()`, and that call was lost from `main.py` at some point, which made the API crash on an empty database with `relation "users" does not exist`. The fix (commit "Let the API start against a brand-new database") added `realty-api/bootstrap_db.py`, run before Alembic.

`bootstrap_db.py` logic:

| Database state | Action |
|----------------|--------|
| Has an `alembic_version` table | Nothing (normal deploys) |
| Completely empty | `Base.metadata.create_all()` creates every table in `models/` (with enum types and the `users_user_code_seq` sequence). Does **not** stamp a revision |
| Has tables but no `alembic_version` | Logs a warning and leaves it alone. You must pick the right revision and run `alembic stamp <revision>` yourself |

After bootstrap, `alembic upgrade head` runs the **entire** chain against the freshly created tables. This is intentional and must not be replaced by `alembic stamp head`: some schema exists only in migrations (the `user_code` DEFAULT and sequence ownership, `ix_*` indexes, the `settings` seed row, the `listings (status, created_at)` index). Because migrations are written with `IF NOT EXISTS`, steps that `create_all` already did are skipped.

Startup commands:
- `Dockerfile` (used by Railway): `sh -c "python bootstrap_db.py && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"`, Python 3.11.
- `Procfile` (non-Docker platforms): the same three commands, but the default port is 8080.
- `railway.toml`: builder `DOCKERFILE`; health check `GET /health` with a 30 s timeout; restart policy `ON_FAILURE`, max 3 retries.
- `main.py` does **not** create tables. Its lifespan only starts two background tasks: `_cleanup_pending_users` (hourly) and `_payout_cron` (daily 00:01 UTC). If bootstrap or a migration fails, the container exits before uvicorn starts, so the health check never passes and the deploy fails.

Checklist for a new environment:
1. Create an empty PostgreSQL database and set `DATABASE_URL` (see `.env.example` for the full variable list; never commit real values).
2. Deploy, or run locally `python bootstrap_db.py && alembic upgrade head`.
3. Confirm `alembic current` prints `bc364345c64b (head)` and `GET /health` returns ok.
4. Create the first admin. No migration or env var creates one. Either promote a verified account with SQL (`UPDATE users SET role = 'admin' WHERE email = '...'`), or in development run `seed.py`. Once one admin exists, more users can be created from the admin panel (`POST /admin/users`).
5. Set the `notify_email` setting (or `NOTIFY_EMAIL` env var) if admin notification emails are wanted.

### Seeding demo data

`python seed.py` (from `realty-api/`, after migrations) inserts four demo users (`buyer@`, `owner@`, `realtor@`, `admin@seed.com`, all sharing one known password printed by the script), six demo listings, bookings, inquiries and saved homes. It is idempotent (skips rows matched by email or listing title). **Never run it against production**: it creates an admin account with a publicly known password. Seed users are inserted directly into `users` with `email_verified = true`, bypassing `pending_users`.

---

## Known drift and risks

Differences between the models (what `create_all` builds on a fresh database) and the migration chain (what legacy/production databases have). None breaks the app today, but they matter when comparing environments.

1. **Duplicate unique indexes on bootstrapped databases.** `create_all` makes unique constraints on `users.user_code`, `users.google_id`, `listings.source_ref` and `pending_users.email`; the migrations then add differently named unique indexes (`uq_users_user_code`, `ix_users_google_id` (partial), `ix_listings_source_ref` (partial), `uq_pending_users_email`). Legacy production has only the migration versions.
2. **`users.password_reset_token` index.** The model declares a plain index named `ix_users_password_reset_token`; the migration declares a unique index of the same name. Whichever runs first wins, so a bootstrapped DB gets a non-unique one and legacy DBs a unique one. Tokens are SHA-256 hashes, so collisions are not a practical concern.
3. **`settings` singleton `CHECK (id = 1)`** exists only where the migration created the table (legacy DBs), not on bootstrapped databases.
4. **`listings.assigned_realtor_id` FK** is `ON DELETE SET NULL` on legacy DBs (migration `p4q5r6s7t8u9`) but `NO ACTION` on bootstrapped DBs (the model omits `ondelete`). Deleting a realtor user row who still has assigned listings fails on a bootstrapped DB.
5. **Python-side defaults are not in the DDL.** For example `users.email_verified`, `bookings.status`, `bookings.guests` and `settings.id` only have SQLAlchemy `default=`, so raw SQL inserts must supply them. Legacy DBs additionally got a DB default for `email_verified` from the migration.
6. **Missing indexes** on hot paths: `bookings` (`listing_id`, `buyer_id`, `lead_id`, `check_in`/`check_out`, `payment_status`/`payout_status`), `leads.property_id`, `inquiries.listing_id`/`from_user_id`, `saved_homes.listing_id`, `listings.submitted_by`/`owner_id`. Fine at current volume; worth adding as bookings and the ~5,300-listing import grow.
7. **Dates as text.** `bookings.check_in` / `check_out` are `text` (ISO `YYYY-MM-DD`), not `date`, and booking-lead dates are parsed out of `leads.message` with a regex. Any change to that message format breaks the guest-booking views.
8. **Unused or half-used schema:** `anonymous_leads` (no route uses it), `listing_status.draft`, `bookings.payment_status = 'refunded'`, the legacy verification columns on `users`.
9. **Lead status `schedule`.** `PUT /realtor/leads/{id}/status` allows `schedule`, which is not a valid status elsewhere (GHL tags, UI). Probably meant to be `assigned`.
10. **Missing cascades on user/listing deletion.** Most FKs have no ON DELETE action, so hard-deleting a user or listing that has bookings, inquiries, saved homes, deal requests, or edits will fail. The API archives or suspends instead of deleting, and account deletion requests are manual (`users.deletion_requested_at`).
11. **Migrations run on every container start.** With more than one replica starting at once, two `alembic upgrade head` runs could race. Keep a single instance (or serialise deploys) when a pending migration exists.
12. **Platform fee** is applied from an env-configurable `PLATFORM_FEE_PCT` (default 0.20) at payout time and stored per booking in `platform_fee` / `payout_amount`; changing the setting does not alter already-paid bookings.
