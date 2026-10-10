# Contributing

How to set up, run, change and ship the I Love DR Realty codebase. Two repositories are involved and most features touch both:

| Repo | GitHub | Contents |
|------|--------|----------|
| `realty` | `iBlinkyxD/realty` | Turborepo monorepo: `apps/landing` (Next.js 15), `apps/dashboard` (Vite + React), `packages/ui` |
| `realty-api` | `iBlinkyxD/realty-api` | FastAPI + SQLAlchemy + Alembic |

Keep them side by side in one parent folder (the Claude commands in `realty/.claude/commands/` assume that layout). See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit and [ENV.md](ENV.md) for every environment variable.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ (Vercel dashboard project uses 24.x; local dev has been done on 24) | npm 10+ (the repo pins `npm@10.7.0` in `packageManager`) |
| Python | 3.11 (the `Dockerfile` uses `python:3.11-slim`) | For `realty-api` |
| PostgreSQL | 13+ (migrations use `gen_random_uuid()`, built in from 13) | Or point `DATABASE_URL` at a dev Supabase project |
| Git | Any recent | |

Accounts needed for full functionality (all optional for basic local work): Supabase (Storage for uploads), Resend (email), PayPal sandbox, GoHighLevel, Google Cloud (OAuth client + Maps key). Secret values are shared through the team password manager; never commit them.

---

## 2. Local setup

### 2.1 Frontend monorepo (`realty/`)

```bash
cd realty
npm install                      # installs all workspaces
cp apps/landing/.env.example   apps/landing/.env
cp apps/dashboard/.env.example apps/dashboard/.env
```

PowerShell equivalents: `Copy-Item apps\landing\.env.example apps\landing\.env` and the same for the dashboard.

The defaults point at `localhost` (API 8000, landing 3000, dashboard 5174). Fill in Google / Maps / PayPal client IDs only if you need those features.

### 2.2 API (`realty-api/`)

Windows (PowerShell):

```powershell
cd realty-api
python -m venv .venv
.venv\Scripts\Activate.ps1       # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
Copy-Item .env.example .env      # then edit DATABASE_URL and JWT_SECRET
```

macOS / Linux / Git Bash:

```bash
cd realty-api
python3 -m venv .venv && source .venv/bin/activate   # Git Bash on Windows: source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
```

Create an empty local database (e.g. `createdb ilovedrrealty`), set `DATABASE_URL` and `JWT_SECRET` (generate with `python -c "import secrets; print(secrets.token_hex(32))"`), then prepare the schema exactly as production does:

```bash
python bootstrap_db.py           # creates base tables ONLY on a completely empty DB; no-op otherwise
alembic upgrade head             # applies all migrations
python seed.py                   # optional demo users/listings (dev only; prints the logins)
```

With `RESEND_API_KEY` empty, no email is sent: the signup verification code is printed in the API console (`[DEV] Verification code ...`).

---

## 3. Running

```bash
# API (from realty-api, venv active)
uvicorn main:app --reload --port 8000        # http://localhost:8000  (docs: /docs, health: /health)

# Frontends (from realty)
npm run dev                  # landing + dashboard together (turbo)
npm run dev:landing          # http://localhost:3000
npm run dev:dashboard        # http://localhost:5174
```

Log in through the **landing** site (`/login` or `/signup`); the dashboard has no login page and redirects there when you are not authenticated. Locally the session cookie is host-only `SameSite=Lax`, which works across the three localhost ports.

---

## 4. Build, type-check, lint, test

| Task | Command | Notes |
|------|---------|-------|
| Build everything | `npm run build` (from `realty`) | Turbo. Outputs `apps/landing/out/` and `apps/dashboard/dist/` |
| Build one app | `npm run build:landing` / `npm run build:dashboard` | |
| Landing build prerequisite | API reachable at `NEXT_PUBLIC_API_URL` | `generateStaticParams()` and the sitemap fetch every listing at build time. If the API is down the build still succeeds but has no `/listing/<id>/` pages |
| Type-check | `npx turbo run typecheck`, or `npm run typecheck -w landing` / `-w dashboard` | `tsc --noEmit`. This is the only static check available |
| Preview built dashboard | `npm run preview -w dashboard` (port 4174) | |
| Lint | none configured | No ESLint / formatter config exists in either repo |
| Automated tests | none | No test runner or tests in either repo. Verify manually in the browser; run `npm run build` and the type-check before pushing |
| Continuous integration | none | No GitHub Actions or other CI config in either repo |

API runtime checks: start it and open `http://localhost:8000/health` and `/docs`.

---

## 5. Repository conventions

### Landing (`apps/landing/src/`)

| Folder | What goes here |
|--------|---------------|
| `app/` | Route files (`page.tsx`, `layout.tsx`, metadata, `robots.ts`, `sitemap.ts`). Keep thin: metadata + render a view |
| `views/` | One component per page, with the actual content |
| `components/` | Shared UI (Navbar, Footer, providers, modals, search sidebars) |
| `api/` | axios modules over `api/axios.ts` (one per API area) |
| `locales/{en,es}/` | i18n JSON, one file per namespace |
| `data/` | Static content (blog articles, team, marketing copy) and listing types/formatters |
| `lib/` `hooks/` | Helpers, tracking (`gtag.ts`, `tracking.ts`), feature flags, hooks |

### Dashboard (`apps/dashboard/src/`)

| Folder | What goes here |
|--------|---------------|
| `pages/` | Screens: `pages/admin`, `pages/owner`, `pages/realtor`, `pages/buyer`, plus `Dashboard.tsx` / `AdminDash.tsx` view routers and `Settings.tsx` |
| `layouts/DashLayout.tsx` | Sidebar / topbar shell and navigation per role |
| `components/` | Shared and role-specific components (`admin/`, `dashboard/`, `listings/`, `realtor/`, `shared/`, `ui/`) |
| `api/` | axios modules over `api/axios.ts` |
| `locale/{en,es}/` | i18n JSON, one file per namespace |
| `lib/` `hooks/` `utils/` | Helpers (`scheduling.ts`, `features.ts`), `useCurrentUser`, phone formatting |

Dashboard navigation is the first URL segment (`/listings`, `/leads`, ...). To add a screen: create the page, add its `view` key to the `switch` in `pages/Dashboard.tsx` (or `AdminDash.tsx`), add the nav item in `DashLayout.tsx`, and add titles in the matching `locale/*/<ns>.json` under `pages.<view>`.

### API (`realty-api/`)

`routes/` (one router per resource, registered in `main.py`) · `models/` (register new models in `models/__init__.py`) · `schemas/` (Pydantic) · `utils/` (email, GHL, storage, auth helpers) · `services/` (third-party clients such as PayPal) · `alembic/versions/`. Protect endpoints with `Depends(get_current_user)` or `require_role(...)` / `require_admin`.

### Styling

Tailwind utility classes for static styling; inline `style={{}}` only for data-driven values. Palette and tokens are in `src/design.ts` of each app (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)); change both copies. `packages/ui` is currently unused.

### Code style

- TypeScript everywhere, avoid `any`. Remove unused imports and `console.log` before committing.
- Comment only non-obvious constraints or workarounds.
- Add shadcn/ui components per app (they are not shared): `cd apps/landing` (or `apps/dashboard`) then `npx shadcn@latest add <component>`; they land in `src/components/ui/`.

---

## 6. Internationalisation (EN + ES): required for every user-facing string

The product is bilingual. **Never hard-code user-facing text in a component, and never update only one language.**

- Landing: add keys to **both** `apps/landing/src/locales/en/<ns>.json` and `.../es/<ns>.json`. Namespaces are listed in `apps/landing/src/i18n.ts`. A new namespace needs a new file in both folders **and** imports and registration in `i18n.ts`.
- Dashboard: same rule in `apps/dashboard/src/locale/{en,es}/<ns>.json`, registered in `apps/dashboard/src/i18n.ts`.
- Use `useTranslation('<ns>')` and `t('key')`; keep the key structure identical in both languages.
- Blog articles live in `src/data/blogData.ts` (EN) and `blogData.es.ts` (ES). An article only gets a `/es/article/<slug>/` page, hreflang alternate and sitemap entry when it exists in both.
- Listings carry `description` and `description_es`; the listing forms have an EN/ES toggle.
- The language preference is stored in `localStorage.ildr_lang` (per app origin).
- Strings inside API emails and error messages are English only today.

---

## 7. Database migrations (Alembic)

1. Change the SQLAlchemy model in `realty-api/models/` (and `models/__init__.py` if it is a new model).
2. Generate a revision: `alembic revision --autogenerate -m "short description"`, then **read and edit** the generated file in `alembic/versions/`.
3. Keep migrations safe to re-run: existing ones use `IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object` and similar guards (production and local databases have drifted in the past, and a commit exists specifically to make migrations idempotent). Follow that style.
4. Apply locally: `alembic upgrade head`. Check `alembic heads` shows a **single** head before committing; test `alembic downgrade -1` when the downgrade is meaningful.
5. Commit the migration together with the model and route changes.
6. **Deploy applies migrations automatically.** The container start command is `python bootstrap_db.py && alembic upgrade head && uvicorn ...`, so a migration runs against the live database the moment the API redeploys. Write additive, backwards-compatible changes, and deploy the API before frontends that depend on it. There is no staging database in the repo; check the Railway/Supabase setup before a destructive migration.
7. Core tables are not created by any migration; `bootstrap_db.py` creates them from the models on an empty database. Do not rely on `alembic upgrade head` alone for a brand-new database.

---

## 8. Branch model and promotion

Observed from `git branch -a` / `git log` in both repos and from `realty/.claude/commands/`:

| Branch | Repo | Role |
|--------|------|------|
| `dev` | both | Day-to-day integration branch; all work is committed here |
| `main` | both | Fast-forwarded from `dev` (never committed to directly) |
| `production` | `realty` only | Exists on origin; currently at commit `8168b08` (2026-08-18), a strict ancestor of `main` and 25 commits behind it (the PayPal / bookings work is not in it). `realty-api` has **no** `production` branch |
| `feature/<name>` | both | Longer features (e.g. `feature/paypal`); merged into `dev` with a merge commit (`Merge feature/paypal into dev: ...`) |
| `hotfix/<name>` | `realty` | Small urgent changes (e.g. `hotfix/team-francy`); its commit is contained in `production` |

Team flow (the `commit-dev` and `sync-main` commands in `realty/.claude/commands/`, which cover **both repos at once**):

1. Work on `dev` (or a `feature/*` branch merged into `dev`).
2. **commit-dev**: in each repo with changes, stage files **by name** (never `.env`, credentials or secrets), commit on `dev` with a message explaining *why*, never amend, never `--no-verify`.
3. **sync-main**: with `dev` clean, `git checkout main && git merge --ff-only dev` in each repo that is ahead, then `git checkout dev`. Fast-forward only; if it cannot fast-forward, stop and resolve rather than forcing. Never force-push.
4. Push the branches you changed to `origin`.
5. **Promotion to `production`:** no command, script or doc in either repo describes how or when `production` is updated, and no PR/CI workflow exists. Whether the live Vercel sites build from `main` or from `production` **must be confirmed in the Vercel project settings (Git > Production Branch)**. If it is `production`, the live site is currently behind `main`. For the API, Railway can only be tracking `main` or `dev` (there is no `production` branch there); confirm in the Railway service settings.

Pull requests are not part of the observed flow (history shows direct merges), but nothing prevents using them for review.

`realty/.claude/` (the Claude commands) is listed in `.gitignore` and exists only on the previous maintainer's machine; ask for a copy if you want those helpers. The handover docs in `realty/docs/` are tracked (whitelisted in `.gitignore`).

---

## 9. Commit messages

Observed style (not Conventional Commits): one imperative sentence stating what changed and **why**, optionally followed by a short body listing details. Older commits carry a plan phase prefix ("Add Phase 32 forgot/reset password flow and ...").

```
Prevent double-booking: reject overlapping stays server-side
Make the PayPal migrations idempotent so they can deploy onto production
Move listings (public search, admin panel, "My Listings") to server-side pagination and filtering, since both endpoints previously returned the entire table on every load
Merge feature/paypal into dev: bookings, availability calendar, PayPal checkout, admin bookings
```

Team rules (from `commit-dev.md`): no `Co-Authored-By` lines or any AI/tool attribution, no amending, no hook-skipping, stage specific files.

---

## 10. How deploys happen

What the repos define:

| Unit | Files | What they say |
|------|-------|---------------|
| Dashboard (Vercel) | `apps/dashboard/vercel.json` | `outputDirectory: dist`; rewrite every path to `/index.html`. Vite project, Node 24.x per local `.vercel/project.json` |
| Landing (Vercel) | `apps/landing/vercel.json` | Empty (`{}`). Next.js static export (`out/`) is detected by Vercel; build/install commands and root directory are dashboard settings, not in the repo |
| API (Railway) | `railway.toml`, `Dockerfile` | Docker build; health check `GET /health` (30 s); restart on failure (max 3). Start command: `python bootstrap_db.py && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`. The `Procfile` has the same command (default port 8080) but `railway.toml` selects the Dockerfile builder |

What is **not** determinable from the repos and must be confirmed in the Vercel / Railway dashboards: which Git branch each project auto-deploys, whether Vercel preview deployments are on, root directories and monorepo build settings for the two Vercel projects, custom-domain configuration, and any redirects configured outside `vercel.json`. No CI, deploy hooks or GitHub Actions exist.

Deploy order and side effects:

1. **API first** when a change adds endpoints or migrations: the deploy runs migrations automatically.
2. **Landing last / rebuild when listings change**: the landing site is static. New listings only get SEO pages (`/listing/<id>/`) and sitemap entries after the landing site is rebuilt, and `NEXT_PUBLIC_*` values are fixed at build time. After changing a frontend env var in Vercel you must redeploy.
3. Landing builds need the API reachable (see section 4).
4. Environment variable changes: API variables are read at process start (redeploy/restart on Railway); see [ENV.md](ENV.md).

---

## 11. Common tasks

**Add a landing page**: create `app/<route>/page.tsx` (metadata + view), `views/<Name>.tsx`, locale keys in EN and ES, an entry in `app/sitemap.ts`, and a link in `Navbar.tsx`/`Footer.tsx` if needed (routing helper: `hooks/useNav.ts`).

**Add an API endpoint**: schema in `schemas/`, route in `routes/`, auth dependency, rate limit if public (`@limiter.limit("n/minute")`, with `request: Request` as first parameter), model + migration if the schema changes, matching client function in `apps/*/src/api/`.

**Add a dependency**: `npm install <pkg> --workspace=landing` (or `dashboard`, `@ilovedr/ui`); Python: add a pinned version to `realty-api/requirements.txt`.

**Add an environment variable**: read it only via `config.py` (API) or `process.env.NEXT_PUBLIC_*` / `import.meta.env.VITE_*` (frontends); update the relevant `.env.example` and [ENV.md](ENV.md) in the same change.
