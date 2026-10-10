# Build Order — Remaining Work

Only **pending** tasks are listed. Completed phases live in the archive.

## Phase Checklist

```
Phase 38 -- PayPal Go-Live & Email Notifications
  ────────────────────────────────────────────────
  Additional work completed (post-archive):
  [x] Fix NameError in payout cron -- log line used `owner.paypal_email` when owner not in scope (realtor path)
  [x] Admin bookings page -- GET /admin/bookings, new admin/Bookings.tsx with filter chips + Release Payout
  [x] Owner / realtor Request Payout flow -- POST /bookings/{id}/request-payout → admin email notification
  [x] BookingDetailPanel -- Request Payout button for owner/realtor; Release Payout button for admin
  [x] Fix releasePayout HTTP method -- was client.put, backend is @router.post
  [x] Fix AdminDash.tsx routing -- case 'bookings' was missing; admin always fell through to AdminHome
  [x] DashLayout.tsx -- added { Icon: Bell, view: 'bookings' } to ADMIN_NAV
  [x] Locale: EN+ES admin.json, owner.json, realtor.json -- bookings page title + request_payout / payout_requested keys

  Blocked on external setup:

  PayPal go-live prerequisites:
  [ ] Create I Love DR Realty PayPal Business account at paypal.com/business
  [ ] developer.paypal.com → Apps & Credentials → create Sandbox app → note Client ID + Secret
  [ ] Apply for PayPal Payouts API access (separate approval form — not auto-granted)
  [ ] Register PayPal webhook URL in the PayPal developer dashboard
  [x] Set Railway env vars: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_MODE=sandbox
        (2026-09-18: commit 90f3dce states the PayPal credentials are configured on Vercel and Railway.
         The repo cannot show whether PAYPAL_MODE is sandbox or live -- config.py defaults to "sandbox". CONFIRM in Railway.)
  [x] Set Vercel env var: NEXT_PUBLIC_PAYPAL_CLIENT_ID (landing site)  (same commit; CONFIRM it is a live-mode client ID if live mode is intended)
  [ ] Run alembic upgrade head on Railway:
        migrations o3p4q5r6s8t9, p4q5r6s7t8u9, q5r6s7t8u9v0, r6s7t8u9v0w1, s7t8u9v0w1x2
        (2026-10-10 correction: the migration IDs above are stale. After feature/paypal was merged into dev
         the PayPal/booking chain was re-keyed. Current alembic head is bc364345c64b. Order after u9v0w1x2y3z4:
         ed856ef1081c -> 7c5858ba04a9 -> 4f1c3506e1d4 -> 0049637f62fa -> b813c2be2e88 -> f9901a9c3ae1
         -> 6c8499222d3a -> bc364345c64b. All eight were made idempotent in realty-api 365dead so they can run on
         production, whose schema already had those columns. Procfile/Dockerfile run `alembic upgrade head` on every
         start, so no manual step is needed -- CONFIRM the Railway deploy succeeded and alembic_version is at head.)

  Go-live status (verified 2026-10-10):
  [x] Landing + dashboard PAYPAL_ENABLED feature flags flipped to true (commit 90f3dce, 2026-09-18)
  [x] Double-booking prevented server-side (see Phase 51); booking UI blocks ranges spanning a taken stay
  [ ] CONFIRM Railway PAYPAL_MODE (sandbox default in config.py) -- real money only flows when set to live with live credentials
  [ ] CONFIRM PayPal Payouts API access has been approved (not provable from the repo; payout cron skips if PAYPAL_CLIENT_ID is unset)
  [ ] CONFIRM the PayPal webhook URL is registered and PAYPAL_WEBHOOK_ID matches (not provable from the repo)
  [ ] Run one end-to-end test booking (authorize -> accept -> capture -> next-day payout) in the intended mode

  Email notifications:
  [x] Guest: booking submitted (payment authorized, not charged yet)
  [x] Guest: booking confirmed (payment captured)
  [x] Guest: booking declined (no charge made)
  [x] Owner / Realtor: new booking request to review
  [x] Owner: payout released (amount + listing + dates)
  [x] Admin: payout failure requiring manual action

Phases 39-53 -- Post-July 2026 work  [COMPLETE, shipped Aug 15 - Sep 18 2026; detail in frontend.md / backend.md]
  ─────────────────────────────────────────────────────────────────────────────────────────
  Phase 39 [COMPLETE] Team page realtor agents + PayPal UI feature flag (2026-08-15)
  [x] Team page: new "realtor agents" section (Team.tsx, teamData.ts, EN/ES team.json); Francy Dominguez added (public/team/francy.jpeg)
  [x] apps/*/src/lib/features.ts -- PAYPAL_ENABLED master flag; every PayPal UI surface (checkout, payout email, payout actions, listing-form gates) hidden while false
  [x] Flag initially false; flipped to true 2026-09-18 (Phase 51)

  Phase 40 [COMPLETE] All DR regions + lead-modal fix (2026-08-18)
  [x] Listing form (admin + realtor SubmitListing) and landing search offer all 31 provinces + Distrito Nacional, grouped under "popular areas" (dashboard data/regions.ts, landing data/searchData.ts)
  [x] Search price ceiling fixed
  [x] LeadCaptureProvider -- normalise trailing slash (next.config trailingSlash:true) so the lead modal no longer opens over /login and /signup

  Phase 41 [COMPLETE] API start on a brand-new database + user_code fix/backfill (realty-api)
  [x] bootstrap_db.py runs before `alembic upgrade head` (Procfile + Dockerfile); creates base tables only on a truly empty DB, no-op when alembic_version exists (2026-08-18)
  [x] Six old migrations made idempotent (IF NOT EXISTS) so the full chain runs on a create_all-built schema
  [x] models/user.py -- Sequence('users_user_code_seq') declared so user_code is drawn from the sequence instead of NULL
  [x] Migration s7t8u9v0w1x2 backfills user_code for accounts created while it was NULL (2026-09-14)

  Phase 42 [COMPLETE] Contact channels, buy/sell contact flows, richer share links (2026-09-07)
  [x] Real business number in contactData.ts and footer; WhatsApp CTA updated
  [x] Contact.tsx split into buyer / seller tabs; inquiries.ts maps tab -> buyer_interest / seller_interest lead type
  [x] Share links (WhatsApp / X / SMS) carry price, beds/baths/area and region hashtag; listing page metadata title/description carry price + facts

  Phase 43 [COMPLETE] Real platform stats (2026-09-07)
  [x] Backend: public GET /stats/platform (active listings, total value, realtors, registered users)
  [x] Landing: api/stats.ts + hooks/usePlatformStats.ts bind homepage, login and signup stats to live data (hardcoded marketing numbers removed)
  [x] Compact price formatters extended to billions / trillions (landing + dashboard)

  Phase 44 [COMPLETE] Branded share-preview images (2026-09-07)
  [x] Backend: utils/share_image.py renders a 1200x630 card (price, beds/baths, location baked into the photo) on listing create/edit; Mona Sans fonts in assets/fonts
  [x] Migration o3p4q5r6s7t8 (listings.share_image_url); admin POST /admin/listings/{id}/regenerate-share-image and POST /admin/listings/regenerate-share-images (bulk, only_missing)
  [x] Landing listing/[id] page uses share_image_url as og:image / twitter:image with an updated_at cache-buster

  Phase 45 [COMPLETE] Spanish landing page + Google Ads tracking (2026-09-09)
  [x] /es/bienes-raices-republica-dominicana/ standalone paid-traffic page (SpanishLandingPage.tsx; no Navbar/Footer via isStandalonePage; canonical/hreflang, RealEstateAgent JSON-LD, in sitemap)
  [x] Sitewide Google Ads gtag installed in root layout; form-submit and WhatsApp-click conversion events (lib/gtag.ts)
  [x] gclid/gbraid/wbraid/UTM capture (lib/tracking.ts + TrackingCapture) appended to the contact-form lead message as a "Referencia:" line
  [x] /privacy-policy and /terms-of-service pages added and linked from the footer

  Phase 46 [COMPLETE] Listing display polish (2026-09-09/10)
  [x] Living-area / bed / bath / ROI icons hidden (not "0") when no value -- search cards + admin and shared ListingDetailPanel
  [x] PropertyDetail sticky sidebar height capped so the inquiry Send button clears the fixed Tidio bubble (2026-09-10)

  Phase 47 [COMPLETE] Admin reassign listing to a realtor (2026-09-10)
  [x] Backend: PUT /admin/listings/{id}/assign {realtor_id|null}; migration p4q5r6s7t8u9 (listings.assigned_realtor_id); listing events realtor_assigned / realtor_unassigned
  [x] Assigned realtor takes over visibility, inquiries, edits and appears as public contact (routes/listings.py, leads.py, inquiries.py)
  [x] Dashboard: shared admin/RealtorCombobox.tsx reused by LeadDetailPanel and ListingDetailPanel; assigned realtor shown in ListingHistoryPanel

  Phase 48 [COMPLETE] CSV bulk import of listings (2026-09-14/15)
  [x] Backend: POST /admin/listings/bulk-import (202, background task), GET /admin/listings/bulk-import, GET /admin/listings/bulk-import/{job_id}; utils/bulk_import.py; models/bulk_import_job.py
  [x] Accepts UTF-8 or Windows-1252 (Excel) CSV; source_ref dedup (unique), currency (USD|DOP), co-listing agent email, pipe-separated lists, server-side photo download with private-IP/SSRF guard
  [x] Migrations q5r6s7t8u9v0 (source_ref, currency, co_listing_agent_email), r6s7t8u9v0w1 (bulk_import_jobs), t8u9v0w1x2y3 (description_es)
  [x] Dashboard: admin/BulkImportListings.tsx + "bulk import" admin nav entry
  [x] Landing renders description_es when language is ES (fallback EN); EN/ES toggle on the description editor in admin + realtor SubmitListing

  Phase 49 [COMPLETE] Server-side pagination + static-export fix (2026-09-15)
  [x] GET /listings now returns {items,total,page,page_size,median_price,avg_roi} (page_size default 24, max 60) with filters + sort server-side; GET /listings/mine/page; GET /admin/listings paginated (page_size default 50, max 500) with status/exclude_status/co_listing/is_deal/q filters
  [x] Migration u9v0w1x2y3z4 -- index on listings(status, created_at)
  [x] Landing Search, admin Listings, realtor/owner My Listings use server paging with controls above and below the list
  [x] generateStaticParams() (listing/[id]/page.tsx) and sitemap.ts page through the paginated endpoint -- fixes the output:export build failure and empty sitemap

  Phase 50 [COMPLETE] 24-hour login sessions (2026-09-15)
  [x] utils/jwt.py TOKEN_EXPIRE_HOURS 1 -> 24 (cookie max_age follows it)

  Phase 51 [COMPLETE] PayPal merged to dev, double-booking prevention, PayPal enabled (2026-09-18)
  [x] feature/paypal merged into dev in both repos (bookings, availability calendar, PayPal checkout, admin bookings)
  [x] Backend: overlapping stays rejected server-side with 409 on create, guest-create, accept (booking + lead paths); per-listing lock on accept; half-open ranges (same-day turnover allowed)
  [x] Booking UI blocks ranges that span a taken stay; conflicts surfaced to guests (PropertyDetail) and owners/realtors (Bookings pages)
  [x] The eight PayPal-branch migrations made idempotent (realty-api 365dead) so they apply to production
  [x] PAYPAL_ENABLED = true in landing + dashboard (90f3dce)

  Phase 52 [COMPLETE] Admin bookings include guest-request leads (2026-09-18)
  [x] GET /admin/bookings also returns booking Leads from logged-out guests with no Booking row, so admin totals match owner queues

  Phase 53 [COMPLETE] Google Calendar scheduling alternative + consistent setup reminder (2026-09-18)
  [x] Owners/realtors can connect a Google Calendar appointment page instead of Calendly (stored in users.calendly_url; provider inferred from host) -- dashboard lib/scheduling.ts, SchedulingFrame.tsx, Settings.tsx, owner+realtor Calendar pages
  [x] Shared SetupBanners + useListingSetup: realtors need a scheduling link; owners need scheduling link + PayPal email (while PAYPAL_ENABLED); same rule on every add-listing button; banners above every owner/realtor screen (EN/ES in common.json)
  [x] Lead-assigned email names the realtor's actual provider (Calendly or Google Calendar) and escapes the booking URL (realty-api 3230c6c)

Phase 28 -- Content Marketing Engine  [highest ongoing priority]
  ─────────────────────────────────────────────────────────────
  [ ] Translate remaining 9 posts to ES in blogData.es.ts (+ CARDS_ES entries)  (re-verified open 2026-10-10: only can-americans-buy, closing-costs-dr, punta-cana-airbnb-roi exist in ARTICLES_ES):
        can-canadians-buy, property-taxes-ipi, las-terrenas, best-places-to-retire,
        dr-real-estate-safe, living-punta-cana, confotur-explained, dr-vs-miami, living-cabarete-sosua
  [ ] Re-publish staged Weeks 2-4 posts (move HIDDEN_GUIDES entries into GUIDES + set publish date)
  [ ] Content calendar Week 5+: financing/mortgages for foreign buyers, pre-construction (off-plan) guide
  [ ] Neighborhood guides: Cap Cana, Santo Domingo, Samaná, Jarabacoa, Santiago
  [ ] Recurring formats: market updates, comparison articles, FAQ/list articles
  [ ] Backend: POST /public/newsletter -- accepts { email: EmailStr }; forwards to provider; returns { ok: true }
        (re-verified open 2026-10-10: no newsletter route in realty-api; Blog.tsx newsletter input has no handler)
  [ ] Frontend: wire Blog + landing email inputs to POST /public/newsletter (success/error toast)
  [x] Replace placeholder hero stats + per-article "reads" with real or neutral values
        (verified 2026-10-10: hero/login/signup stats bound to live GET /stats/platform in Phase 43; per-article `reads` are now '—' in blogData.ts)

Phase 24 -- Admin Site Settings  [partial -- re-verified 2026-10-10]
  ──────────────────────────────────────────────
  Backend:
  [x] Alembic migration -- settings table (singleton row id=1, JSONB data column, single_row CHECK)  (l3m4n5o6p7q8)
  [x] models/settings.py -- Settings SQLAlchemy model  (actual file: models/site_settings.py, class SiteSettings)
  [ ] schemas/settings.py -- PlatformSettings + PlatformSettingsResponse
  [x] GET /admin/settings (admin only) -- return row id=1 or defaults if absent  (implemented, but returns ONLY notify_email + updated_at)
  [x] PUT /admin/settings (admin only) -- upsert row id=1  (implemented for notify_email only; returns 204, not PlatformSettingsResponse)
  [ ] Extend PlatformSettingsBody / GET to the remaining fields (contact_email, platform_name, deal_of_week_enabled, featured_listing_count)

  Frontend:
  [x] api/admin.ts -- PlatformSettings interface; getPlatformSettings(); updatePlatformSettings()  (notify_email only)
  [x] admin/Settings.tsx -- Platform tab: GET on mount, PUT on save (wired for notify_email -- the admin address for payout-failure emails; no loading skeleton)
  [ ] Fields: contact_email, platform_name, deal_of_week_enabled, featured_listing_count

Phase 23 -- GoHighLevel CRM (remaining)  [blocked on Phase 24]
  ─────────────────────────────────────────────────────────────
  [ ] admin/Settings.tsx -- Integrations/GHL tab: API key, location ID, enable/disable toggle
        saved via PUT /admin/settings; extend PlatformSettings with ghl_enabled, ghl_api_key, ghl_location_id

Phase 26 -- Account Deactivation / Deletion (remaining)
  ────────────────────────────────────────────────────────
  [ ] Backend: POST /auth/me/delete-confirm -- hard delete after 30-day grace; anonymize leads + listings
  [x] Frontend: after deactivateAccount() succeeds, logout + redirect to landing with ?msg=deactivated
        (verified 2026-10-10: pages/Settings.tsx handleDeactivate redirects to the landing origin with ?msg=deactivated, added 36b4a63 on 2026-06-29;
         the landing app does not read `msg`, so no banner is shown -- optional polish)
  [ ] (new) Settings.tsx builds the landing URL with window.location.origin.replace('dashboard','ilovedrrealty.com'); on app.ilovedrrealty.com
        that replace is a no-op, so the redirect appears to stay on the dashboard origin -- switch to VITE_LANDING_URL and test manually

Phase 27 -- Tidio Live Chat (remaining -- all external, no code)
  ────────────────────────────────────────────────────────────────
  [ ] Upgrade Tidio plan to unlock API-call domain whitelist
  [ ] Tidio Flow: quick replies (type → region) → API call GET /public/chat/listings → send {{message}}
  [ ] Add https://ilovedrrealty.com to Lyro AI data sources after next production deploy

Security -- Open Items (low / info)
  ────────────────────────────────────
  [ ] #29 Replace localhost API fallbacks with a loud failure when the env var is unset  (re-verified open 2026-10-10: 4 landing/dashboard API-URL fallbacks + dashboard App.tsx LANDING_URL fallback)
  [ ] #30 Restrict Google Maps API key + OAuth Client ID to production domain (GCP, manual)
  [x] #31 Add apps/landing/.env.example and apps/dashboard/.env.example  (done 2026-10-10 during handover; realty-api/.env.example also refreshed; files are untracked until committed)
```

---

## Completed Phases (for reference)

```
Phase 1-6.7  [COMPLETE]  See docs/archive/plan_v1/
Phase 7-13   [COMPLETE]  See docs/archive/plan_v2/
Phase 14     [COMPLETE]  Property Detail Enhancements
Phase 15     [COMPLETE]  Listing Form v2 (Sale/Rent Dynamic)
Phase 16     [COMPLETE]  Leads System
Phase 17     [COMPLETE]  Owner & Realtor Flow Redesign
Phase 18     [COMPLETE]  Deal of the Week v2
Phase 19     [COMPLETE]  SEO -- static pages + sitemap + robots + CWV audit + GSC submit
Phase 20     [COMPLETE]  Mobile Responsive Dashboard
Phase 21     [COMPLETE]  Confirmation Modals -- all 9 modal gates
Phase 22     [COMPLETE]  Listing History
Phase 23     [PARTIAL]   GoHighLevel CRM -- sync + webhook + Leads column done; GHL Settings tab pending
Phase 24     [NOT STARTED] Admin Site Settings
Phase 25     [COMPLETE]  Internationalization (EN/ES)
Phase 26     [PARTIAL]   Account Deactivation / Deletion -- deactivate + delete-request done; delete-confirm pending
Phase 27     [PARTIAL]   Tidio Live Chat -- widget + endpoint done; Flow + plan upgrade pending
Phase 28     [IN PROGRESS] Content Marketing Engine -- 12 posts + 3 ES translations live; 9 ES + content ongoing
Phase 29     [COMPLETE]  Email Deliverability -- DKIM/SPF/DMARC verified
Phase 30     [COMPLETE]  Admin Role Management
Phase 31     [COMPLETE]  Lead Email Notifications
Phase 32     [COMPLETE]  Forgot / Reset Password
Phase 33     [COMPLETE]  Rental Pricing + Co-listing PDF + Calendly + Availability Calendar
Phase 34     [COMPLETE]  Realtor Pipeline Kanban
Phase 35     [COMPLETE]  Booking Unavailable Dates, Admin Realtor Assignment, Owner Schedule Meeting
Phase 36     [COMPLETE]  Owner Submit & Edit Own Listing
Phase 37     [COMPLETE]  Owner Calendly Connection, Calendar Rewrite & Listing Gate
Phase 38     [COMPLETE]  PayPal Payment Collection -- code complete; go-live pending external setup
--- appended 2026-10-10 ---
Phase 24     [PARTIAL]   (re-verified) settings table + GET/PUT /admin/settings exist for notify_email only; remaining fields + UI not built
Phase 26     [PARTIAL]   (re-verified) frontend redirect already in place; POST /auth/me/delete-confirm still missing
Phase 39     [COMPLETE]  Team Page Realtor Agents + PayPal UI Feature Flag
Phase 40     [COMPLETE]  All DR Regions + Lead Modal Fix
Phase 41     [COMPLETE]  API Start on Brand-New Database + user_code Fix/Backfill
Phase 42     [COMPLETE]  Contact Channels, Buy/Sell Contact Flows, Richer Share Links
Phase 43     [COMPLETE]  Real Platform Stats
Phase 44     [COMPLETE]  Branded Share-Preview Images
Phase 45     [COMPLETE]  Spanish Landing Page + Google Ads Tracking
Phase 46     [COMPLETE]  Listing Display Polish (zero-value icons, Tidio sidebar)
Phase 47     [COMPLETE]  Admin Reassign Listing to Realtor
Phase 48     [COMPLETE]  CSV Bulk Import of Listings
Phase 49     [COMPLETE]  Server-Side Pagination + Static-Export Fix
Phase 50     [COMPLETE]  24-Hour Login Sessions
Phase 51     [COMPLETE]  PayPal Merged + Enabled, Double-Booking Prevention
Phase 52     [COMPLETE]  Admin Bookings Include Guest-Request Leads
Phase 53     [COMPLETE]  Google Calendar Scheduling Alternative + Consistent Setup Reminder
```
