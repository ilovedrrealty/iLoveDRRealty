# Owner & Realtor Roles

## Overview

The dashboard has four roles: Buyer (default for every account), Owner, Realtor and Admin (see [admin-tools.md](admin-tools.md)). This doc covers the two elevated, non-admin roles. An **Owner** is a property holder who lists *rental* properties, either themselves or through an assigned realtor, and receives booking payouts. A **Realtor** is a licensed agent who submits and manages sale and rental listings, works assigned leads in a pipeline, handles bookings on listings they submitted, and connects a scheduling page for clients.

How access is granted (never automatic, never self-service):

- **Realtor:** a Buyer submits an upgrade request with a questionnaire (`POST /upgrade-requests`: license number, territory, years of experience, specialties, bio). An admin approves or rejects it on the Users page; approval sets `users.role = 'realtor'` and emails the user.
- **Owner:** the dashboard path does **not** create an upgrade request. The "List My Property" form submits a `seller_interest` lead. When an admin assigns a realtor to that lead, the submitter is promoted from `buyer` to `owner` and linked to that realtor (`users.assigned_realtor_id`) — see [leads.md](leads.md). An admin can also set a role directly (`PUT /admin/users/{id}/role`) or create a pre-verified user with any non-admin role. The API would accept `requested_role: "owner"` on `/upgrade-requests`, and the admin Users page would approve it, but no UI sends it.
- Until promoted, Buyers see the Owner/Realtor tabs as a blurred preview with a "pending review" state (`LockedView`). This lock is UI-only; the API enforces roles per endpoint (`require_role`).

**Owners can now submit their own listings** (rental only) as well as have a realtor do it. Listings an owner submits are `pending_approval` and carry both `submitted_by` and `owner_id` = the owner. Listings created by a realtor or admin on the owner's behalf are read-only for the owner (they can "Request change" or request a Deal of the Week through the UI). In both cases listing edits to active listings go through the admin edit-approval queue — see [listings.md](listings.md).

**Listing setup gate (front-end only).** Before any "Add listing" button is enabled, `useListingSetup` (`apps/dashboard/src/components/dashboard/SetupBanners.tsx`) requires a connected scheduling page (Calendly *or* Google Calendar appointment page, stored in `users.calendly_url`) for realtors and owners, plus — for owners, while `PAYPAL_ENABLED` is true in `src/lib/features.ts` — a PayPal payout email (`users.paypal_email`). Realtors are not required to connect PayPal (the owner's PayPal email is entered per listing instead). The same hook drives the reminder banners shown on every owner/realtor screen (`SETUP_BANNER_VIEWS` in `pages/Dashboard.tsx`) and Home. The backend does not enforce this gate.

Related: [bookings-payments.md](bookings-payments.md) (bookings, earnings, payouts), [auth.md](auth.md) (profile/Settings, `/auth/me`), [leads.md](leads.md).

---

## Dashboard App

All paths below are under `apps/dashboard/src/` unless noted. Role routing: `pages/Dashboard.tsx` switches on `view`; `layouts/DashLayout.tsx` holds the per-role sidebar (`NAV`):

| Role | Sidebar views |
|---|---|
| Owner | `listings`, `calendar`, `owner-bookings`, `leads`, `earnings` (plus General: `home`, `settings`) |
| Realtor | `listings`, `leads`, `realtor-bookings`, `pipeline`, `calendar` |

### Shared pieces

- `components/dashboard/shared.tsx` — presentational primitives: `Card`, `CardLink`, `StatusPill`, `RoleKpiCard`, `SceneThumb`, `fmtPrice` (K/M abbreviation).
- `components/dashboard/SetupBanners.tsx` — `useListingSetup(user, 'owner'|'realtor')` -> `{calendlyMissing, paypalMissing, canAddListings, blockedReason}` and the `<SetupBanners>` reminders linking to `settings:connections`.
- `lib/scheduling.ts` + `components/dashboard/SchedulingFrame.tsx` — provider detection from the stored URL (`calendar.app.google` or `calendar.google.com/.../appointments/` = Google, otherwise Calendly), strict validation on connect (https only; Calendly host `calendly.com`), and the embed rules: Calendly and long-form Google appointment URLs render in an iframe; `calendar.app.google` short links send `X-Frame-Options` so they render a "open in new tab" card instead.
- `lib/features.ts` — `PAYPAL_ENABLED` flag (keep in step with the landing app's flag).
- `pages/Settings.tsx` (`UserSettings`) — tabs Profile / Security / Notifications, plus **Connections** for owners and realtors: connect/disconnect the scheduling page (provider picker) and, owners only, the PayPal payout email. Each save calls `PUT /auth/me` with the *whole* profile payload (display name, phone, `calendly_url`, `paypal_email`) because that endpoint overwrites all four.
- `components/dashboard/LockedView.tsx` — what a Buyer sees on the Owner/Realtor tab: the real home component at 35% opacity with pointer events off and an overlay card. CTA opens `OwnerLeadModal` (-> `seller_interest` lead) or `RealtorModal` (-> upgrade request), both exported from `pages/buyer/Upgrade.tsx`. "Pending" is detected from `getMyLeads()` (a `seller_interest` lead without `property_id`) for owners and `getMyUpgradeRequests()` for realtors.
- `components/dashboard/BuyerHome.tsx` — Buyer home (saved homes, inquiries, bookings tiles).

### Owner screens

| File | What it does |
|---|---|
| `components/dashboard/OwnerHome.tsx` | KPIs (active listings, upcoming bookings, open leads, revenue this month), listings card, 6-month revenue chart derived from bookings, assigned-agent card (`GET /auth/me/agent`), pending-reviews card, upcoming bookings, recent leads. Data: `getMyListings`, `getOwnerBookings`, `getOwnerInquiries`, `getMyAgent`. Renders `SetupBanners`. |
| `pages/owner/Listings.tsx` | Agent banner + paginated listings table (`getMyListingsPage`, 50 per page, status pills, search), `PendingReviewsCard`, per-row `ActionMenu`: **Edit** (only when `listing.submitted_by === me`), **Request change** (`RequestChangeModal` -> `seller_interest` lead with the owner's identity and message), **Deal of the Week** (active, not already a deal). "Add listing" disabled by `canAddListings`. |
| `pages/owner/SubmitListing.tsx` | Rental-only create/edit form, see [listings.md](listings.md). |
| `pages/owner/Bookings.tsx` | Guest booking queue (pending / upcoming / past / cancelled), accept/decline, payout status. See [bookings-payments.md](bookings-payments.md). |
| `pages/owner/Calendar.tsx` | The owner's connected scheduling page embedded via `SchedulingFrame` (or a "connect" prompt linking to Settings -> Connections). It is **not** a booking-availability calendar. |
| `pages/owner/Earnings.tsx` | Client-side stats from `getOwnerBookings()` (confirmed bookings with a price: year/month totals, month-over-month, per property, 6-month chart). No earnings endpoint. |
| `pages/owner/Leads.tsx` | Read-only list from `getOwnerInquiries()` (`/inquiries/for-owner`) — which reads the legacy `inquiries` table, so it shows no new landing inquiries (see [leads.md](leads.md) gotchas). |

### Realtor screens

| File | What it does |
|---|---|
| `components/dashboard/RealtorHome.tsx` | KPIs: "active clients" (**hard-coded 18**), active listings (live), "pending closings" (**hard-coded 3**), "needs attention" (live: leads in `assigned`); listings card, pending reviews, "hot leads" (up to five assigned leads). Also still exports unused static arrays (`REALTOR_LISTINGS`, `REALTOR_LEADS`, `REALTOR_PIPELINE`, `REALTOR_CAL_EVENTS`, `STAGE_TONE`, ...) that nothing imports any more. |
| `pages/realtor/Listings.tsx` | Same pattern as owners, with "+ Add Listing" (`go('submit-listing')`, gated by `canAddListings`), "Edit" always available (inline `EditListing`), Deal of the Week request. Uses `ListingDetailPanel role="realtor"`. |
| `pages/realtor/SubmitListing.tsx` | `SubmitListing` / `EditListing` — see [listings.md](listings.md). |
| `pages/realtor/Leads.tsx` | Assigned leads only (`GET /realtor/leads`): KPI cards, type + status filters (incl. `schedule`), `LeadDetailPanel` limited to `contacted`/`closed`, with the realtor's own scheduling link shown. |
| `pages/realtor/Pipeline.tsx` | Live Kanban of assigned leads: New (`assigned`) -> Schedule -> Contacted -> Closed, move with arrows (`PUT /realtor/leads/{id}/status`). |
| `pages/realtor/Bookings.tsx` | Bookings on listings the realtor submitted: accept/decline, request payout. See [bookings-payments.md](bookings-payments.md). |
| `pages/realtor/Calendar.tsx` | Embedded scheduling page via `SchedulingFrame`, same as owners. |

### Shared listing panel
`components/listings/ListingDetailPanel.tsx` (fixed right panel; props `listing, tone, role, openDeal, realtorCalendlyUrl, onClose, onEdit, selfManaged`) — gallery, specs, daily/monthly rates, videos, 3D tour, Deal of the Week request form, and for owners of realtor-managed listings the "Listed by" realtor with a scheduling link. `components/realtor/ListingDetailPanel.tsx` re-exports it.

---

## Backend API

| File | What it does |
|---|---|
| `realty-api/models/upgrade_request.py` | `upgrade_requests`: `user_id` (cascade), `requested_role` (`owner|realtor`), `status` (`pending|approved|rejected`), `notes`, realtor questionnaire (`license_number, territory, years_experience, specialties, bio`), `reviewed_by/at`, `rejection_reason`. |
| `realty-api/schemas/upgrade_request.py` | `UpgradeRequestCreate` (same schema for both roles; questionnaire optional), `UpgradeRequestResponse` (minimal), `UpgradeRequestAdminResponse` (questionnaire, reviewer, user identity), `AdminRejectBody`. |
| `realty-api/routes/upgrade_requests.py` | `POST /upgrade-requests` (buyers only -> 403 otherwise; 409 if the user already has any *pending* request, regardless of role) and `GET /upgrade-requests/me`. Note `notes` is never written. |
| `realty-api/routes/admin.py` | `GET /admin/upgrade-requests`, `POST .../{id}/approve|reject`; user role/assignment endpoints (`PUT /admin/users/{id}/role`, `.../assign-realtor`). Approval sets `users.role` and emails the user (`send_upgrade_approved_email` / `send_upgrade_rejected_email`). |
| `realty-api/routes/auth.py` | `GET /auth/me` (includes `calendly_url`, `paypal_email`), `PUT /auth/me` (overwrites name, phone, `calendly_url`, `paypal_email` — omitted fields become `NULL`), `GET /auth/me/agent` (owner's realtor: direct `assigned_realtor_id`, else the most recent lead that has a realtor; returns the realtor's scheduling link). |
| `realty-api/models/user.py` | `calendly_url` (despite the name, holds either a Calendly or Google Calendar appointment URL; provider inferred from host in `utils/email.py::_is_google_scheduling_url` and `lib/scheduling.ts`), `paypal_email`, `assigned_realtor_id`. |
| `realty-api/routes/listings.py` | Role rules for owners/realtors: see [listings.md](listings.md). `/listings/mine` returns `submitted_by` or (`owner_id` for owners | `assigned_realtor_id` for realtors). |
| `realty-api/routes/bookings.py` | Owner/realtor booking actions are keyed on `listing.submitted_by == me or listing.owner_id == me` (an admin-assigned realtor who did not submit the listing does **not** get its bookings). |

---

## Key Flows

### Buyer -> Owner (end to end)

1. A Buyer opens the Owner tab on Home (or the sidebar Owner section): `LockedView` shows `OwnerHome` blurred and, on mount, checks `getMyLeads()` for an existing `seller_interest` lead without `property_id` (-> "pending" state).
2. "List My Property" opens `OwnerLeadModal` (`pages/buyer/Upgrade.tsx`), pre-filled from `getMe()`, and calls `submitLead({type:'seller_interest', ...})` -> `POST /leads`. **No `upgrade_requests` row and no role change happen here.**
3. The lead appears in the admin Leads queue (and in GHL). An admin assigns a realtor (`PUT /admin/leads/{id}/assign`). Because the lead is `seller_interest` and the submitter is a `buyer`, the API sets `role = 'owner'`, stores `assigned_realtor_id` on the user, and sends the owner an "upgrade approved" email and the realtor an "owner assigned" email.
4. On the next `GET /auth/me` the dashboard shows the Owner section unlocked. The owner now sees their agent (`OwnerHome` and `OwnerListings` call `GET /auth/me/agent`), and must connect a scheduling page and PayPal email (Settings -> Connections) before adding rentals.

### Buyer -> Realtor (end to end)

1. Realtor tab -> `LockedView` (pending detected via `getMyUpgradeRequests()`); "Request Upgrade" opens `RealtorModal`.
2. The questionnaire (license number, territory, years, specialties, bio) is sent to `POST /upgrade-requests` with `requested_role: 'realtor'`. API: buyers only, 409 if a pending request exists.
3. An admin reviews it in `Users` (pending requests section) and approves (role becomes `realtor`, email sent) or rejects with a reason.
4. After approval the Realtor section unlocks. Before listing, the realtor connects a scheduling page (Settings -> Connections).

### How an owner sees their assigned realtor

1. The assignment lives in `users.assigned_realtor_id` (set by lead assignment, or by an admin in the user panel via `PUT /admin/users/{id}/assign-realtor`; only owner accounts can be targets).
2. `GET /auth/me/agent` (owners only) returns that realtor's name/email/phone/scheduling link, falling back to the most recent lead of the user that has a realtor.
3. `OwnerHome` shows the agent card; `OwnerListings` shows the banner; the listing detail panel for realtor-managed listings shows "Listed by" with the realtor's scheduling link.

### How a realtor submits and manages listings

1. Listings page (`RealtorListings`) loads `/listings/mine/page`. "+ Add Listing" is enabled only when a scheduling page is connected (`canAddListings`).
2. `SubmitListing` -> `uploadListingImages` (immediate upload, star = thumbnail) -> `submitListing` -> `POST /listings` with `status = pending_approval`; an admin approves it (email sent).
3. Editing an active listing queues a `listing_edits` row (`has_pending_edit`); the live listing changes only after admin approval. Editing a rejected listing resubmits it automatically.
4. Deal of the Week: detail panel -> star -> `submitDealRequest` (`has_pending_deal_request` until reviewed).
5. Assigned leads show in `RealtorLeads` and the Pipeline; bookings on listings they submitted appear under Bookings.

### How an owner submits a rental

1. Settings -> Connections: connect Calendly or Google Calendar appointment page and the PayPal email. 2. Listings -> Add (`OwnerSubmitListing`): nightly rate in USD or DOP (converted to USD), photos, amenities. 3. `POST /listings` (role `owner`, `transaction='rent'` enforced server-side) -> `pending_approval` with `owner_id = submitted_by = owner`. 4. After approval it is bookable on the landing site; payouts go to the owner's `paypal_email` (see [bookings-payments.md](bookings-payments.md)).

---

## Gotchas

- `PUT /auth/me` nulls `calendly_url` and `paypal_email` when omitted. Only `Settings.tsx` sends all fields; the admin Settings page and the unused `pages/Profile.tsx` send only name and phone.
- The listing setup gate is UI-only (see overview); a realtor can still call `POST /listings` directly.
- Realtor Home still shows two hard-coded KPIs (18 clients, 3 closings); the Buyer/Owner "inquiries" widgets read the legacy `inquiries` table (see [leads.md](leads.md)).
- Owner accounts cannot edit listings that a realtor/admin created for them, and admin reassignment (`assigned_realtor_id`) gives the realtor listing visibility and edit rights but not booking accept/decline rights (those follow `submitted_by`/`owner_id`).
- Rental edits on active listings lose `price_per_day`/`price_per_month`/`owner_paypal_email` changes on approval (see [listings.md](listings.md) gotcha 1).
