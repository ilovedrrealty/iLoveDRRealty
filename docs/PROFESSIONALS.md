# DR Professionals

Professional membership is separate from the existing Buyer, Owner, Realtor and Admin account roles. Applying or approving a directory profile does not grant access to listings, leads, research tools, payments or CRM features.

The public directory is `/professionals/`, linked from Resources. Profiles use `?profile=<uuid>` so newly approved businesses are accessible immediately on the statically exported landing site. Individual profile SEO pages would require a separate rendering/rebuild design.

The join link uses the fixed `join=professional` hint through signup, verification, login and Google sign-in. The hint selects the dashboard's `/professional-profile` screen. It cannot select arbitrary URLs or grant privileges. A short-lived session-storage hint also preserves same-browser email verification links.

Every signed-in account can open **My professional profile**. Users save an incomplete draft, enter explicit public business contact details, consent to publication and submit for review. The last approved snapshot remains public while edits await review. Saving without publication consent hides a published profile immediately. Withdraw hides the profile and cancels a pending review.

Every Admin account has **Professionals review**. Admins approve submitted versions, request changes with private feedback, suspend a profile or lift a suspension. Lifting a suspension leaves the profile hidden until resubmission and approval. Changes use `expected_version`; conflicts retain the draft or review information and require reloading before another write.

Admins can choose **Add a professional** to maintain a directory entry without creating an account or sending an invitation. These entries have no linked user and are marked **Admin-managed entry**. Any Admin can edit them; account-owned drafts remain editable only by their owner. The publication checkbox explicitly attests that the professional authorized sharing the profile and business contacts. Save a private draft before uploading its photo, then submit it and use the separate **Approve and publish** confirmation. Saving or uploading never publishes an entry automatically.

Selecting **Other property services** reveals custom specialty fields while preserving the other selected services. Up to eight custom names of 2–80 characters may be entered, independently of the eight-category limit. An incomplete private draft may leave Other blank; submission and approval require at least one specialty. Only approved specialty names appear in public cards and directory search. Removing Other clears its draft specialty fields.

Public responses contain the approved business profile only. Login contacts, payment details, account roles, review feedback and revision history are not public. Contact fields start blank and are never copied automatically from the account. Professional photos use the dedicated immutable upload endpoint; replacing the draft photo does not delete the approved photo.

The directory's bilingual categories, service areas and languages come from `/professionals/options`. Public category filters support up to eight choices. An empty selection means all services. The directory headings are editable through Website Editor's Pages & forms tab.

The matching API implementation is required before releasing these frontends. It supplies `/professional-profile`, `/professionals` and `/admin/professionals` routes, approved snapshots, upload ownership, consent checks and moderation concurrency. The existing `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `VITE_API_URL` and `VITE_LANDING_URL` settings remain in use.

Focused frontend checks:

```text
node --test tests/professionals-contract.test.cjs tests/professionals-admin-entry.test.cjs tests/google-auth-fallback.test.cjs
node node_modules/typescript/bin/tsc -p apps/landing/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/dashboard/tsconfig.json --noEmit
```

Browser checks should cover signup intent, draft/submit/admin approval, public visibility, edits preserving the approved snapshot, rejected changes, consent withdrawal, suspension/reinstatement and simultaneous-version conflicts. Use synthetic local accounts and disable external side effects for these checks.

For Admin-managed entries also check creation without a login identity, permission attestation, create-before-photo upload, edit/resubmit/approve as another Admin, Other specialty search, and that private review notes do not carry over when starting a different entry.
