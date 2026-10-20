# DR Professionals

Professional membership is separate from the existing Buyer, Owner, Realtor and Admin account roles. Applying or approving a directory profile does not grant access to listings, leads, research tools, payments or CRM features.

The public `/professionals/` page, linked from Resources → DR Professionals, explains the network and offers signup and sign-in links. It does not search or display business profiles. Search, filters and contact details live in the dashboard at `/professional-directory`; list and detail API requests require an active, email-verified account. Approved profiles appear there immediately without rebuilding the static landing site. A selected profile uses `?profile=<uuid>` on that authenticated dashboard route.

The fixed `join=professional` hint selects the dashboard's `/professional-profile` screen after signup, verification, login or Google sign-in. The separate `directory=professionals` hint returns a member to `/professional-directory`. Both use fixed destinations and short-lived session storage for same-browser verification; neither accepts an arbitrary redirect or grants privileges.

Every signed-in account can open **My professional profile**. Users save an incomplete draft, enter chosen business contact details, consent to sharing with signed-in members and submit for review. The last approved snapshot remains available to members while edits await review. Saving without consent hides a published profile immediately. Withdraw hides the profile and cancels a pending review. The existing API field `public_contact_consent` retains its name; it does not make directory search anonymous.

Real estate professionals from other companies can select the `real_estate_agent` service alongside other categories. Submission requires their company or independent business name in `business_name`; `contact_name` identifies the person. This creates a directory profile, not an iLoveDR Realty team account or an account-role upgrade.

Every Admin account has **Professionals review**. Admins approve submitted versions, request changes with private feedback, suspend a profile or lift a suspension. Lifting a suspension leaves the profile hidden until resubmission and approval. Changes use `expected_version`; conflicts retain the draft or review information and require reloading before another write.

Admins can choose **Add a professional** to maintain a directory entry without creating an account or sending an invitation. These entries have no linked user and are marked **Admin-managed entry**. Any Admin can edit them; account-owned drafts remain editable only by their owner. The publication checkbox explicitly attests that the professional authorized sharing the profile and business contacts. Save a private draft before uploading its photo, then submit it and use the separate **Approve and publish** confirmation. Saving or uploading never publishes an entry automatically.

Selecting **Other property services** reveals custom specialty fields while preserving the other selected services. Up to eight custom names of 2–80 characters may be entered, independently of the eight-category limit. An incomplete private draft may leave Other blank; submission and approval require at least one specialty. Only approved specialty names appear in member cards and directory search. Removing Other clears its draft specialty fields.

Member list/detail responses contain only the approved business profile, use private/no-store caching and exclude login contacts, payment details, account roles, review feedback and revision history. Contact fields start blank and are never copied automatically from the account. Professional photos use the dedicated immutable upload endpoint; replacing the draft photo does not delete the approved photo. Authentication protects directory search and profile responses; do not treat an approved profile's image URL as private storage.

The bilingual categories, service areas and languages come from the public taxonomy endpoint `/professionals/options`, which contains no business profiles. Member filters support up to eight services and twenty areas; an empty selection means all. Axios serializes multiselects as repeated `category` and `area` keys. Introductory and directory copy lives in the landing/dashboard `professionals.json` EN/ES files.

The matching API implementation is required before releasing these frontends. It supplies `/professional-profile`, `/professionals` and `/admin/professionals` routes, approved snapshots, upload ownership, consent checks and moderation concurrency. The existing `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `VITE_API_URL` and `VITE_LANDING_URL` settings remain in use.

Focused frontend checks:

```text
node --test tests/professionals-contract.test.cjs tests/professionals-admin-entry.test.cjs tests/google-auth-fallback.test.cjs tests/dashboard-tools.test.cjs
node node_modules/typescript/bin/tsc -p apps/landing/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/dashboard/tsconfig.json --noEmit
```

Browser checks should cover public information/signup links, anonymous list/detail denial, member login return, draft/submit/admin approval, approved member visibility, edits preserving the approved snapshot, rejected changes, consent withdrawal, suspension/reinstatement and simultaneous-version conflicts. Confirm an outside-company professional profile does not change the account role or expose team features. Use synthetic local accounts and disable external side effects for these checks.

For Admin-managed entries also check creation without a login identity, permission attestation, create-before-photo upload, edit/resubmit/approve as another Admin, Other specialty search, and that private review notes do not carry over when starting a different entry.
