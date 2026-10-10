# Leads

The leads system captures buyer, seller, property-inquiry and booking intent and routes each lead through a pipeline: `new` -> `assigned` -> (`schedule`) -> `contacted` -> `closed`. Four lead types exist — `property_inquiry`, `booking`, `buyer_interest`, `seller_interest` (the `Literal` in `LeadCreate`, `realty-api/routes/leads.py`). Leads are also mirrored to GoHighLevel (GHL) as contacts, and GHL tag changes flow back into the lead status through a webhook.

Key behaviours to know before touching this area:

- **`seller_interest` is the owner on-ramp.** When an admin assigns a realtor to a `seller_interest` lead whose submitter is a `buyer`, that user is promoted to `owner` and the realtor is mirrored onto `users.assigned_realtor_id`. (The `/upgrade-requests` API also accepts `owner`, but the dashboard owner path only submits a lead — see [owner-realtor.md](owner-realtor.md).)
- **`schedule` is a realtor-only status.** The realtor pipeline and `PUT /realtor/leads/{id}/status` accept `schedule | contacted | closed`; the admin endpoint rejects `schedule` (it only allows `new | assigned | contacted | closed`), there is no timestamp column for it and no GHL tag, so it is never synced to GHL.
- **All landing forms go through `POST /leads`**, not the older `/inquiries` route (see the gotchas at the bottom).

---

### Landing App

#### Lead capture entry points

| File | Lead `type` | Notes |
|---|---|---|
| `apps/landing/src/components/LeadCaptureModal.tsx` | `buyer_interest` / `seller_interest` (tab toggle) | Posts straight to `POST /leads`. On success writes `lead_modal_dismissed` to `sessionStorage`. |
| `apps/landing/src/components/LeadCaptureProvider.tsx` | — | Wraps the app (mounted in `app/layout.tsx`). Auto-opens the modal 8 s after load unless the session key is set. Skips `/login`, `/signup`, `/forgot-password`, `/reset-password` (path is normalized because `trailingSlash: true`). The old floating "Talk to an agent" button no longer exists. |
| `apps/landing/src/views/Contact.tsx` | `buyer_interest` / `seller_interest` | Calls `submitContactLead`; appends the ad-tracking line to the message; fires `trackFormConversion()` after the API accepts. |
| `apps/landing/src/views/SpanishLandingPage.tsx` (`/es/bienes-raices-republica-dominicana/`) | `buyer_interest` / `seller_interest` (intent "Vender" = seller) | Standalone paid-traffic page without Navbar/Footer (`STANDALONE_PAGE_PATHS` in `lib/constants.ts`). Same `submitContactLead` + tracking + conversion calls; also fires the WhatsApp conversion on WhatsApp links. |
| `apps/landing/src/views/PropertyDetail.tsx` | `property_inquiry` | `submitInquiry` with `property_id`. |
| Booking request | `booking` | Created server-side by `POST /bookings`; see [bookings-payments.md](bookings-payments.md). |

#### `apps/landing/src/api/inquiries.ts`
Exports `submitInquiry` (maps `listing_id` -> `property_id`, `type: property_inquiry`) and `submitContactLead` (maps the contact tab to the lead type; the "Interest: ..." line is prefixed to the message and the whole message is truncated to 2000 chars to match the API limit). Both call `POST /leads`.

#### Ad attribution (Google Ads)
- `apps/landing/src/components/TrackingCapture.tsx` (mounted once in the root layout) calls `captureTrackingParams()` from `lib/tracking.ts`, which saves `gclid / gbraid / wbraid / utm_*` from the landing URL to `localStorage` key `ildr_ad_tracking` (merging, never erasing earlier values).
- There are **no dedicated ad columns on `leads`**. `getTrackingReferenceLine()` turns the stored params into a `Referencia: gclid=... | utm_source=...` line that Contact and the Spanish page append to the lead message.
- `lib/gtag.ts` holds the sitewide Google Ads tag id and the two conversion events: `trackFormConversion()` (only after the API accepted a lead) and `trackWhatsAppConversion()` (Footer and Spanish page WhatsApp links).

---

### Dashboard App

#### `apps/dashboard/src/api/leads.ts`
`Lead` interface (status union includes `schedule`, plus `booking_status`, `ghl_contact_url`, `listing_realtor_*`, `listing_owner_*`, `from_user_*`) and the calls: `getAdminLeads`, `assignLead`, `updateLeadStatus` (admin: `/admin/leads...`); `getRealtorLeads`, `updateRealtorLeadStatus` (realtor: `/realtor/leads...`); `getMyLeads`, `submitLead` (`/leads/mine`, `/leads`).

#### Pages and panels

| File | Role | What it does |
|---|---|---|
| `src/pages/admin/Leads.tsx` (`AdminLeads`) | admin | Loads all leads + realtor roster, KPI cards by status, search, type/status pills, GHL link column, optimistic assign/status updates. `?openId=<uuid>` deep-link opens a lead (used by the admin Home approval queue). |
| `src/pages/realtor/Leads.tsx` (`RealtorLeads`) | realtor | Only leads assigned to the caller. Status filter includes `schedule`. The detail panel is limited to `allowedStatuses={['contacted','closed']}` and is passed the realtor's own `calendly_url` for a "send scheduling link" shortcut. |
| `src/pages/realtor/Pipeline.tsx` (`Pipeline`) | realtor | Real Kanban over `getRealtorLeads()` with columns `assigned` ("New") -> `schedule` -> `contacted` -> `closed`; cards move forward/back via `updateRealtorLeadStatus`; opens `LeadDetailPanel` with `allowedStatuses=['schedule','contacted','closed']`. |
| `src/pages/owner/Leads.tsx` (`OwnerLeads`) | owner | Read-only list from `getOwnerInquiries()` (`GET /inquiries/for-owner`), not from `leads` — see gotchas. |
| `src/pages/buyer/Inquiries.tsx` | buyer | `getMyLeads()` filtered to `property_inquiry`. |
| `src/components/admin/LeadDetailPanel.tsx` | admin + realtor | Contact info with copy buttons, timeline, linked property, message, status buttons (`STATUSES = new, assigned, contacted, closed`; `schedule` only appears when a caller passes it in `allowedStatuses`). Admin view adds `RealtorCombobox` and a "quick assign" to the listing's own agent. Confirmation flows: skip-steps modal and an owner-promotion warning (`ConfirmModal`) when assigning a `seller_interest` lead. |
| `src/components/admin/RealtorCombobox.tsx` | admin | Searchable realtor picker, also reused in the listing detail panel. |

---

### Backend API

#### `realty-api/models/lead.py`
`leads` table: `type`, `name`, `email`, `phone`, `message`, `property_id` (FK listings, SET NULL), `from_user_id` and `assigned_realtor_id` (FK users, SET NULL), `status` (text, default `new`), timestamps `created_at / assigned_at / contacted_at / closed_at`, and GHL sync columns `ghl_contact_id`, `ghl_sync_error`, `ghl_synced_at`. Booking rows link back via `bookings.lead_id`. No ORM relationships — joins are manual in the route layer.

#### `realty-api/routes/leads.py`
Router has no prefix (paths are spelled out). Access tiers:

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /leads` | public (`get_optional_user`), 3/min | Creates the lead (`status=new`, `from_user_id` if logged in), then **synchronously** calls `ghl.create_contact` and `send_lead_notification` (errors swallowed). Notification address = `settings` row `notify_email` (admin Settings page) falling back to the `NOTIFY_EMAIL` env var. |
| `POST /leads/capture` | public, 5/min | Legacy variant; no user attach, no GHL. |
| `GET /leads/mine` | any logged-in user | Caller's own leads. |
| `GET /realtor/leads`, `PUT /realtor/leads/{id}/status` | realtor/admin | Only `assigned_realtor_id == caller`; allowed statuses `schedule, contacted, closed`; pushes the tag to GHL. |
| `GET /admin/leads` | admin | Filters `type`, `status`, `assigned_realtor_id`. |
| `PUT /admin/leads/{id}/assign` | admin | Target must have role exactly `realtor` (admins cannot be assigned). Sets `status=assigned`, `assigned_at`; for `seller_interest` from a `buyer` sets `role=owner`; copies the realtor to `users.assigned_realtor_id` of the submitter when they are an owner/buyer; GHL tag; emails `send_realtor_lead_assigned_email` (includes the realtor's scheduling link) and, on promotion, `send_upgrade_approved_email` + `send_realtor_assigned_owner_email`. |
| `PUT /admin/leads/{id}/status` | admin | `new | assigned | contacted | closed`; stamps the matching timestamp the first time. |

`_build_response` assembles `LeadResponse` with N+1 lookups (listing, listing agent = `assigned_realtor_id or submitted_by`, owner, submitter, booking status). `ghl_contact_url` is only filled for the realtor/admin list endpoints.

#### GoHighLevel integration
- `realty-api/utils/ghl.py` — `create_contact` (tags by lead type, source "I Love DR Realty Website"; phone sent only when it starts with `+`; a 400 "duplicate" reuses the existing contact id; adds a note and follow-up task), `update_contact_status` (adds `lead-new / lead-assigned / lead-contacted / lead-closed` tag). Disabled unless `GHL_ENABLED` and the API key are set. Sync failures are stored in `leads.ghl_sync_error` and never raise.
- `realty-api/routes/webhooks.py` `POST /webhooks/ghl` — authenticates by HMAC (`x-ghl-signature`) or `?key=` shared secret (`GHL_WEBHOOK_SECRET`; everything is rejected if unset). GHL sends *all* tags on the contact, so the handler picks the most advanced status tag (`new < assigned < contacted < closed`) and updates the lead + timestamp. The same router also hosts the PayPal webhook (see [bookings-payments.md](bookings-payments.md)).

---

### Gotchas

- **The `inquiries` table is effectively legacy.** Landing sends property inquiries to `/leads`; nothing in the live apps calls `POST /inquiries` (dashboard `submitInquiry` is unused). But `OwnerLeads`, `OwnerHome` (open-leads tile / recent leads) and the buyer home "inquiries" tile still read `/inquiries/for-owner` and `/inquiries/mine`, so they only show seed/legacy rows — new inquiries appear in `leads` (admin Leads page, realtor Leads/Pipeline, buyer Inquiries page). If owners should see their inquiries, that endpoint needs to read `leads` instead.
- **Realtors only see leads explicitly assigned to them.** A new `property_inquiry` for their listing sits in the admin queue until an admin assigns it; there is no auto-routing by territory despite older docs claiming it.
- `POST /leads` is slow when GHL is enabled (a blocking 10 s-timeout HTTP call inside the request).
- The booking-type lead for guests is the only record of a no-account, no-payment booking request (admin and owner booking lists synthesize rows from it).
