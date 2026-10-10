# Bookings and Payments

Rental ("rent" transaction) listings can be booked by logged-in users and by anonymous guests. Payment is optional: when PayPal is enabled the guest pre-authorizes the nightly total, the owner's Accept captures it, and a nightly cron pays the owner (minus the platform fee) the day after check-out. Without PayPal the booking is a plain "request to book" that the owner accepts or declines.

Paths below are relative to the two repos: `realty-api/...` is the FastAPI backend; `apps/landing/...` and `apps/dashboard/...` are in the `realty` monorepo. Related docs: [leads.md](leads.md) (the lead every booking creates), [buyer-features.md](buyer-features.md), [owner-realtor.md](owner-realtor.md), [admin-tools.md](admin-tools.md).

## Key files

| Area | File | What it holds |
|---|---|---|
| API routes | `realty-api/routes/bookings.py` | All `/bookings` endpoints, availability helpers, guest-lead pseudo-bookings |
| API routes | `realty-api/routes/admin.py` (`GET /admin/bookings`, ~line 825) | Admin list of every booking incl. lead-only guest requests |
| API routes | `realty-api/routes/webhooks.py` (`POST /webhooks/paypal`) | PayPal event sync (same file also has the GHL webhook) |
| API service | `realty-api/services/paypal.py` | PayPal REST v2 client (orders, authorize, capture, void, payouts, refund, webhook verify) |
| API cron | `realty-api/main.py` (`_payout_cron`, `lifespan`) | Nightly payout task |
| Model | `realty-api/models/booking.py` | `bookings` table |
| Schemas | `realty-api/schemas/booking.py` | `BookingCreate`, `BookingResponse`, `CreatePaymentAuth*` |
| Email | `realty-api/utils/email.py` | Booking and payout emails (see Emails) |
| Config | `realty-api/config.py` | PayPal / fee / email env var definitions |
| Migrations | `realty-api/alembic/versions/` `b813c2be2e88` (payment cols), `f9901a9c3ae1` (guest cols, nullable `buyer_id`), `6c8499222d3a` (fee/payout cols), `ed856ef1081c` (`price_per_day/month`, `users.calendly_url`), `bc364345c64b` (`listings.owner_paypal_email`), `0049637f62fa` (`users.paypal_email`) | All are idempotent (`if_not_exists`); the base `bookings` table is not created by any migration (created outside Alembic) |
| Landing UI | `apps/landing/src/views/PropertyDetail.tsx` | Booking form, availability calendar, PayPal buttons (rent branch of the right sidebar, ~lines 1148-1405) |
| Landing API | `apps/landing/src/api/bookings.ts` | `createBooking`, `createPaymentAuth`, `getUnavailableDates` |
| Landing flag | `apps/landing/src/lib/features.ts` | `PAYPAL_ENABLED` |
| Dashboard API | `apps/dashboard/src/api/bookings.ts` | `Booking` type and all booking calls |
| Dashboard flag | `apps/dashboard/src/lib/features.ts` | `PAYPAL_ENABLED` (keep equal to landing) |
| Dashboard pages | `pages/buyer/Bookings.tsx`, `pages/owner/Bookings.tsx`, `pages/realtor/Bookings.tsx`, `pages/admin/Bookings.tsx`, `pages/owner/Earnings.tsx` | Role views (all under `apps/dashboard/src/`) |
| Dashboard shared | `components/dashboard/BookingDetailPanel.tsx` | Slide-over detail + Accept/Decline/Release/Request Payout buttons |
| Dashboard routing | `pages/Dashboard.tsx` (`bookings`, `owner-bookings`, `realtor-bookings`, `earnings`, `calendar` views) and `pages/AdminDash.tsx` | View keys; routes are `/:view` (App.tsx) |
| Scheduling links | `lib/scheduling.ts`, `components/dashboard/SchedulingFrame.tsx`, `components/dashboard/SetupBanners.tsx`, `pages/owner/Calendar.tsx`, `pages/realtor/Calendar.tsx` | Calendly / Google Calendar link (not booking availability, see below) |

## Data model (`bookings`)

| Column | Notes |
|---|---|
| `id`, `listing_id` (FK), `created_at` | |
| `buyer_id` | Nullable. Null for PayPal guest bookings |
| `guest_name`, `guest_email` | Only filled for guest (no account) PayPal bookings; logged-in guests resolve via `buyer_id` join |
| `lead_id` | Plain UUID (no FK) linking to the `leads` row created with the booking; set in a second commit after creation |
| `check_in`, `check_out` | **Text** `YYYY-MM-DD` (not Date). Comparisons rely on ISO strings sorting correctly |
| `guests` | 1-20 (schema validated) |
| `total_price` | `price_per_day * nights`, set at creation whenever the listing has a daily rate, even without PayPal |
| `booked_price_per_day` | Snapshot of the rate at booking time |
| `status` | `pending` / `confirmed` / `cancelled` |
| `paypal_order_id`, `paypal_authorization_id`, `paypal_capture_id` | |
| `payment_status` | `unpaid` (default) / `authorized` / `captured` / `voided` / `refunded` (type exists in the UI but the backend never sets it) |
| `payout_status` | `pending` (default) / `paid` / `failed` |
| `platform_fee`, `payout_amount` | Written only when a payout is executed (cron or admin release); null before that |
| `needs_admin_review` | Set true when a guest cancels a captured booking. Nothing reads it (no schema field, no UI) |

`listings` adds `price_per_day`, `price_per_month`, `owner_paypal_email`. `users` adds `paypal_email` and `calendly_url`.

## Guest vs logged-in flow

`POST /bookings` uses `get_optional_user` (auth is the `ildr_token` cookie or a Bearer header; see [auth.md](auth.md)), so one endpoint serves both.

| Case | Contact info source | Rows created | Visible to owner as |
|---|---|---|---|
| Logged in (with or without PayPal) | Account (`display_name`, `email`, `phone`) | `Lead` + `Booking` (`buyer_id` set, `lead_id` linked) | Booking row |
| Guest + PayPal order | Body `name`, `email`, `phone` (name and email required, else 422) | `Lead` + `Booking` (`buyer_id` null, `guest_*` set, `lead_id` linked) | Booking row |
| Guest, no PayPal (including all "monthly" and no-daily-rate requests, or PayPal disabled) | Body fields | `Lead` only | Pseudo-booking derived from the lead (see below) |

Lead-only pseudo-bookings: `_lead_to_booking_response` rebuilds a `BookingResponse` by regex-parsing the lead message `Check-in: YYYY-MM-DD, Check-out: YYYY-MM-DD, Guests: N` (the message format written in `create_booking` is a data contract; changing it breaks these rows). The "booking id" returned to the UI is the **Lead UUID**; `accept`/`decline` try a Booking row first, then fall back to the lead. Lead status maps to booking status: `closed` -> `confirmed`, `cancelled` -> `cancelled`, anything else -> `pending`. Payment fields are fixed at `unpaid`/null.

Guests have no cancel path: `PUT /bookings/{id}/cancel` filters on `buyer_id == user.id`, so a PayPal guest or lead-only guest cannot cancel in-app.

## Availability and double-booking prevention

- **Endpoint:** `GET /bookings/unavailable/{listing_id}` (public, no auth, no rate limit) returns `[{check_in, check_out}]`. Built by `_blocked_ranges()`.
- **What blocks dates:** only *committed* stays: `Booking.status == "confirmed"`, plus lead-only guest requests whose `Lead.status == "closed"` and that have no Booking row (leads linked through `Booking.lead_id` are skipped so the Booking status is the single source of truth). `pending` requests never block, so several overlapping pending requests can coexist by design. A cancelled booking frees its dates immediately.
- **Overlap rule:** half-open `[check_in, check_out)`; `ci < other_out and co > other_in`, so same-day turnover (check in on another guest's check-out day) is allowed (`_dates_available`).
- **Where enforced (all application level, no DB exclusion constraint or unique index):**
  1. `POST /bookings/create-payment-auth` and `POST /bookings`: 409 `DATES_TAKEN_MSG` before any PayPal order/authorization is created. Not locked, so two near-simultaneous requests can both pass (fine, both only become `pending`).
  2. `PUT /bookings/{id}/accept`: `_lock_listing()` does `SELECT ... FOR UPDATE` on the listing row, then re-runs `_dates_available(..., exclude_booking_id/exclude_lead_id)` **before capturing payment**, then sets confirmed and commits. This is the real double-booking guard; concurrent accepts of overlapping requests serialize on the listing lock.
  3. Additional per-buyer rule for logged-in users: 409 if the same user already has a non-cancelled booking for that listing overlapping the dates. Guests are not checked.
- **Frontend:** `PropertyDetail.tsx` loads ranges for `rent` listings (`getUnavailableDates`) and uses `isDateBooked`, `rangeBooked`, `isCheckoutBlocked` to reject picks client-side; the Availability month grid greys booked and past days (booked days: strikethrough). Clicking a free day opens the form with that check-in. A 409 from the API is shown as `booking.error_date_unavailable`. Owner Accept 409s show `bookings_page.dates_conflict` in the owner/realtor Bookings pages.
- **Not supported:** owner-defined blackout dates, min/max stay, guest count vs property capacity, auto-declining other pending requests when one is accepted (their PayPal authorizations stay open until the owner declines or they expire).

## Pricing

| Item | Rule |
|---|---|
| Nights | `(check_out - check_in).days`, must be > 0 |
| Total (USD) | `float(price_per_day) * nights`, computed in `create_payment_auth` and again in `create_booking` (floats, not Decimal) |
| Monthly | `price_per_month` is **display-only**: nothing in the backend reads it. UI offers a Daily/Monthly toggle when both rates exist; "monthly" shows no PayPal button and submits a plain request with `total_price` still derived from the daily rate (or null if none) |
| Currency | PayPal always USD. Landing shows a USD/DOP toggle using a client-side rate from `open.er-api.com`; DOP is display only |
| Platform fee | `round(total * PLATFORM_FEE_PCT, 2)`, default `0.20`. Payout = `round(total - fee, 2)` |
| Guest-visible extras | None: no taxes, cleaning fee, or deposit calculation. `booking.deposit_disclaimer` (property_detail locale) is copy only: payment non-refundable once accepted, exceptions reviewed manually |
| Amount check | After `authorize_order`, PayPal's reported amount must be USD and within 0.01 of `total`, else the authorization is voided and the API returns 422 |

`platform_fee` / `payout_amount` are stored only when a payout runs, so the dashboard shows "Platform fee (20%)" / "Your payout" only after payout. The "20%" label in `BookingDetailPanel.tsx` is hard-coded and will be wrong if `PLATFORM_FEE_PCT` changes. `owner/Earnings.tsx` sums gross `total_price` of confirmed bookings (not net of fee, and includes unpaid/request-only bookings).

## PayPal flow

Config (names only): backend `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE` (`sandbox` default, or `live`), `PLATFORM_FEE_PCT`. Landing build-time `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (must match the API app/mode). Frontend master switches: `PAYPAL_ENABLED` in `apps/landing/src/lib/features.ts` and `apps/dashboard/src/lib/features.ts` (both currently `true`; keep in step).

What each switch does:

| Switch | Effect |
|---|---|
| Landing `PAYPAL_ENABLED=false` or no `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | No PayPal buttons, no disclaimer; form falls back to plain "Request to book" |
| Dashboard `PAYPAL_ENABLED=false` | Hides payout email capture (Settings), the owner PayPal setup banner and listing-creation gate, Release/Request Payout buttons, owner PayPal email fields in listing forms/panels |
| Backend `PAYPAL_CLIENT_ID` empty | `create-payment-auth` returns 503; `POST /bookings` ignores `paypal_order_id`; accept/decline/cancel skip all PayPal calls; payout cron loops without doing anything. Authorizations that already exist are then never captured or voided by the API |

Sequence (daily rate, PayPal enabled):

1. Guest opens the form and clicks the PayPal button. `createOrder` -> `POST /bookings/create-payment-auth` (public). API checks listing active, `transaction == rent`, `price_per_day` set, `nights > 0`, dates free (409), then `paypal.create_order` (`intent=AUTHORIZE`, USD) and returns `paypal_order_id` + `amount_usd`.
2. Guest approves in the PayPal popup. `onApprove` -> `POST /bookings` with `paypal_order_id`.
3. API re-checks dates, builds the Lead, then `paypal.authorize_order` -> authorization id, amount check (above). Booking saved `status=pending`, `payment_status=authorized`. **No money is taken yet.**
4. Owner/submitter **Accept** (`PUT /bookings/{id}/accept`): lock listing, re-check dates, `paypal.capture_authorization`, store `paypal_capture_id`, `payment_status=captured`, `status=confirmed`. Capture failure -> 502, booking stays pending.
5. **Decline** (`/decline`) or buyer **Cancel** while still authorized -> `paypal.void_authorization`, `payment_status=voided`, `status=cancelled`. A failed void is only logged; status still flips to cancelled and `payment_status` stays `authorized`.
6. After check-out, the cron (or admin) calls `paypal.create_payout` (PayPal Payouts API, needs Payouts approval on the business account) to the owner's PayPal email. `sender_batch_id` is `booking-{id}` and `sender_item_id` is the booking id, so PayPal de-duplicates repeats and the webhook can find the booking.

Payout recipient resolution (cron and manual release): `listing.owner_paypal_email` first, else `paypal_email` of `listing.owner_id or listing.submitted_by`. Realtors have no PayPal field in Settings (Owner role only), so realtor-submitted listings need the per-listing `owner_paypal_email` (required in the listing forms when a daily rate is set and PayPal is enabled).

Webhook `POST /webhooks/paypal` (verified via PayPal's verify-webhook-signature API using `PAYPAL_WEBHOOK_ID`; rejects with 401 if unverifiable or the id is unset):

| Event | Action |
|---|---|
| `PAYMENT.AUTHORIZATION.VOIDED` | match `paypal_authorization_id` -> `payment_status=voided` |
| `PAYMENT.CAPTURE.COMPLETED` | match `paypal_capture_id` -> `payment_status=captured` |
| `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` | match booking id (`sender_item_id`) -> `payout_status=paid` |
| `PAYMENT.PAYOUTS-ITEM.FAILED` | `payout_status=failed`, logged as error |
| `CUSTOMER.DISPUTE.CREATED` | log only. No dispute handling exists |

`paypal.refund_capture()` exists but is never called; there is no refund flow in the code. Captured payments are non-refundable by policy; a buyer cancelling a captured booking just sets `needs_admin_review=true` and `status=cancelled` (staff must refund manually in PayPal).

## Status state machine

`bookings.status` (there is no `completed` state; "past" is derived from dates in the UI):

| From | To | Trigger | Who | Notes |
|---|---|---|---|---|
| (new) | `pending` | `POST /bookings` | guest or logged-in | Always starts pending, even when paid |
| `pending` | `confirmed` | `PUT /{id}/accept` | listing `owner_id` or `submitted_by` only | Captures payment; admins who are not owner/submitter get 404 |
| `pending` | `cancelled` | `PUT /{id}/decline` | owner/submitter | Voids authorization; emails guest |
| `pending` / `confirmed` | `cancelled` | `PUT /{id}/cancel` | the booking's `buyer_id` only | Voids if authorized; flags review if captured; no date check server-side (UI only offers it before check-in) |
| `confirmed` | `cancelled` | none for owner | | Owners have no cancel/refund endpoint |

Payment: `unpaid` -> `authorized` (create) -> `captured` (accept) or `voided` (decline/cancel/webhook). Payout: `pending` -> `paid` (cron/admin/webhook) or `failed` (cron/admin/webhook); `failed` -> `paid` via admin release or webhook success.

Lead-only guest requests use the lead status instead (`closed` = accepted, `cancelled` = declined). Accepting a lead sets `closed`; the Leads admin page or the GHL webhook can also move a lead to `closed`, which would silently count as an accepted booking and block those dates.

## Endpoint summary (`realty-api/routes/bookings.py` unless noted)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /bookings/unavailable/{listing_id}` | public | Committed date ranges |
| `POST /bookings/create-payment-auth` | public | Create PayPal order |
| `POST /bookings` | optional | Create booking + lead |
| `GET /bookings/mine` | logged in | Own Booking rows (`buyer_id`) |
| `GET /bookings/for-owner` | logged in (not role-gated; filtered to listings where user is `owner_id` or `submitted_by`) | Booking rows + lead-only guest requests, sorted by `check_in`. Realtors using `assigned_realtor_id` only do not see them |
| `PUT /bookings/{id}/cancel` | buyer owner of row | |
| `PUT /bookings/{id}/accept`, `/decline` | listing owner/submitter | `id` may be a Booking or a guest Lead UUID |
| `POST /bookings/{id}/release-payout` | admin | Manual payout / retry |
| `POST /bookings/{id}/request-payout` | listing owner/submitter | Only when `payout_status == failed`; emails admin, changes no state, can be repeated |
| `GET /admin/bookings` (`routes/admin.py`) | admin | All bookings + lead-only guest requests, newest first, with `owner_name` |
| `POST /webhooks/paypal` (`routes/webhooks.py`) | PayPal signature | Sync statuses |

No endpoint here is rate limited (contrast `POST /leads`, 3/min).

## Admin bookings page and release payout

`apps/dashboard/src/pages/admin/Bookings.tsx` (`AdminBookings`, rendered for role Admin on the `bookings` view): KPI cards (Total, Pending, Confirmed, Failed Payout), filter pills (All / Pending / Confirmed / Cancelled / Failed Payout), text search (guest name/email, listing, owner), desktop table + mobile cards, and the shared `BookingDetailPanel` (`isAdmin`). Admin is read-only for accept/decline. "Release Payout" shows when `PAYPAL_ENABLED && payment_status == captured && payout_status != paid` and posts `POST /bookings/{id}/release-payout` after a confirm step, then marks the row paid locally. Backend `release_payout` requires `payment_status == captured`, `payout_status != paid`, and a resolvable PayPal email; it computes the fee, calls `create_payout`, stores `platform_fee`/`payout_amount`/`paid`, or sets `failed` and returns 502. It does **not** check `booking.status` or the check-out date, so it can pay out early or for a cancelled-but-captured booking. It sends no email.

Owners and realtors see Payout sent / Payout failed badges; for failed payouts the detail panel (and the row) shows "Request Payout" which calls `request-payout` (emails admin).

## Payout cron

`_payout_cron()` in `realty-api/main.py` is an in-process `asyncio` task started in the FastAPI `lifespan` (alongside the pending-user cleanup task); there is no external scheduler.

- Wakes daily at 00:01 UTC. Skips the run entirely if `PAYPAL_CLIENT_ID` is empty.
- Selects bookings with `check_out == yesterday` (exact day, `date.today() - 1` in the server's local timezone), `payment_status == captured`, `payout_status == pending`, `status == confirmed`.
- For each: resolve payout email (see above); if none, logs a warning and skips (no alert, never retried by the cron). Computes fee and payout, calls `create_payout`, stores `platform_fee`, `payout_amount`, `payout_status=paid`; on exception sets `failed` and emails `settings.notify_email` via `send_admin_payout_failed_email`. Commits once at the end.
- Owner "payout released" email is sent only if the recipient was resolved from a **user** record; when the listing-level `owner_paypal_email` override is used no email goes out.

## Emails (`realty-api/utils/email.py`)

All send through `_send` (Resend; prints `[DEV]` and sends nothing when `RESEND_API_KEY` is empty). Booking-route sends are wrapped in `try/except: pass`, so failures are silent.

| Function | Trigger | Recipient |
|---|---|---|
| `send_lead_notification` | `POST /bookings` (after commit and `ghl.create_contact`) | notify email (`SiteSettings.data.notify_email` override, else `NOTIFY_EMAIL`) |
| `send_booking_submitted_email` | `POST /bookings` | guest (`is_paypal` adds "authorized, not charged until accepted" notice) |
| `send_owner_new_booking_email` | `POST /bookings` | listing owner (if has account) and, if a different user, the listing submitter |
| `send_booking_confirmed_email` | accept (Booking or lead) | guest (account email or `guest_email`; lead email for lead-only) |
| `send_booking_declined_email` | decline | guest |
| `send_owner_payout_released_email` | payout cron success | owner user (see caveat above) |
| `send_admin_payout_failed_email` | payout cron failure | `NOTIFY_EMAIL` env only (ignores the SiteSettings override) |
| `send_payout_request_email` | `request-payout` | notify email (503 if none configured) |

No email is sent for a guest-initiated cancel, a manual admin payout, or a webhook-driven status change. Links in emails use `LANDING_URL` (`/dashboard` for the owner email).

## The lead created for every booking

Still true: `create_booking` always inserts `Lead(type="booking")` first. `status="assigned"` with `assigned_realtor_id = listing.owner_id or listing.submitted_by` (so the assignee may be an owner, not a realtor) and `assigned_at` set; otherwise `status="new"`. It then calls `ghl.create_contact(lead, property_info, db)` and `send_lead_notification`. `LeadResponse.booking_status` in `routes/leads.py` is looked up through `Booking.lead_id`. Booking decline/cancel do not update the lead; only lead-only guest accept/decline mutate lead status.

## Scheduling links (Calendly / Google Calendar)

Separate from booking availability. Owners and realtors store one public scheduling URL in `users.calendly_url` (column name predates Google support). `apps/dashboard/src/lib/scheduling.ts` infers the provider from the host (`calendly.com` vs `calendar.app.google` / `calendar.google.com/.../appointments/`), validates on input (client-side only; the API `PUT /auth/me` just trims, max 500 chars), and `schedulingEmbedUrl` returns an iframe URL (Google short links send `X-Frame-Options: SAMEORIGIN`, so they fall back to an "open in new tab" card in `SchedulingFrame.tsx`). `owner/Calendar.tsx` and `realtor/Calendar.tsx` render that frame (the "Calendar" nav item is **not** a booking calendar). `SetupBanners.tsx` / `useListingSetup`: realtors need a scheduling link to add listings; owners need that plus a PayPal payout email while `PAYPAL_ENABLED`. Backend `utils/email.py` `_is_google_scheduling_url` only changes the label ("Google Calendar" vs "Calendly") in `send_realtor_lead_assigned_email`.

## UI file map

| Surface | File | Behavior |
|---|---|---|
| Public booking | `apps/landing/src/views/PropertyDetail.tsx` | `bookingForm` state, daily/monthly toggle, name/email/phone/dates/guests/notes, PayPal Buttons (`intent: authorize`, USD) shown only when `PAYPAL_CLIENT_ID && transaction == rent && price_per_day && rentalType == daily`; plain "Request" button otherwise; month availability grid; shows `me` data (`getMe`) for prefill |
| Buyer | `apps/dashboard/src/pages/buyer/Bookings.tsx` | Tabs all/upcoming/past/cancelled; Cancel (ConfirmModal) for pending/confirmed with `check_in >= today`; does not show payment status |
| Owner | `pages/owner/Bookings.tsx` | Sections pending / upcoming / past / cancelled; Accept/Decline with 409 handling; payment and payout badges; detail panel |
| Realtor | `pages/realtor/Bookings.tsx` | Same as owner but via `getRealtorBookings` (same `/bookings/for-owner` endpoint) and `showGHL` link in the panel |
| Owner earnings | `pages/owner/Earnings.tsx` | KPIs and 6-month bar chart from confirmed bookings' gross `total_price` |
| Admin | `pages/admin/Bookings.tsx` | See above |
| Home cards | `components/dashboard/OwnerHome.tsx`, `BuyerHome.tsx` | Booking summaries / upcoming trip KPI |
| Dead code | `createBooking` in `apps/dashboard/src/api/bookings.ts` | Not called anywhere |

Dashboard strings live in the i18n namespaces `buyer`, `owner`, `realtor`, `common`; landing strings in `locales/{en,es}/property_detail.json` (`booking.*`, `sidebar.*`).

## Gotchas and risks

- **No DB-level overlap protection.** Safety depends on `_lock_listing` + recheck inside accept; anything that sets `confirmed` or lead `closed` elsewhere bypasses it.
- **Public lead injection.** `POST /leads` (3/min) accepts `type: "booking"`; a crafted message in the `Check-in: ..., Check-out: ...` format creates a fake pseudo-booking in an owner's queue, and accepting it blocks those dates.
- **Public, unthrottled PayPal order creation.** `create-payment-auth` and `POST /bookings` have no auth or rate limit.
- **`owner_paypal_email` is exposed on the public listing endpoint** (`GET /listings/{id}` returns every listing column via `ListingResponse`).
- **Monthly requests look broken.** In monthly mode the landing form renders no date inputs, so `check_in`/`check_out` may be empty and the API rejects the request (422, shown as a generic error). `price_per_month` is unused server side.
- **Pending requests never expire**, and authorizations eventually lapse at PayPal; a late accept then fails with 502 on capture. Competing pending requests are not auto-declined.
- **Cron fragility.** One exact-day window, in-process (restart at 00:01 skips the day; multiple replicas would each run it), local-date vs UTC mismatch, blocking synchronous `httpx` calls inside the async task, skipped bookings without a PayPal email are silent. Recovery path is admin Release Payout.
- **Admin release has no status/date guard** and sends no email.
- **Cancelling a captured booking** takes no refund action; `needs_admin_review` is write-only, so staff only learn from the booking being `cancelled` with `payment_status=captured`.
- **Swallowed errors.** Void failures on cancel/decline and all booking emails fail silently (logged for void only).
- **Floats for money** and tolerance-based amount check; if the listing's `price_per_day` changes between order creation and booking, `total` mismatches and the authorization is voided with a 422.
- **Timezones.** Landing uses `toISOString()` (UTC) for "today"; the API validator uses server `date.today()`.
- **Payout fee label** hard-coded to 20% in the UI; real value is `PLATFORM_FEE_PCT`.
- **Dates are strings** in `bookings`; always `str()` and compare ISO strings.
- **No tests** exist for bookings or PayPal in either repo; verify with a PayPal sandbox (`PAYPAL_MODE=sandbox`) end to end.
