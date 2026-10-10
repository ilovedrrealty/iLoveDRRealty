# Design System

The design system is token-based. Brand values are defined in three places that must be kept in step (see "Design Token Source"): the TypeScript `design.ts` files (for inline styles and JS), and the Tailwind v4 `@theme` blocks in each app's CSS (which generate the utility classes such as `bg-ink`, `text-coral`, `border-line`). Both apps use **Tailwind v4** (`tailwindcss` ^4.3, CSS-first config via `@import "tailwindcss"` and `@theme`; there is no `tailwind.config.js` even though `components.json` still names one). Both apps compile it through `@tailwindcss/postcss` (a root `package.json` dependency; see `apps/landing/postcss.config.mjs` and `apps/dashboard/postcss.config.js`), not through a Vite Tailwind plugin.

In practice almost all styling is hand-written Tailwind utilities on the brand tokens. The shadcn/ui `Button` is installed but not currently imported by any page (see "Component Library").

---

## Color Palette

### Brand Colors

Defined as `--color-*` in the `@theme` block of `apps/landing/src/app/globals.css` and `apps/dashboard/src/index.css`, and as `c.*` in `design.ts`.

| Tailwind token | `design.ts` key | Hex | Usage |
|-------|-------|-----|-------|
| `ink` | `ink` | `#00102e` | Primary text, headings, dark backgrounds |
| `ink2` | `ink2` | `#33425f` | Secondary text |
| `dim` | `muted` | `#7884a0` | Muted labels, placeholders, helper text (**note:** the CSS token is `dim`; `muted` in Tailwind is the shadcn variable, a neutral grey) |
| `paper` | `paper` | `#ffffff` | Page / card background |
| `paper2` | `paper2` | `#f3f1ea` | Warm section backgrounds (landing auth pages, banners) |
| (none) | `card` | `#ffffff` | JS only |
| `line` | `line` | `#e4ddcf` | Default borders (warm beige) |
| `line-soft` | `lineSoft` | `#eee9dd` | Subtle dividers |
| `coral` | `coral` | `#e10f1f` | Primary CTA, hot/alert states, Buyer role colour |
| `coral-deep` | `coralDeep` | `#b80a17` | CTA hover / pressed, badge backgrounds |
| `sea` | `sea` | `#0b63ab` | Links, secondary CTAs, info states |
| `sea-deep` | `seaDeep` | `#003a73` | Dark blue accents |
| `gold` | `gold` | `#f0a800` | Highlights, badges, warnings, Owner role colour |
| `gold-deep` | `goldDeep` | `#c98700` | Darker gold |
| `brand` | `green` | `#1f7a3d` | Brand green, success states, Realtor role colour |
| `nav` (dashboard only) | `sidebar` (dashboard `design.ts` only) | `#0D1B3E` | Dashboard sidebar background (`bg-nav`) |

Other literal colours used in the dashboard: page background `#F8F9FC` (`DashLayout` content area and `body`), Admin role teal `#0d9488`, Calendly blue `#006BFF`, Google Calendar blue `#1a73e8`, scrollbar thumb `#e4ddcf`. The dashboard uses a lot of inline `style={{ color: tone }}` with hex values taken from the role tones (below).

### Dashboard role tones

Defined as `ROLE_TONE` in both `apps/dashboard/src/layouts/DashLayout.tsx` and `apps/dashboard/src/pages/Dashboard.tsx` (duplicated; change both):

| Role | Hex | Name |
|------|-----|------|
| Buyer | `#e10f1f` | coral |
| Owner | `#f0a800` | gold |
| Realtor | `#1f7a3d` | green |
| Admin | `#0d9488` | teal |

Tints are made by appending an alpha suffix to the hex (e.g. `${tone}22` for active nav backgrounds, `${tone}15` for the topbar role badge, `${tone}18` for pills).

### Semantic CSS Variables (shadcn/ui)

`:root` and `.dark` in the same CSS files define the standard shadcn variables (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--chart-1..5`, `--sidebar*`, `--radius: 0.625rem`) and expose them as Tailwind colours (`bg-background`, `text-muted-foreground`, `bg-primary`, ...) through `@theme inline`.

**These values are the stock shadcn "neutral" greyscale in `oklch`, not the brand palette.** For example `--primary` is near-black `oklch(0.205 0 0)` (not coral), `--secondary`/`--muted`/`--accent` are light grey, `--destructive` is a generic red and `--border` is `oklch(0.922 0 0)`. Consequences:
- Use the brand tokens (`bg-coral`, `text-ink`, `border-line`, `bg-paper2`) for product UI. Do **not** assume `bg-primary` or `border-border` are on-brand; `bg-primary` renders as dark grey/black.
- `text-muted` / `bg-muted` / `bg-accent` are neutral greys, not the brand `dim`/`paper2`/`gold`.
- `@layer base` applies `border-border`, `bg-background`, `text-foreground` to everything, so un-coloured borders are the neutral grey, and the dashboard body background is `#F8F9FC`.
- Radius utilities derive from `--radius` (`rounded-sm`..`rounded-4xl`).

### Dark mode

Not in use. Both apps declare `@custom-variant dark (&:is(.dark *))` and a `.dark { ... }` variable set (the shadcn defaults), but no code adds the `dark` class to `<html>`, there is no theme toggle, and brand colours have no dark variants. Treat the UI as light-only; if dark mode is ever added, the `.dark` variables must first be re-mapped to the brand palette.

---

## Typography

### Font Families

The declared stacks differ per app, and what actually loads differs again. Read this before changing fonts.

| App | `--font-sans` declared in CSS | Font files actually loaded |
|-----|-------------------------------|----------------------------|
| Landing (`apps/landing/src/app/globals.css`) | `'Mona Sans', 'Inter', -apple-system, system-ui, sans-serif` (plain `@theme`) | **None for these names.** `layout.tsx` has no `next/font` and no `<link>`; the only font import is `@fontsource-variable/geist` (registers `Geist Variable`, which is not in the stack). Unless a visitor has Mona Sans/Inter installed, text renders in the system UI font. |
| Dashboard (`apps/dashboard/src/index.css`) | `'Geist Variable', sans-serif` (and `body` font-family `'Geist Variable', 'Inter', ...`) | `@fontsource-variable/geist` bundled via CSS `@import`. `index.html` also links Google Fonts **Fraunces + Inter**, but nothing in the dashboard CSS references them (leftover). |

Other font facts:
- `design.ts` exports `fontSerif = '"Fraunces", "Playfair Display", Georgia, serif'` and `fontSans` (`"Mona Sans", "Inter", ...` in `packages/ui` and landing; `"Inter", ...` only in the dashboard copy). Only `SearchMapSidebar.tsx` uses the constants' Mona Sans stack directly (inline).
- There is **no `--font-serif` token and no `font-serif` usage anywhere in the apps**; headings use `font-sans` with bold/extrabold weights and tight tracking (e.g. `font-sans text-[22px] sm:text-[28px] font-extrabold tracking-[-0.02em]`). Fraunces/Playfair are legacy brand fonts that are not rendered.
- Mona Sans **is** used for the generated social share image: the TTFs live in `realty-api/assets/fonts/` (`MonaSans-SemiBold/Bold/ExtraBold.ttf` + `LICENSE.txt`) and are read by `realty-api/utils/share_image.py` (Pillow, 1200x630 card). See "Share-preview image" below.
- If you want the documented brand typography to actually appear, the missing step is loading the fonts (e.g. `next/font` in the landing `layout.tsx`, or fontsource/`<link>` for Mona Sans) and aligning the dashboard `--font-sans`.

### Usage Convention

- **Headings and body:** `font-sans` throughout (hero text, section titles, property names, labels, nav, buttons, forms). `html { @apply font-sans }` is set in both apps.
- **Monospace:** the dashboard sidebar shows the user code in `font-mono` (system monospace); otherwise not used.
- Many dashboard pages use arbitrary pixel sizes (`text-[13px]`, `text-[11.5px]`, `text-[10px] uppercase tracking-widest`) rather than the Tailwind scale; follow neighbouring components.

### Type Scale

Tailwind's default scale is used for landing marketing pages; the dashboard additionally uses many arbitrary sizes (see above). No custom `fontSize` theme extensions.

| Class | Size | Common Use |
|-------|------|-----------|
| `text-xs` | 12px | Captions, badges |
| `text-sm` | 14px | Secondary labels, table data |
| `text-base` | 16px | Body copy |
| `text-lg` | 18px | Sub-headings, card titles |
| `text-xl` | 20px | Section intro text |
| `text-2xl` | 24px | H3 / card hero text |
| `text-3xl` | 30px | H2 / section headings |
| `text-4xl–6xl` | 36–60px | H1 / hero headings |

---

## Spacing & Layout

Tailwind v4's 4px-base spacing scale is used, and v4 accepts any numeric step (`w-58`, `h-15`, `py-1.75`, `max-w-335`, `text-3.75` are all valid and compute as N x 0.25rem). No custom spacing tokens; many components also use arbitrary values (`px-[18px]`, `text-[13px]`).

### Grid System

- **Landing pages:** CSS Grid and Flexbox via Tailwind utilities. Content sections use centred containers such as `max-w-335 mx-auto px-4 sm:px-7` (hero, ~1340px); check the neighbouring section for the width in use. Auth pages sit in `min-h-[calc(100vh-74px)]` (74px is the navbar offset) on a `bg-paper2` background with a `max-w-105` (420px) card.
- **Dashboard (`DashLayout.tsx`):** fixed sidebar `w-58` (232px, `bg-nav`) from `md` up (off-canvas drawer below `md`, with `bg-black/50` backdrop), main area offset `md:ml-58`. Sticky topbar `h-15` (60px, `bg-paper`, `border-line`). Page content padding `p-4 sm:p-7`, background `#F8F9FC`. Detail panels and modals are page-local.

### Breakpoints

Tailwind's default breakpoints:

| Prefix | Width |
|--------|-------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

---

## Component Library

The shadcn/ui setup uses the `base-nova` style (`components.json` in each app; `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, aliases `@/components`, `@/lib/utils`, `@/components/ui`). Primitives come from `@base-ui/react` (not Radix), with `class-variance-authority`, `clsx` and `tailwind-merge` (`cn()` in `src/lib/utils.ts`). Add components with `npx shadcn@latest add <component>` run inside the app folder. The `tailwind.config` / `css` paths in `components.json` are stale for Tailwind v4: landing's CSS is `src/app/globals.css`, but `components.json` points at `src/index.css`.

### Primitives available

Only one shadcn component is installed, identical in both apps: `Button` in `apps/landing/src/components/ui/button.tsx` and `apps/dashboard/src/components/ui/button.tsx`.
- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`.
- Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
- **Not currently used**: no page imports it. Buttons across the product are plain `<button>` elements with Tailwind classes (see conventions below). If you adopt it, remember `default` is `bg-primary` (near-black, see the semantic-variable note), and `destructive` is a tinted red (`bg-destructive/10`), not solid.

### Button conventions in the actual UI

| Style | Classes (typical) | When to use |
|-------|------------------|-------------|
| Primary CTA (landing) | `rounded-full bg-coral text-white font-sans font-bold py-3.25 ...` | Main form/page action |
| Inverse CTA | `bg-white text-coral-deep rounded-full` on a `bg-coral-deep` band | Banner call-outs |
| Role-toned (dashboard) | `style={{ background: tone }}` + `text-white rounded-full text-[13px] font-bold` | Primary action in a role's screen |
| Quiet / outline | `border border-line bg-transparent rounded-lg` | Secondary actions, sidebar buttons use `border-white/12` |
| Destructive | red text/border or `ConfirmModal variant="danger"` | Deactivate/delete flows |

### Dashboard shared primitives

`apps/dashboard/src/components/dashboard/shared.tsx` (imported by ~11 screens):
- `Card({ title?, sub?, action?, padded? })` — white `rounded-2xl border-line` container with optional header row.
- `CardLink` — small `text-sea` text button for card headers.
- `StatusPill({ label, tone? })` — rounded pill coloured by tone, background `${tone}18`. The automatic tone is keyed on **English label strings** (`Active`/`Confirmed`/`Replied` green, `Pending`/`Warm` gold, `Hot` coral, `Saved` blue, else grey), so pass an explicit `tone` when the label is translated.
- `RoleKpiCard({ label, value, sub, accent? })` — KPI tile: uppercase `text-dim` label, 28px value.
- `SceneThumb`, `fmtPrice` (compact `$1.2M` / `$350K` formatter).

Other shared dashboard pieces: `components/shared/ConfirmModal.tsx` (`variant: 'danger' | 'warning'`), `components/dashboard/SetupBanners.tsx` (integration reminder banners; light blue for Calendly, amber for PayPal), `components/dashboard/SchedulingFrame.tsx` (inline Calendly/Google scheduling iframe), `components/RichTextEditor.tsx` (TipTap; output is styled by `.detail-prose`), plus the admin/listing detail panels.

### Rich-text prose classes

User-authored listing descriptions (sanitised with DOMPurify) are styled by `.listing-prose` in landing `globals.css` (17px body, ink2 text) and `.detail-prose` in dashboard `index.css` (13px, ink). Keep both in sync if heading/list styling changes.

### Component File Locations

| Component | Path |
|-----------|------|
| Landing / dashboard button (shadcn, unused) | `apps/landing/src/components/ui/button.tsx`, `apps/dashboard/src/components/ui/button.tsx` |
| Landing Navbar (incl. EN/ES `LanguageToggle`) | `apps/landing/src/components/Navbar.tsx` |
| Landing Footer | `apps/landing/src/components/Footer.tsx` |
| Dashboard shell | `apps/dashboard/src/layouts/DashLayout.tsx` |
| Dashboard shared primitives | `apps/dashboard/src/components/dashboard/shared.tsx` |
| Toasts | `react-hot-toast` `<Toaster>` in landing `layout.tsx` (top-center) and dashboard `main.tsx` (top-right) |
| Phone input | `react-international-phone` + `libphonenumber-js` (forms in both apps) |

---

## Icons

**Library:** `lucide-react` (^1.17.0, both apps)

Icons come from Lucide. A few inline SVGs exist in landing views (e.g. the success check and the show/hide-password eyes in `ResetPassword.tsx`), so "Lucide first, inline SVG for one-offs" is the working rule. In the dashboard, role and nav icons are mapped in `DashLayout.tsx` (`ROLE_ICON`, `NAV`).

**Convention:** Icon size defaults to `16px` (Lucide default). Use `size={20}` or `size={24}` for standalone icons; `size={16}` for inline/label icons.

---

## Inline Styles vs. Tailwind

**Rule:** Use Tailwind utility classes for all static styling. Use inline `style={{}}` only when the value is **data-driven at runtime** — e.g., a color derived from a prop, an array value, or a percentage calculated from data.

```tsx
// Correct — static color, use Tailwind
<div className="bg-coral text-paper" />

// Correct — data-driven color, use inline style
<div style={{ backgroundColor: listing.brandColor }} />

// Incorrect — avoid inline for static values
<div style={{ backgroundColor: '#e10f1f' }} />
```

---

## Design Token Source

All tokens are defined in:

| File | Scope |
|------|-------|
| `packages/ui/src/design.ts` (+ `index.ts` re-export) | Package `@ilovedr/ui`: `c` colour object (ink, ink2, muted, paper, paper2, card, line, lineSoft, coral, coralDeep, sea, seaDeep, gold, goldDeep, green), `fontSerif`, `fontSans`, `NAV_ITEMS`. Not imported by either app (neither lists `@ilovedr/ui` as a dependency). |
| `apps/landing/src/design.ts` | Landing copy: same colours/fonts plus `NAV_ITEMS` and header comments |
| `apps/dashboard/src/design.ts` | Dashboard copy: same colours plus `sidebar: '#0D1B3E'`; `fontSans` is Inter-only; no `NAV_ITEMS` |
| `apps/landing/src/app/globals.css` | **Live** Tailwind v4 `@theme` + shadcn variables for landing (imported by `app/layout.tsx`) |
| `apps/landing/src/index.css` | **Orphan** stale copy of `globals.css` (without the `.listing-prose` rules); not imported anywhere (only referenced by landing's `components.json`). Do not edit expecting an effect. |
| `apps/dashboard/src/index.css` | **Live** Tailwind v4 `@theme inline` + shadcn variables for the dashboard (imported by `main.tsx`) |

The Tailwind-generated classes read the CSS files, not `design.ts`; `design.ts` is only used where JS needs a value. When changing a brand colour, update the `@theme` blocks in **both** live CSS files, all three `design.ts` copies, and the hard-coded role-tone hexes in `DashLayout.tsx` / `Dashboard.tsx` / `shared.tsx` `StatusPill`. Also check the backend: email templates (`realty-api/utils/email.py`) and the share image (`utils/share_image.py`) hard-code brand hexes/RGB values.

Token differences between the two live CSS files: landing defines `--font-sans` as Mona Sans/Inter in a plain `@theme`; the dashboard defines Geist in `@theme inline` and adds `--color-nav`. Everything else (colours, radius) is the same.

---

## Logo & Brand Assets

| Asset | Location |
|-------|----------|
| Logo for light backgrounds (navbar, OG fallback image) | `apps/landing/public/iLoveDRRealty_Dark.png` (served at `/iLoveDRRealty_Dark.png`, also referenced as `https://ilovedrrealty.com/iLoveDRRealty_Dark.png` in metadata) |
| Logo for dark backgrounds (footer, login/signup panels) | `apps/landing/public/iLoveDRRealty_White.png` |
| Square icon (blog/article cards, JSON-LD logo) | `apps/landing/public/iLoveDRRealty_Icon.png` |
| Motto lockup | `apps/landing/public/iLoveDRRealty_Moto.png` |
| Dashboard sidebar logo | `apps/dashboard/src/assets/iLoveDRRealty_White.png` (imported in `DashLayout.tsx`); the folder also holds `_Dark`, `_Icon`, `_Moto` variants |
| Favicon | `apps/landing/public/favicon.ico`, `apps/dashboard/public/favicon.ico` |
| Team photos | `apps/landing/public/team/*.jpeg` |
| Email header logo | served from landing (`LOGO_URL` override, else `{LANDING_URL}/iLoveDRRealty_White.png`), see `realty-api/utils/email.py` |

(File names use `iLoveDRRealty_*`, lower-case `i`; the older `ILoveDRRealty_Logo.png` / `_DarkBG.png` names no longer exist.)

### Share-preview image (backend)

Listing share cards (`og:image` / `twitter:image` for WhatsApp, Facebook, etc.) are generated server-side by `realty-api/utils/share_image.py` when a listing is created or edited, uploaded to Supabase Storage at `share/{listing_id}.jpg`, and stored in `listings.share_image_url`; admins can regenerate via `POST /admin/listings/{id}/regenerate-share-image`. The card is 1200x630: cover-cropped first listing photo, bottom dark scrim, FOR SALE / FOR RENT pill (`#b80a17`), location pill, price in Mona Sans ExtraBold, beds/baths/area line, and an "I **LOVE** DR REALTY" wordmark with "LOVE" in a light coral `rgb(255,100,92)`. Fonts are the bundled TTFs in `realty-api/assets/fonts/` (Mona Sans SemiBold, Bold, ExtraBold). The landing listing page (`app/listing/[id]/page.tsx`) uses `share_image_url`, falling back to the first photo, then the logo. Fonts here are separate from the web fonts above, so changing web typography does not change share cards.

---

## Internationalization

Both apps are bilingual (English / Spanish) using `i18next` ^26 and `react-i18next` ^17 with statically imported JSON resources (no backend, no lazy loading, no language-detector plugin).

```
apps/landing/src/i18n.ts            # init; resources imported from src/locales/{en,es}/*.json
apps/landing/src/locales/{en,es}/   # auth, blog, buying, calculator, common, contact, footer, landing,
                                    # lead_capture, not_found, property_detail, search, selling, team, verify
apps/dashboard/src/i18n.ts          # init; resources imported from src/locale/{en,es}/*.json  (note: "locale", singular)
apps/dashboard/src/locale/{en,es}/  # admin, buyer, common, nav, owner, realtor, settings
```

**Setup rules (both apps):** default namespace `common`, `fallbackLng: 'en'`, `interpolation.escapeValue: false`, every namespace registered in the `ns` array in `i18n.ts`. Components call `useTranslation('<namespace>')` and keys are nested (`t('login.form.forgot')`). Adding a namespace means: create `en/` and `es/` JSON, import both in `i18n.ts`, add to `resources` and `ns`.

**Language selection and persistence:** the user's choice is stored client-side only, in `localStorage.ildr_lang` (`'en' | 'es'`); nothing is saved on the user record or sent to the API.
- **Landing:** `i18n.ts` starts at `lng: 'en'`; `components/I18nProvider.tsx` (mounted in `app/layout.tsx`) reads `ildr_lang` after mount and calls `changeLanguage`, so the first paint is English before switching (and server-rendered HTML is English). The switcher is `LanguageToggle` inside `components/Navbar.tsx`, which sets `ildr_lang` and calls `i18n.changeLanguage`. `<html lang>` stays `en`.
- **Dashboard:** `i18n.ts` reads `ildr_lang` synchronously at startup. The toggle is in the `DashLayout.tsx` sidebar footer (EN / ES).
- The two apps run on different origins, so a language picked on one is not shared with the other unless the same origin/localStorage is used.

**Dedicated Spanish routes (landing):** `src/app/es/bienes-raices-republica-dominicana/page.tsx` (Spanish Google-Ads landing page, view `views/SpanishLandingPage.tsx`, copy mostly inline rather than in JSON) and `src/app/es/article/[slug]/page.tsx` (Spanish blog articles from `data/blogData.es`). Both render `components/EsLangSync.tsx`, which forces the UI language to Spanish and persists `ildr_lang = 'es'` so Navbar/Footer stay Spanish while browsing. `app/sitemap.ts` emits `hreflang` alternates (`en`/`es`) for those pages and for articles that have a translation. Other pages are translated client-side only (same URL, no `/es` prefix). Listing content has a separate `description_es` field on the listing model.

**Gotchas:**
- Server-rendered metadata (titles/descriptions in `page.tsx` files) is English-only; only client components switch language.
- Some components key off English display strings (e.g. `StatusPill` automatic tones in `shared.tsx`); pass explicit values when translating.
- Several dashboard screens (e.g. the Connections tab in `pages/Settings.tsx`) still contain hard-coded English strings; check for missing keys when adding Spanish copy.
