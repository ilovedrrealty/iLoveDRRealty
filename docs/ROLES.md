# Roles

The platform has four user roles: `buyer`, `owner`, `realtor`, `admin` (Postgres enum `user_role`, `realty-api/models/user.py`). The role is stored on `users.role`, embedded in the JWT, and enforced per endpoint by FastAPI dependencies (`require_role`, `require_admin`). The dashboard also hides/locks UI by role, but that is cosmetic — the API is the authority. There is no Supabase RLS in the data path; the API connects to Postgres directly (Supabase is used for Storage).

**All accounts start as Buyer.** Signup (landing `/signup`) is one form — full name, email, phone, password — followed by a 6-digit email verification code, or one click with Google. There is no role picker. Investors are simply Buyers (the ROI calculator is public). Details in [codebase/auth.md](codebase/auth.md).

How a Buyer becomes something else (see [codebase/owner-realtor.md](codebase/owner-realtor.md)):

- **Realtor:** submits an upgrade request with a questionnaire; an admin approves it on the Users page.
- **Owner:** submits the "List My Property" form, which creates a `seller_interest` lead; when an admin assigns a realtor to that lead the user is promoted to Owner automatically and linked to that realtor.
- **Admin:** may also change a user's role directly (buyer/owner/realtor) or create pre-verified users. **Admin accounts cannot be created or granted through the API**; they are set directly in the database.

---

## Lead Capture Without an Account

Visitors never need an account to contact the team, inquire about a property, or request a listing. Forms (contact page, the timed lead modal, the Spanish campaign page, the property inquiry form) post to `POST /leads` with a `type` of `buyer_interest`, `seller_interest`, or `property_inquiry`; a rental booking request creates a `booking` lead. They collect:

- **Name**, **email**, **phone** (optional)
- **Interest / intent** (Buy, Sell, Rent, Invest, ...), folded into the lead message together with any Google Ads attribution line
- **Property** (for inquiries and bookings)

New leads start as `new` in the admin queue (and are mirrored to GoHighLevel). **Routing is manual:** an admin assigns a lead to a realtor; there is no automatic territory-based routing in the code. See [codebase/leads.md](codebase/leads.md).

---

## Role Overview

| Role | Who they are | How account is created | Approval required |
|------|-------------|:----------------------:|:-----------------:|
| **Buyer** | Anyone browsing, booking, renting, or investing in property | Public signup (email + code, or Google) | No |
| **Property Owner** | Individual or company with rental property | "List My Property" lead -> promoted when an admin assigns a realtor (or admin sets the role) | Yes — Admin |
| **Realtor** | Agent managing leads and listings for I Love DR Realty | Upgrade request with questionnaire (or admin sets the role) | Yes — Admin |
| **Admin** | Internal platform operator | Created directly in the database | No |

---

## Buyer

**Goal:** Find, save, and inquire about properties; book short-term rentals; use the ROI calculator.

All signed-up users are Buyers by default and **every higher role keeps the Buyer section** of the dashboard (see `ROLE_ACCESS` in `layouts/DashLayout.tsx`: Owner = Buyer + Owner, Realtor = Buyer + Realtor, Admin = all). Buyer "subtypes" (investor, renter, vacation-home buyer, ...) are not modelled — there is no portfolio, analytics, price-alert or viewings feature.

### Dashboard access (sidebar: General + Buyer)

| View | Description |
|------|-------------|
| Home | Saved homes, inquiries and booking tiles; tabs to preview the Owner/Realtor home (locked until upgraded) |
| Saved | Bookmarked listings (`/saved-homes`) |
| Inquiries | Property inquiries the user sent (read from their `leads`) |
| Bookings | Rental bookings made while logged in: status, cancel, pay status |
| Calculator | Link to the public ROI calculator |
| Resources | Static education links |
| Upgrade | "List My Property" (owner path) and Realtor application |
| Settings | Profile, security (password, Google link), notifications, deactivate/delete request |

### Permissions

- Browse all active listings (public, no account needed); save listings, send inquiries, request/make rental bookings (guests can book without an account)
- Cancel their own pending/confirmed bookings
- Submit one pending upgrade request at a time; submit a `seller_interest` lead
- Cannot create, edit, or publish listings; cannot see other users' data

---

## Property Owner

**Goal:** List rental properties (themselves or via an assigned realtor), accept/decline guest bookings, and get paid out through PayPal.

**Requires Admin approval** (promotion happens when an admin assigns a realtor to the user's `seller_interest` lead, or via a direct role change).

### Dashboard access (sidebar: General + Buyer + Owner)

| View | Description |
|------|-------------|
| Home | KPIs (active listings, upcoming bookings, open leads, revenue this month), agent card, pending reviews |
| Listings | Own listings (submitted or `owner_id`), status filters, add/edit own rentals, request changes on realtor-managed listings, Deal of the Week request |
| Calendar | The owner's connected Calendly / Google Calendar appointment page, embedded |
| Bookings | Guest booking queue: accept / decline, payout status |
| Leads | Inquiries on own listings (see the legacy-table caveat in [codebase/leads.md](codebase/leads.md)) |
| Earnings | Revenue stats derived from confirmed bookings |
| Settings | Profile plus **Connections**: scheduling page and PayPal payout email |

### Permissions

- Create **rental** listings only (server rejects `sale`/`both` with 422); new listings are `pending_approval` and edits to active ones go through admin review
- Edit only listings they submitted; read bookings/inquiries on listings where they are `submitted_by` or `owner_id`
- Request a Deal of the Week on own active listings; upload listing photos
- Must connect a scheduling page **and** a PayPal email before the UI lets them add listings (UI-only gate)
- Cannot access Admin or Realtor views; cannot see other owners' data

---

## Realtor

**Goal:** Work assigned leads, create and manage listings (sale and rent), handle bookings on their listings, and publish through admin approval.

**Requires Admin approval.** A Buyer submits an upgrade request with a questionnaire (license number, territory, years of experience, specialties, bio); an admin approves or rejects it. There are no territory- or sub-type-specific realtor roles in the code: `territory` is free text on the request, and "Regional" versus "Local Partner" realtors are not distinguished.

### Dashboard access (sidebar: General + Buyer + Realtor)

| View | Description |
|------|-------------|
| Home | KPIs, listings, pending reviews, "hot leads" (two KPIs are still hard-coded placeholders) |
| Listings | Own/assigned listings; create, edit (queued if active), Deal of the Week request |
| Leads | Leads an admin assigned to them; can set `contacted` / `closed` (and `schedule` from the pipeline) |
| Bookings | Bookings on listings they submitted: accept / decline / request payout |
| Pipeline | Kanban of assigned leads (New -> Schedule -> Contacted -> Closed) |
| Calendar | Embedded scheduling page |
| Settings | Profile, **Connections** (scheduling page; no PayPal needed) |

### Permissions

- Read and update only leads assigned to them (admin does the assigning)
- Create sale / rent listings (status `pending_approval`), upload images and a co-listing agreement PDF; edit listings they submitted or are assigned to; active-listing edits need admin approval
- Archive their own listings (`DELETE /listings/{id}`)
- Cannot access Admin views; cannot publish directly (only admins create `active` listings)

---

## Admin

**Goal:** Operate the platform — review listings and edits, run Deal of the Week, manage users and upgrade requests, assign leads and listings to realtors, oversee bookings/payouts, bulk-import listings.

**Created directly in the database. Not self-service** (see [codebase/admin-tools.md](codebase/admin-tools.md)).

### Dashboard access (separate admin shell)

| View | Description |
|------|-------------|
| Home | Approval queue (pending listings, upgrade requests, new leads), KPIs, activity feed |
| Users | User list, add user, suspend, change role, assign a realtor to an owner, approve/reject upgrade requests |
| Listings | All listings with queues for pending approvals, edits, deals; assign realtor; history |
| Leads | All leads, assignment, status |
| Bulk Import | CSV listing import |
| Bookings | All bookings, release payouts |
| Settings | Profile, platform notification email, security |

### Permissions

- Every `/admin/*` route (`require_admin`), plus admin-only `release-payout`
- Create `active` listings directly; edit any listing without review; archive any listing
- Cannot suspend or change the role of themselves, and cannot change another admin's role
- No user deletion endpoint exists (only suspend/unsuspend; users can request deletion, which just timestamps `deletion_requested_at`)

---

## Listing Workflow

What the code actually enforces:

```
Owner or Realtor submits a listing (POST /listings)         -> status = pending_approval
Admin creates a listing, or bulk-imports one                -> status = active immediately
  → Admin approves (pending -> active) or rejects with a reason (submitter is emailed)
    → Rejected: submitter edits and resubmits (back to pending_approval)
    → Active:   visible on the landing site, share image generated, inquiries become leads
        → later edits by owner/realtor are queued; admin approves or rejects each edit
        → admin may archive; submitter may archive via DELETE
  → Admin assigns a realtor (assigned_realtor_id) who becomes the public contact
```

There is no code that checks "ownership verified", "listing agreement signed" or "commission agreement signed" before publication; those are offline steps. The only paper trail in the product is the optional co-listing agreement PDF/acceptance flag on a listing. Commission distribution and closings are not modelled.

---

## Role Comparison Matrix

| Capability | Buyer | Owner | Realtor | Admin |
|-----------|:-----:|:-----:|:-------:|:-----:|
| Browse listings / use calculator | ✓ | ✓ | ✓ | ✓ |
| Save listings (any logged-in user) | ✓ | ✓ | ✓ | ✓ |
| Submit inquiry / lead (anonymous or logged in) | ✓ | ✓ | ✓ | ✓ |
| Request a rental booking (guest or logged in) | ✓ | ✓ | ✓ | ✓ |
| Create sale listings | — | — | ✓ | ✓ |
| Create rental listings | — | ✓ | ✓ | ✓ |
| Publish a listing without review | — | — | — | ✓ |
| Edit own listing (active edits need approval) | — | ✓ | ✓ | ✓ (direct) |
| Accept/decline bookings on own listings | — | ✓ | ✓ | — |
| Release payouts | — | — | — | ✓ |
| Work assigned leads / pipeline | — | — | ✓ | ✓ (all leads) |
| Assign leads and listings to realtors | — | — | — | ✓ |
| Approve upgrade requests, manage users | — | — | — | ✓ |
| Bulk import listings | — | — | — | ✓ |
| Requires admin approval to obtain | — | ✓ | ✓ | n/a (DB) |

Notes: "Accept/decline" follows `listing.submitted_by` / `listing.owner_id`, not `assigned_realtor_id`. Admins have no accept/decline endpoint of their own; they release payouts and view all bookings.

---

## Role in the Codebase

- **Storage:** `users.role` (`buyer|owner|realtor|admin`), `users.status` (`active|suspended`); `get_current_user` (`realty-api/utils/auth.py`) re-loads the user on every request from the `ildr_token` HttpOnly cookie or an `Authorization: Bearer` header, so suspension and role changes take effect immediately even though the role is also in the JWT.
- **Backend enforcement:** `require_admin` and `require_role("realtor","owner",...)` in `realty-api/utils/permission.py`; ownership checks are written inline in each route (e.g. `submitted_by`, `owner_id`, `assigned_realtor_id`). Roles with no dependency (e.g. `PUT /listings/{id}`, bookings accept/decline) rely on those inline checks.
- **Frontend:** `apps/dashboard/src/App.tsx` maps `user.role` to a `Role`; admins render `AdminDash`, everyone else `Dashboard`. `ROLE_ACCESS`/`NAV` in `DashLayout.tsx` and `Dashboard.tsx` lock sections; locked sections show `LockedView`. This is presentation only.
- **Role transitions:** admin approval of an upgrade request, assignment of a `seller_interest` lead, or `PUT /admin/users/{id}/role`. After a change the user sees it on the next `/auth/me`; no new token is needed.
- **Colours:** role tone colours (Buyer coral, Owner gold, Realtor green, Admin teal) are defined in `DashLayout.tsx` — see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
