# Admin Tools

The admin area is a separate shell inside the dashboard SPA (`AdminDash`) backed by a single `/admin` router in the API. Admins can approve/reject listings and listing edits, run the Deal of the Week, manage users and role upgrades, work the lead queue, oversee bookings and payouts, bulk-import listings from CSV, and edit the notification address. Admin accounts are never self-service: the API cannot create or promote an `admin` (see gotchas).

Related docs: [listings.md](listings.md) (listing review workflow), [leads.md](leads.md) (lead queue), [bookings-payments.md](bookings-payments.md) (admin bookings and payout release), [owner-realtor.md](owner-realtor.md) (upgrade flows), [auth.md](auth.md) (login and permission dependencies).

---

### Dashboard App

Routing: `apps/dashboard/src/App.tsx` renders `AdminDash` (`pages/AdminDash.tsx`) when `user.role === 'admin'`. `AdminDash` is a plain `switch (view)` — there is no nested router; `go('listings', openId)` navigates to `/{view}?openId=...` and individual pages read `openId` themselves. The sidebar (`layouts/DashLayout.tsx`, `ADMIN_NAV`) offers: Home, Users, Listings, Leads, Bulk Import, Bookings, Settings. `analytics` is routable but has no sidebar entry.

| File | What it does |
|---|---|
| `pages/admin/Home.tsx` | KPI tiles (`GET /admin/stats`), the "approval queue" (pending listings + pending upgrade requests + new leads, each deep-links via `go(...)`), a user-growth chart from `/admin/users`, and the 25 latest `activity_log` entries. |
| `pages/admin/Users.tsx` (`AdminUsers`) | User table with role/status filters and search; pending upgrade requests with approve / reject-with-reason (this page is where upgrade requests are processed); per-row suspend/unsuspend; opens `UserDetailPanel`; `?openId=` deep-link. |
| `components/admin/UserDetailPanel.tsx` | Profile, role selector (`PUT /admin/users/{id}/role`, only buyer/owner/realtor, never self or another admin), and for owners an "assigned realtor" picker (`PUT /admin/users/{id}/assign-realtor`). |
| `components/admin/AddUserPanel.tsx` | Create a pre-verified user (`POST /admin/users`; roles buyer/owner/realtor only). |
| `pages/admin/Listings.tsx` (`AdminListings`) | Server-paginated listings table (50/page; filters status, co-listing, debounced search `q`), plus stacked sections for pending approvals, pending edits, active deals and deal requests. See [listings.md](listings.md). |
| `pages/admin/SubmitListing.tsx` | `AdminSubmitListing` / `AdminEditListing` (admin edits apply immediately). |
| `pages/admin/BulkImportListings.tsx` | CSV upload, 3-second polling of the import job, per-row results and the last 20 jobs. |
| `pages/admin/Leads.tsx` + `components/admin/LeadDetailPanel.tsx` | Lead queue and assignment; see [leads.md](leads.md). |
| `pages/admin/Bookings.tsx` | All bookings, filters incl. "Failed Payout", **Release payout** button, `BookingDetailPanel`; see [bookings-payments.md](bookings-payments.md). |
| `pages/admin/Settings.tsx` (`AdminSettings`) | Tabs Profile / Platform / Security. Platform tab edits `notify_email` (`GET/PUT /admin/settings`) — the address that receives lead notifications and payout requests. |
| `pages/admin/Analytics.tsx` | **Static mock data** (`BAR_DATA`, `REVENUE_DATA`, `REGIONS` in `admin/shared.tsx`); no API calls and not linked from the sidebar. |
| `pages/admin/shared.tsx` | `TONE` (admin teal `#0d9488`), `FilterPills`, `ApprovalRow`, `ROLE_COLOR` and the mock arrays above. |
| `components/shared/ConfirmModal.tsx` | Generic confirm dialog used before suspend, archive, clear-deal and lead-assignment side effects. |

Dead code to ignore (still in the repo, not imported anywhere): `pages/admin/Approvals.tsx` (mock data), `pages/admin/UpgradeRequests.tsx` (superseded by the section in `Users.tsx`), `pages/Profile.tsx` (superseded by `Settings.tsx`), `components/admin/ListingEditDiffPanel.tsx` (superseded by `ListingEditReviewPage`).

All admin API calls live in `apps/dashboard/src/api/admin.ts` (listings, edits, deal requests, users, upgrade requests, settings, activity, bulk import, assign-realtor); bookings calls are in `api/bookings.ts`, lead calls in `api/leads.ts`.

---

### Backend API

#### `realty-api/routes/admin.py`
Single router, prefix `/admin`; **every route depends on `require_admin`**.

| Group | Endpoints |
|---|---|
| Upgrade requests | `GET /admin/upgrade-requests?status=`, `POST .../{id}/approve` (sets `users.role = requested_role`, emails the user), `POST .../{id}/reject` (reason, emails the user) |
| Listings | `GET /admin/listings` (paginated: `page`, `page_size<=500`, `status`, `exclude_status`, `co_listing_enabled`, `is_deal`, `q`), `GET /admin/listings/{id}`, `POST .../{id}/approve|reject|archive`, `PUT .../{id}/assign` (assign/unassign a realtor or admin as `assigned_realtor_id`), `POST .../{id}/regenerate-share-image`, `POST /admin/listings/regenerate-share-images?only_missing=true`, `GET .../{id}/history` |
| Bulk import | `POST /admin/listings/bulk-import` (multipart `csv_file`, returns 202 + job), `GET /admin/listings/bulk-import`, `GET .../bulk-import/{job_id}` |
| Listing edits | `GET /admin/listing-edits`, `POST .../{id}/approve|reject` |
| Deals | `GET /admin/deal-requests`, `POST .../{id}/approve|reject`, `POST /admin/listings/{id}/set-deal`, `POST .../{id}/clear-deal` |
| Users | `GET /admin/users?role=&status=`, `POST /admin/users`, `PUT .../{id}/suspend|unsuspend|role|assign-realtor` |
| Misc | `GET /admin/stats` (listing counts + user total), `GET/PUT /admin/settings`, `GET /admin/activity-log?limit=` (max 50), `GET /admin/bookings` |

Release-payout is **not** in this file: it is `POST /bookings/{id}/release-payout` (`require_role("admin")`) in `routes/bookings.py`.

Side effects: most mutations write an `ActivityLog` row (`_log`) and listing lifecycle changes write a `ListingEvent` (`_listing_event`). Approve/reject listing and upgrade decisions email the submitter (`utils/email.py`); email failures are swallowed.

#### Models and helpers
- `models/activity_log.py` — `activity_log(id, event_type, description, actor_id, created_at)`; read only by `/admin/activity-log` (no actor name is returned). Suspend/unsuspend do **not** log.
- `models/site_settings.py` — `settings` table, a single row `id=1` with a JSONB `data` blob (`notify_email` today).
- `models/bulk_import_job.py` — see [listings.md](listings.md#bulk-csv-import).
- `utils/permission.py` — `require_admin` (403 unless `role == "admin"`) and `require_role(*roles)`. Both sit on `get_current_user` (`utils/auth.py`), which reads the `ildr_token` cookie or Bearer JWT and re-loads the user, so suspended accounts are rejected on every request.

---

### Gotchas

- **No way to create an admin through the product.** `POST /admin/users` and `PUT /admin/users/{id}/role` refuse `admin`; admin rows are created in the database (see `realty-api/bootstrap_db.py` for how the empty schema is bootstrapped and `seed.py`, which is a local-only script).
- `assign-realtor` for users only accepts `role == "realtor"` targets, while listing `assign` accepts `realtor` or `admin`; lead assignment accepts only `realtor`. Admin-owned listings therefore cannot have a lead assigned to the admin.
- The 50-item cap on `/admin/activity-log`, and `page_size<=500` on `/admin/listings`, are enforced by FastAPI query validation (422 beyond the limit).
- `GET /admin/stats` feeds the Listings KPIs, so adding a listing status requires updating it as well as the table filters.
- Share images are only auto-generated on create/edit with an image change; bulk-imported listings and legacy listings need `regenerate-share-images` (there is **no UI button** — call the endpoint directly as an admin).
