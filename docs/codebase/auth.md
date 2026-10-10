# Auth System — Codebase Reference

This document covers every auth-related source file across the three apps (landing, dashboard, backend API). Paths starting `apps/` are in the `realty` repo; `routes/`, `models/`, `utils/`, `schemas/`, `alembic/` are in the `realty-api` repo.

## At a glance

- **Session = one httpOnly cookie, `ildr_token`**, holding an HS256 JWT valid for **24 hours** (`TOKEN_EXPIRE_HOURS = 24` in `utils/jwt.py`). There is no refresh-token mechanism and no sliding expiry; `POST /auth/refresh` exists but no frontend calls it, so users are simply sent back to the login page when the cookie expires.
- The landing app (Next.js) owns login/signup/verify/forgot/reset pages; the dashboard (Vite SPA) is the authenticated app. They share the cookie via `COOKIE_DOMAIN` (e.g. the parent domain) and `samesite=none; secure` in production. Both axios clients use `withCredentials: true`.
- Sign-up paths: email + password (email-code verification through `pending_users`), Google OAuth (no code step), or admin-created (`POST /admin/users`, pre-verified). Every new account starts as `buyer`; owner/realtor access is granted later (see "Roles and how they are granted").
- A session cookie is accepted only while the user is `email_verified` and `status == "active"` (checked on every request in `get_current_user`).
- The calendar/PayPal "connect before adding listings" requirement is a **frontend-only** gate; see [Listing setup gate](#listing-setup-gate-calendar--paypal) and `listings.md` / `owner-realtor.md`.

---

## Landing App

### `apps/landing/src/app/login/page.tsx`

Thin Next.js route shell. Sets the page `<title>` to "Log In" and a meta description, then renders `<Login />` from the views layer. No logic of its own.

### `apps/landing/src/app/signup/page.tsx`

Thin Next.js route shell. Sets the page `<title>` to "Create an Account" and a marketing meta description, then renders `<Signup />`. No logic of its own.

### `apps/landing/src/app/verify/page.tsx`

Thin Next.js route shell. Sets the page `<title>` to "Verify your email". Wraps `<Verify />` in `<Suspense>` because the view calls `useSearchParams()`, which requires a Suspense boundary under the Next.js App Router.

### `apps/landing/src/app/forgot-password/page.tsx` and `apps/landing/src/app/reset-password/page.tsx`

Thin route shells for `<ForgotPassword />` and `<ResetPassword />` (titles "Forgot Password" / "Reset Password"). The reset shell is wrapped in `<Suspense>` because the view reads `?token=` with `useSearchParams()`.

### `apps/landing/src/components/GoogleAuthProvider.tsx`, `I18nProvider.tsx`, `TrackingCapture.tsx`

Client providers mounted in `apps/landing/src/app/layout.tsx`. `GoogleAuthProvider` wraps the tree in `@react-oauth/google`'s `GoogleOAuthProvider` (client id from `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), which every `useGoogleLogin` call needs. `I18nProvider` restores the saved language (`localStorage.ildr_lang`) so all auth pages render in EN or ES (namespaces `auth` and `verify`). `TrackingCapture` only stores ad parameters for later lead submission; **it does not touch auth or the user record** (see below).

---

### `apps/landing/src/views/Login.tsx`

The login UI. Two-column layout: decorative left panel (photo, stats strip fed by `usePlatformStats()` -> public `GET /stats/platform`) and a right form panel. Copy comes from the `auth` i18n namespace.

**Session guard on mount:** calls `getMe()` at mount time. If the cookie is still valid the user is redirected immediately to `NEXT_PUBLIC_DASHBOARD_URL` (default `https://app.ilovedrrealty.com`; a value without `http` gets `https://` prepended) without rendering the form. While the check is in-flight the component returns `null` (blank screen) to avoid a flash.

**Forgot password:** a "Forgot password?" link navigates to `/forgot-password`.

**Password login flow:** `handleLogin()` calls `login({ email, password })`, shows a toast, then redirects to the dashboard after 1.5 s.

**Google OAuth flow:** `useGoogleLogin` from `@react-oauth/google` with `prompt: 'select_account'`. On success the access token is forwarded to `googleAuth(accessToken)`, which hands it to the backend `/auth/google` endpoint. On success, same redirect pattern as password login.

**Error handling:** all errors surface via `react-hot-toast`. The backend's `detail` string is shown directly to the user (extracted by the `errorMessage` helper in `src/api/auth.ts`).

---

### `apps/landing/src/views/Signup.tsx`

The registration UI. Two-column layout matching `Login.tsx`.

**Validation:** Yup schema (built with `useMemo` so messages follow the active language) enforced client-side before any network call. Rules: name >= 2 chars; **phone is required** and validated with `libphonenumber-js` `isValidPhoneNumber`; email format; password must have >= 8 chars, lowercase, uppercase, digit, and one of ``!@#$%^&*(),.?":{}|<>``; confirm-password match; terms checkbox required. Per-field error messages are displayed inline with a coral border on the input. **Gotcha:** only the length (8-128) is enforced by the backend (`RegisterRequest`); the complexity rules are client-side only. The backend also treats `phone` as optional.

**Google sign-up flow:** same `useGoogleLogin` pattern as `Login.tsx`. Successful Google auth bypasses email verification entirely; the backend creates the user directly in the `users` table. The Google path collects no phone number.

**Password sign-up flow:** `handleSignup()` calls `register(...)`. On success the user is redirected to `/verify?email=<encoded>` after 1.5 s.

---

### `apps/landing/src/views/Verify.tsx`

The 6-digit email verification UI. Wrapped in `<Suspense>` by its route shell.

**URL params:** reads `?email=` and `?code=` from the query string. If both are present and the code is 6 digits, `handleVerify()` is called automatically on mount (deep-link from the verification email).

**OTP input UX:** six individual `<input>` refs with auto-advance on digit entry, backspace-to-previous, and paste handling (strips non-digits, distributes across slots).

**Email correction flow:** "Wrong email?" opens an inline edit field. On confirm it updates the `email` state, clears the digit slots, and calls `resendCode({ email })` to send a fresh code to the new address.

**Verify flow:** calls `verify({ email, code })`. On success redirects to dashboard. On failure clears the digit inputs and shows an inline error.

**Resend flow:** calls `resendCode({ email })` and shows a "Code resent" confirmation. Fails silently (backend enforces 60 s cooldown and returns a generic message).

The email link built by `send_verification_email` is `{LANDING_URL}/verify?email=...&code=...`; the code itself expires after 15 minutes (`CODE_EXPIRE_MINUTES` in `utils/email.py`). Copy lives in the `verify` i18n namespace.

---

### `apps/landing/src/views/ForgotPassword.tsx`

Single email field; calls `forgotPassword(email)` and then always shows the same "check your inbox" success state (the API never reveals whether the email exists). Only a network/server failure shows an error. Link back to `/login`.

### `apps/landing/src/views/ResetPassword.tsx`

Reads `?token=` from the URL; if absent, hard-redirects to `/forgot-password`. Client checks: password >= 8 chars and confirm matches (no complexity rules, unlike Signup). Calls `resetPassword(token, newPassword)`. If the error message contains "invalid" or "expired" it switches to an "expired link" state with a link to request a new one; any other error shows a generic message. On success it shows a confirmation with a login link (it does **not** log the user in).

---

### `apps/landing/src/api/auth.ts`

Axios-based API client for the landing app. All functions call the shared `client` (configured with `baseURL`, `withCredentials: true`).

**`errorMessage(err)`** — private helper. If the error is an Axios error it throws a plain `Error` using `err.response?.data?.detail ?? err.message`, so callers always receive a human-readable string. All exported functions chain `.catch(errorMessage)`.

**Exported functions:**

| Function | Endpoint | Purpose |
|---|---|---|
| `register(body)` | `POST /auth/register` | Creates a `PendingUser` row and sends the verification email. Returns `{ email, message }`. |
| `login(body)` | `POST /auth/login` | Authenticates with email + password. Sets `ildr_token` cookie. Returns `{ expires_in }`. |
| `verify(body)` | `POST /auth/verify` | Promotes `PendingUser` to `User`, sets auth cookie. Returns `{ expires_in }`. |
| `resendCode(body)` | `POST /auth/resend-code` | Issues a new verification code to an unverified email. |
| `getMe()` | `GET /auth/me` | Returns the authenticated user's profile. Used as a session probe on the login page. |
| `logout()` | `POST /auth/logout` | Clears the `ildr_token` cookie server-side. |
| `googleAuth(accessToken)` | `POST /auth/google` | Exchanges a Google OAuth access token for a session cookie. Handles both sign-up and sign-in. |
| `forgotPassword(email)` | `POST /auth/forgot-password` | Requests a reset email. Always resolves for known and unknown emails alike. |
| `resetPassword(token, new_password)` | `POST /auth/reset-password` | Redeems the emailed token and sets a new password. |

`apps/landing/src/api/axios.ts` creates the shared client: `baseURL = NEXT_PUBLIC_API_URL` (fallback `http://localhost:8000`), `withCredentials: true`, JSON content type, and a `paramsSerializer` that sends arrays as repeated keys (needed by FastAPI `List[str]` params). There are no interceptors.

### Ad tracking (not auth)

`apps/landing/src/components/TrackingCapture.tsx` (mounted in the root layout) calls `captureTrackingParams()` from `apps/landing/src/lib/tracking.ts`, which persists `gclid/gbraid/wbraid` and `utm_*` query params to `localStorage.ildr_ad_tracking`, keeping earlier values on later pageviews. `getTrackingReferenceLine()` turns them into a text line that `views/Contact.tsx` and `views/SpanishLandingPage.tsx` append to the **lead message** (the lead schema has no ad columns). `apps/landing/src/lib/gtag.ts` holds the Google Ads tag id and `trackFormConversion()` / `trackWhatsAppConversion()` helpers. None of this is stored on `users`: attribution is per-lead, so the `/auth/me` payload has no tracking fields. See `leads.md`.

---

## Dashboard App

### `apps/dashboard/src/lib/auth.ts`

Canonical type definition file. Exports the `UserInfo` interface used everywhere in the dashboard:

```ts
interface UserInfo {
  id: string
  user_code: number | null
  email: string
  role: string
  display_name: string
  phone?: string
  avatar_url?: string
  has_password?: boolean
  has_google?: boolean
  calendly_url?: string
  paypal_email?: string
}
```

`has_password` and `has_google` are set by the backend's `/auth/me` response and drive the account-linking UI in Settings. `calendly_url` and `paypal_email` are the two integrations an owner/realtor must connect before adding listings (see below). Note `calendly_url` is a historical name: it stores either a Calendly link **or a Google Calendar appointment-schedule link**; the provider is inferred from the host (`apps/dashboard/src/lib/scheduling.ts`, `utils/email.py::_is_google_scheduling_url` on the backend). The API returns `null` for unset values while the type says `string | undefined`.

Not in the payload: `status`, `assigned_realtor_id`, `created_at`, language preference (the UI language lives only in `localStorage.ildr_lang`, there is no server-side preference) and any tracking/attribution data. Admin lists (`GET /admin/users`) expose `assigned_realtor_id` / `assigned_realtor_name` instead.

---

### `apps/dashboard/src/api/auth.ts`

Axios-based API client for the authenticated dashboard. Uses the shared `client` and imports `UserInfo` from `lib/auth.ts`. Covers the richer set of account-management endpoints that only a logged-in user can reach.

**Exported functions:**

| Function | Endpoint | Purpose |
|---|---|---|
| `getMe()` | `GET /auth/me` | Fetches the full `UserInfo` object. Primary session probe for `useCurrentUser`. |
| `logout()` | `POST /auth/logout` | Clears the `ildr_token` cookie. |
| `updateProfile(data)` | `PUT /auth/me` | Updates `display_name`, `phone`, `calendly_url`, `paypal_email`. **Full overwrite**: the backend sets all four fields from the body, so an omitted/`undefined` `calendly_url` or `paypal_email` is saved as `NULL`. Callers that only edit name/phone must re-send the existing values (`pages/Settings.tsx` does; `pages/admin/Settings.tsx` and the unused `pages/Profile.tsx` do not, which would wipe them). |
| `changePassword(current, new)` | `PUT /auth/password` | Changes password for password-registered accounts. |
| `setPassword(new)` | `POST /auth/set-password` | Sets a password for Google-only accounts (no existing password). |
| `linkGoogle(accessToken)` | `POST /auth/link-google` | Links a Google account to an existing password account. |
| `unlinkGoogle()` | `DELETE /auth/unlink-google` | Unlinks Google. Blocked if no password is set (would lock the user out). |
| `getMyAgent()` | `GET /auth/me/agent` | Owner "My Agent" card. Returns `{ realtor_id, realtor_name, realtor_email, realtor_phone, realtor_calendly_url }` (all `null` for non-owners or when none is assigned). Used by `OwnerHome.tsx`. |
| `deactivateAccount()` | `PUT /auth/me/deactivate` | Self-service suspend (sets `status = suspended`, clears the cookie). Reversible only by an admin. |
| `requestAccountDeletion()` | `POST /auth/me/delete-request` | Records `deletion_requested_at`; nothing is deleted automatically (see `POST /auth/me/delete-request` under Backend API). |
| `uploadAvatar(file)` | `POST /auth/avatar` | Multipart upload; returns `{ avatar_url }`. |

`apps/dashboard/src/api/axios.ts`: `baseURL = VITE_API_URL` (fallback `http://localhost:8000`), `withCredentials: true`. **There is no response interceptor**, so an expired cookie (24 h) surfaces as a 401 error inside whichever page made the call; only the initial `getMe()` in `useCurrentUser` triggers the redirect to login. Other api files in `apps/dashboard/src/api/` reuse this client.

---

### `apps/dashboard/src/hooks/useCurrentUser.ts`

The auth gate hook. Fires a single `getMe()` call on mount and tracks three states: `data: UserInfo | null`, `loading: boolean`, `error: Error | null`.

**`updateUser(updates)`** — optimistic update helper. Merges a `Partial<UserInfo>` into the current state without a round-trip. Used by Settings and profile forms after a successful `updateProfile` or `uploadAvatar` call so the sidebar/topbar update instantly.

Callers that need the current user import this hook. `App.tsx` is the primary consumer for the auth guard.

---

### `apps/dashboard/src/App.tsx`

Entry point and auth guard for the dashboard SPA.

**`ROLE_MAP`** — maps lowercase backend role strings (`buyer`, `owner`, `realtor`, `admin`) to the capitalized `Role` union type used throughout the UI. Unknown roles fall back to `'Buyer'`.

**`DashboardPage` component (inner):**
- Calls `useCurrentUser()`.
- While `loading` is `true`, renders a centered spinner so the user sees feedback immediately (never a blank screen).
- After loading, if `error` or `!user`, redirects to `${LANDING_URL}/login` via `window.location.href` (hard redirect to the landing app).
- Once `user` is available, resolves the `Role`, builds the `go(view, openId?)` navigation helper (`view` becomes the URL path segment, `openId` a `?openId=` query param; `go('home')` -> `/`), and renders `<DashLayout>` with either `<AdminDash>` or `<Dashboard>` as its child based on role. Both receive `onUserUpdate` (= `updateUser` from the hook).
- Views like `settings:connections` are passed through `go()` as a path (`/settings:connections`); `Dashboard.tsx` maps that to the Settings page with the Connections tab open.

**`handleLogout`** — calls `logout()` then hard-redirects to the landing login page.

**Routes:** `"/"` and `"/:view"` both render `DashboardPage`. Everything else redirects to `"/"`.

---

### `apps/dashboard/src/layouts/DashLayout.tsx`

Shell layout: fixed sidebar (`w-58`, 232 px) + sticky topbar (`h-15`) + scrollable main content area. Labels come from the `nav` i18n namespace.

**Navigation structure:**
- **Non-admin roles** see a "General" section (`home`, `settings`) followed by three role sections in `ROLE_ORDER` (Buyer, Owner, Realtor), built from the `NAV` map (Buyer: saved, inquiries, bookings, calculator, resources; Owner: listings, calendar, owner-bookings, leads, earnings; Realtor: listings, leads, realtor-bookings, pipeline, calendar).
- **Admin** gets a flat `ADMIN_NAV` list (home, users, listings, leads, bulk-import, bookings, settings) and no role sections. Admin pages are rendered by `AdminDash.tsx`, not `Dashboard.tsx`.

**Role-based nav lock (`ROLE_ACCESS`, duplicated in `pages/Dashboard.tsx`):**
```
Buyer   -> unlocked: Buyer
Owner   -> unlocked: Buyer + Owner
Realtor -> unlocked: Buyer + Realtor
Admin   -> unlocked: all (but admins see ADMIN_NAV instead)
```
Sections the user does not have access to are still shown, dimmed, with a `<Lock>` icon on each item (so buyers can see what owner/realtor offer). Clicking a locked item just goes to `home`. Locked section headers are collapsible via a `<ChevronRight>` toggle (`expandedLocked` state). On the Home page (`Dashboard.tsx`) a tab strip lets users preview the other roles; a locked tab renders `LockedView` (below).

**This lock is UI-only.** `Dashboard.tsx` picks the screen from the URL segment without checking role (e.g. a buyer visiting `/listings` gets the Realtor listings component). The backend (`require_role` / `require_admin`) is what actually protects data; keep new endpoints guarded there.

**Role tone system (`ROLE_TONE`, also duplicated in `Dashboard.tsx`):** Buyer `#e10f1f` (coral), Owner `#f0a800` (gold), Realtor `#1f7a3d` (green), Admin `#0d9488` (teal). Applied to active nav items, section headers, the role badge in the topbar, and the avatar fallback circle. Role icons: Buyer `Search`, Owner `Key`, Realtor `Building2`, Admin `Shield`.

**User display (sidebar footer):** shows `avatar_url` if set, otherwise a colored initial circle. Shows `display_name` (or email prefix) and the zero-padded `user_code` (e.g., `#0001234`, 7 digits) if available, otherwise the email address. Below it: an **EN/ES toggle** (stores `localStorage.ildr_lang` and calls `i18n.changeLanguage`) and the logout button.

**Mobile:** sidebar is off-canvas (`-translate-x-full`, visible from `md`) with a backdrop and `<Menu>` / `<X>` toggle.

### `apps/dashboard/src/components/dashboard/LockedView.tsx`

Shown on the Home tab when a user previews a role they do not have. Renders the real `OwnerHome` / `RealtorHome` blurred at 35 % opacity (non-interactive) under an overlay with an unlock call-to-action:
- **Owner tab:** opens `OwnerLeadModal` (creates a `seller_interest` lead). The "request submitted" state is detected from `getMyLeads()` (an existing `seller_interest` lead without `property_id`).
- **Realtor tab:** opens `RealtorModal` (questionnaire -> `POST /upgrade-requests`). The pending state is detected from `getMyUpgradeRequests()`.
Both modals live in `pages/buyer/Upgrade.tsx`.

### `apps/dashboard/src/pages/Settings.tsx` (account settings)

`UserSettings` is the account screen for Buyer/Owner/Realtor (Admin uses `pages/admin/Settings.tsx`, which has its own profile/security tabs). Tabs: `profile`, `security`, `notifications`, and (Owner/Realtor only) `connections`. `go('settings:connections')` opens it on the Connections tab.
- **Profile:** display name, phone (`react-international-phone` + `libphonenumber-js`), avatar upload; success calls `onUserUpdate(...)` so the sidebar updates without a refetch.
- **Security:** change password (password accounts) or set password (Google-only accounts), link/unlink Google (`useGoogleLogin` + `linkGoogle`/`unlinkGoogle`, driven by `has_password`/`has_google`), and the danger zone: **Deactivate** (`deactivateAccount()`, then redirects to the marketing site with `?msg=deactivated`) and **Request deletion** (`requestAccountDeletion()`).
- **Connections:** scheduling calendar (Calendly or Google Calendar, validated by `lib/scheduling.ts`) and, when `PAYPAL_ENABLED`, the PayPal payout email. Each save goes through `updateProfile` (re-sending the other values, see the full-overwrite note above) and then `onUserUpdate`.
- `apps/dashboard/src/pages/Profile.tsx` is currently **unused** (not imported anywhere); Settings supersedes it.

### Listing setup gate (calendar + PayPal)

Owners and realtors must connect a scheduling link before they can add listings; owners also need a PayPal payout email while PayPal is on.
- `apps/dashboard/src/lib/features.ts` exports `PAYPAL_ENABLED` (currently `true`; must be kept in step with the landing app's `src/lib/features.ts`).
- `apps/dashboard/src/components/dashboard/SetupBanners.tsx` exports `useListingSetup(user, 'owner' | 'realtor')` -> `{ calendlyMissing, paypalMissing, canAddListings, blockedReason }` and the `<SetupBanners>` reminder component (button -> `go('settings:connections')`). Every "add listing" button reads the hook, so they all agree. `Dashboard.tsx` shows the banners on the views in `SETUP_BANNER_VIEWS` (listings, submit-listing, calendar, owner-bookings, realtor-bookings, leads, earnings, pipeline); `OwnerHome`/`RealtorHome` render them directly.
- **The gate is frontend-only.** `POST /listings` (`routes/listings.py::create_listing`) only requires role `realtor`/`admin`/`owner` (owners may submit `rent` listings only) and does not check `calendly_url`/`paypal_email`. Treat the buttons as UX, not security.
- Full flow (listing submission, approval, bookings payout) is in `listings.md` and `owner-realtor.md`.

### Roles and how they are granted

Everyone registers as `buyer`. Upgrades happen only through the backend:
- **Realtor:** a buyer submits `POST /upgrade-requests` (questionnaire, one pending at a time); an admin approves via `POST /admin/upgrade-requests/{id}/approve`, which sets `users.role` and emails the user.
- **Owner:** a buyer submits a `seller_interest` lead; when an admin assigns a realtor to it (`routes/leads.py`), a `buyer` submitter is promoted to `owner`, and `users.assigned_realtor_id` is set on the submitter (this powers `/auth/me/agent`). Admins can also assign/unassign a realtor to an owner (`PUT /admin/users/{id}/assign-realtor`) and change roles among buyer/owner/realtor (`PUT /admin/users/{id}/role`; cannot touch admins or yourself).
- **Admin:** there is **no API path to create or promote an admin** (`POST /admin/users` only allows buyer/owner/realtor, and the role-change endpoint refuses `admin`). Admins must be set directly in the database (e.g. `UPDATE users SET role = 'admin'`) or via `seed.py`.
- A role change only takes effect in the UI after the user reloads: `/auth/me` is read once on dashboard mount (the JWT also embeds `role`, but the backend always re-reads the role from the DB through `get_current_user`).

---

## Backend API

### `routes/auth.py`

FastAPI router mounted at `/auth`. Rate limits are enforced via `@limiter.limit(...)` (slowapi, `utils/limiter.py`, keyed by `get_remote_address`) and are **per client IP, in-memory per process**; endpoints without a limit listed below have none. Behind Railway's proxy the key is only the real client IP if uvicorn trusts the forwarded headers, so verify this before relying on the limits. `_set_auth_cookie` sets `ildr_token` with `httponly`, `path=/`, `max_age = TOKEN_EXPIRE_HOURS * 3600` (24 h), `domain = COOKIE_DOMAIN` (when set), and `samesite=none; secure=true` when `ENVIRONMENT=production`, otherwise `samesite=lax; secure=false`.

**Endpoints:**

- **`POST /auth/register`** (3/min) — Validates the request body. Rejects if a verified `User` already exists for that email (409, with an explicit "account already exists" message, so this one does leak existence). If a `PendingUser` exists, refreshes the code and resets attempts rather than creating a duplicate row; a 60 s cooldown prevents spamming. Otherwise inserts a new `PendingUser` with a 48-hour TTL (`PENDING_USER_TTL_HOURS`; expired rows are purged hourly by `_cleanup_pending_users` in `main.py`). Sends the verification email via `send_verification_email`. Returns `{ email, message }`.

- **`POST /auth/verify`** (10/min) — Promotes `pending_users` row to `users`. Guards: returns the generic 400 if the email is already a verified user, 404 if no pending row, max 5 bad attempts (`MAX_VERIFY_ATTEMPTS`, 429; resetting requires a resend), code expiry (15 min, `CODE_EXPIRE_MINUTES`), timing-safe `hmac.compare_digest` comparison. On success: inserts `User` (`email_verified=True`, `role=buyer`), deletes `PendingUser`, issues JWT, sets `ildr_token` cookie. Returns `{ expires_in }` (86400).

- **`POST /auth/resend-code`** (5/min) — Issues a fresh code to an existing `PendingUser`. Returns a generic message regardless of whether the email is known (prevents enumeration). Enforces 60 s cooldown.

- **`POST /auth/login`** (10/min) — Looks up `User` by email. A missing user, a Google-only user (no `password_hash`) or a wrong password gives 401 "Invalid credentials"; if the email is only in `pending_users`, 403 "Please verify your email before logging in". Then checks `status != suspended` (403) and `email_verified` (403). Sets cookie on success. (The suspended check happens after the password check.)

- **`GET /auth/me`** — Returns `id`, `user_code`, `email`, `role`, `display_name`, `phone`, `avatar_url`, `calendly_url`, `paypal_email`, plus `has_password` and `has_google` flags. Depends on `get_current_user`.

- **`POST /auth/avatar`** (10/min) — Reads the uploaded file, checks size (<= 5 MB, 413) and type via `filetype` magic-bytes detection (JPEG/PNG/WebP only, 415). Calls `utils/storage.py::upload_avatar` (Supabase Storage, path `avatars/{user_id}/{uuid}.ext`, deletes the previous avatar object), then updates `user.avatar_url`. Google sign-in also seeds `avatar_url` with the Google picture URL when empty.

- **`PUT /auth/me`** (20/min) — Replaces `display_name`, `phone`, `calendly_url` and `paypal_email` (each stripped; empty -> `NULL`). Responds with `display_name`, `phone`, `calendly_url`. There is no server-side URL/email validation of the calendar link or PayPal address; the dashboard validates the calendar host client-side (`lib/scheduling.ts`).

- **`PUT /auth/password`** (5/min) — Changes password. Blocked if `password_hash` is `None` (Google-only account).

- **`POST /auth/set-password`** (5/min) — Sets a password on a Google-only account (no existing `password_hash`). Blocked if a password is already set.

- **`POST /auth/link-google`** (no rate limit) — Fetches Google userinfo, validates `email_verified`, checks for conflicts with other accounts, then sets `user.google_id`.

- **`DELETE /auth/unlink-google`** — Clears `user.google_id`. Blocked if `password_hash` is `None` (would create a locked-out account).

- **`POST /auth/google`** — Google sign-in/sign-up. Fetches userinfo from Google. Resolution order: (1) find user by `google_id`; (2) find user by email and link the `google_id`; (3) create a brand-new `User` with no password (bypasses `pending_users` since Google already verified the email). Requires Google's `email_verified`. A suspended user gets 403 (checked after account creation/linking). Sets auth cookie. No rate limit. Google tokens are validated by calling Google's userinfo endpoint with the access token (5 s timeout; 401 invalid token, 502 Google unreachable), not by verifying an ID token.

- **`POST /auth/refresh`** — Re-issues the JWT and refreshes the cookie expiry. Requires a valid existing session. Currently unused by the frontends.

- **`GET /auth/me/agent`** — Returns the realtor assigned to the current **owner**, as `realtor_id/name/email/phone/calendly_url` (all `null` for non-owners). Resolution order: `users.assigned_realtor_id` (set by admin or when a `seller_interest` lead is assigned), falling back to the newest lead from this user with an assigned realtor. (The path is `/auth/me/agent`; there is no `/auth/my-agent`.)

- **`PUT /auth/me/deactivate`** (204) — Self-service: sets `status = "suspended"` and deletes the cookie. There is no self-service reactivation; an admin must call `PUT /admin/users/{id}/unsuspend`.

- **`POST /auth/me/delete-request`** (204) — Sets `users.deletion_requested_at = now()` and logs it. This is only a flag for a human/admin to action; no job deletes the account, and the user can keep logging in.

- **`POST /auth/forgot-password`** (3/min) — Always returns the same message. If the email belongs to a `User`, generates `secrets.token_urlsafe(32)`, stores only its **SHA-256 hash** in `users.password_reset_token` with `password_reset_expires = now + 1 h` (`RESET_TOKEN_EXPIRE_HOURS`), and emails `{LANDING_URL}/reset-password?token=<raw token>` via `send_password_reset_email`. A new request overwrites the previous token (only one live token per user). Email failure is logged, not surfaced. Works for Google-only accounts too (it lets them set a first password).

- **`POST /auth/reset-password`** (5/min) — Hashes the supplied token, finds a user with a matching unexpired token, sets the new password (8-128 chars), clears the token fields, and sends `send_password_changed_email`. Invalid/expired -> 400 "This reset link is invalid or has expired" (the landing view keys off the words "invalid"/"expired"). It does not invalidate existing JWT cookies or log the user in.

- **`POST /auth/logout`** — Deletes the `ildr_token` cookie (path and domain only; it does not pass `samesite`/`secure`, unlike the deactivate handler). There is no server-side token revocation: a copied JWT stays valid until it expires (24 h), and changing a password does not log out other sessions.

---

### `schemas/auth.py`

Pydantic v2 request/response models for the auth router.

| Model | Used by |
|---|---|
| `RegisterRequest` | `POST /auth/register` — `display_name`, `email`, `password` (8-128 chars), optional `phone` |
| `LoginRequest` | `POST /auth/login` |
| `RegisterResponse` | Response for register; `message` defaults to "Verification code sent" |
| `VerifyRequest` | `POST /auth/verify` |
| `ResendCodeRequest` | `POST /auth/resend-code` |
| `TokenResponse` | Response for login, verify, google, refresh; carries `expires_in` (seconds) |
| `GoogleAuthRequest` | `POST /auth/google` and `POST /auth/link-google` |
| `UpdateProfileRequest` | `PUT /auth/me` — `display_name` (1-100), `phone` (<=30), `calendly_url` (<=500), `paypal_email` (<=255); the last two are plain strings (no URL/email validation) |
| `ChangePasswordRequest` | `PUT /auth/password` |
| `SetPasswordRequest` | `POST /auth/set-password` |
| `ForgotPasswordRequest` | `POST /auth/forgot-password` — `email` |
| `ResetPasswordRequest` | `POST /auth/reset-password` — `token` (1-128), `new_password` (8-128) |
| `CreateAdminUserBody` | `POST /admin/users` (in `routes/admin.py`) — role defaults to `'buyer'`; the route only accepts buyer/owner/realtor, creates the user pre-verified, and logs an activity entry |

Password length is the only server-side password rule (8-128). `TokenResponse.expires_in` defaults to 3600 in the schema but routes always set it to `TOKEN_EXPIRE_HOURS * 3600` (86400).

---

### `models/user.py`

SQLAlchemy ORM model for the `users` table.

Key columns: `id` (UUID PK), `user_code` (integer, assigned by DB sequence `users_user_code_seq`, unique; the `Sequence(...)` must stay on the model or SQLAlchemy inserts NULL — migration `s7t8u9v0w1x2` backfilled users hit by that bug), `email` (unique), `password_hash` (nullable — `None` for Google-only accounts), `google_id` (nullable, unique), `role` (enum: `buyer/owner/realtor/admin`, default `buyer`), `status` (enum: `active/suspended`, default `active`), `email_verified`, `avatar_url`, `display_name`, `phone`, `created_at`.

Other account columns (with the migration that added them in `alembic/versions/`):
- `calendly_url` — public booking link, **Calendly or Google Calendar appointment page** (provider inferred from host; `ed856ef1081c`).
- `paypal_email` — owner payout address (`0049637f62fa`); the listing-level `owner_paypal_email` is separate.
- `assigned_realtor_id` — self-FK, `ON DELETE SET NULL`, indexed; the realtor assigned to an owner (`4f1c3506e1d4`).
- `deletion_requested_at` — set by `POST /auth/me/delete-request` (`m1n2o3p4q5r6`).
- `password_reset_token` (SHA-256 hash, indexed) and `password_reset_expires` — forgot/reset flow (`n2o3p4q5r6s7`).
- `verification_code`, `verification_code_expires_at`, `verification_attempts`, `last_code_sent_at` — legacy: from before `pending_users`; the live flow now stores these on `PendingUser`, and `users.email_verified` is always `True` for registered users (`434d4c5bb8b6`, `c1e5f8a2d934`).
- Realtor questionnaire answers live on `upgrade_requests` (`i0j1k2l3m4n5`), not on `users`.
- There is no language-preference or ad-tracking column on `users`.

`password_hash IS NULL` means the account was created via Google OAuth. `google_id IS NULL` means the account was created via email/password. Both can be set simultaneously when a user links their accounts.

Cross-reference: `get_current_user` in `utils/auth.py` queries this table on every authenticated request.

---

### `models/pending_user.py`

SQLAlchemy ORM model for the `pending_users` table. Holds registrations that have not yet completed email verification.

Key columns: `id` (UUID PK), `email` (unique), `password_hash`, `display_name`, `phone`, `verification_code`, `verification_code_expires_at`, `verification_attempts` (default 0), `last_code_sent_at`, `expires_at` (row-level TTL, 48 h from registration).

**Promotion flow:** `POST /auth/verify` inserts a `User` row from this data, then deletes the `PendingUser`. There is never a direct path from `pending_users` to `users` without a successful code verification. Expired rows are deleted hourly by `_cleanup_pending_users` (background task started in `main.py`'s lifespan). Created by migration `e5f6a7b8c9d1`.

---

### `utils/auth.py`

Provides the two FastAPI dependency functions used throughout all protected routes.

**`get_current_user(request, credentials, db) -> User`**

Token extraction order:
1. `Authorization: Bearer <token>` header (via `HTTPBearer(auto_error=False)`)
2. `ildr_token` cookie

This dual-extraction pattern means the same dependency works for both browser clients (cookie) and programmatic API clients (Authorization header).

After extracting and decoding the token (HS256, `JWT_SECRET`), it queries `User` by `user_id` from the JWT `sub` claim, then enforces `email_verified == True` and `status == "active"`. Raises 401 (no/invalid token, user not found) or 403 (unverified / suspended). Only `sub` is trusted: the `role` in the JWT is never read, so role changes and suspensions apply immediately to existing sessions (one DB lookup per authenticated request).

**`get_optional_user(request, credentials, db) -> Optional[User]`**

Same extraction logic but returns `None` instead of raising on any failure. Used by public endpoints that behave differently for authenticated vs. anonymous visitors.

---

### `utils/jwt.py`

Single-responsibility module: creates HS256 JWTs.

**`TOKEN_EXPIRE_HOURS = 24`** — the only place where token lifetime is defined. All references to cookie `max_age` and `TokenResponse.expires_in` derive from this constant. (Older docs and the `TokenResponse` default of 3600 imply 1 hour; that is stale.) The signing key is `JWT_SECRET`; rotating it logs everyone out.

**`create_access_token(user) -> str`** — encodes `sub` (user UUID), `role`, `email`, and `exp` into a signed JWT using `settings.jwt_secret`.

---

### `utils/security.py`

Password hashing via `passlib` with bcrypt. Two functions: `hash_password(plain) -> str` and `verify_password(plain, hashed) -> bool`. The `CryptContext` is module-level so the bcrypt work factor is computed once at import time.

---

### `utils/permission.py`

Role-enforcement FastAPI dependencies that compose on top of `get_current_user`.

**`require_admin`** — dependency that raises 403 unless `user.role == "admin"`.

**`require_role(*roles)`** — factory that returns a dependency checking `user.role in roles`. Used by any endpoint that needs a specific subset of roles (e.g., owner-only or realtor-only routes).

Both depend on `get_current_user`, so they also enforce the `email_verified` + `active` checks. Examples of use: `require_admin` guards everything under `/admin` plus lead assignment; `require_role("realtor", "owner")` guards `GET /listings/mine` and deal requests; `require_role("realtor", "admin", "owner")` guards listing creation; `require_role("admin")` guards the manual booking payout release. When adding an endpoint, pick the guard explicitly: the dashboard lock does not protect it.

### Other backend notes

- **CORS / cookies** (`main.py`): `allow_credentials=True`, origins come from `ALLOWED_ORIGINS` (a `*` or empty entry aborts startup). Allowed methods are GET/POST/PUT/DELETE/OPTIONS (no PATCH). The auth cookie crosses subdomains only if `COOKIE_DOMAIN` is set (e.g. the parent domain) and `ENVIRONMENT=production` (secure, `SameSite=None`).
- **Verification / reset emails** are sent by `utils/email.py` through Resend (`RESEND_API_KEY`, `EMAIL_FROM`); link targets are built from `LANDING_URL`. Verification-email failures in `/auth/register` are not caught (the request would 500), whereas reset/changed-password email failures are logged and swallowed.
- **Settings (names only) used by auth:** `JWT_SECRET`, `ENVIRONMENT`, `COOKIE_DOMAIN`, `ALLOWED_ORIGINS`, `LANDING_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `LOGO_URL`, `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `STORAGE_BUCKET` (avatars). Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (landing); `VITE_API_URL`, `VITE_LANDING_URL`, `VITE_GOOGLE_CLIENT_ID` (dashboard). See `ENV.md`.
- **Webhooks and stats:** `routes/webhooks.py` (`/webhooks/ghl`, `/webhooks/paypal`) are unauthenticated and verified by shared secret / PayPal signature, not by `get_current_user`; `GET /stats/platform` is public (it feeds the login page's stats strip).

---

### `dependencies/auth.py`

Re-export shim. Imports `get_current_user`, `get_optional_user`, `require_role`, and `require_admin` from their respective `utils/` modules and exposes them via `__all__`. Route files can import from either `utils.auth` directly or from `dependencies.auth` interchangeably.
