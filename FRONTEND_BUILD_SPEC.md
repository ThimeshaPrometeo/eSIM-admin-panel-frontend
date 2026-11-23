# eSIM Management Platform: Frontend Build Spec (v1, demo first)

This document specifies the complete frontend of the eSIM Management Platform. It replaces any earlier
frontend spec. The first goal is a **client demo within one week** that runs entirely on built-in demo
data; the same code then switches to the real backend screen by screen, with no redesign.

Work is split into the phases in section 16. **Each phase ends with a review checkpoint: summarise what
was built, list assumptions, include screenshots of every new screen in light and dark mode (desktop and
mobile), then pause until the phase is approved.** Phases are done in order.

---

## 1. Reference material in this repository

| Path | What it is |
|---|---|
| `FRONTEND_BUILD_SPEC.md` | This document. The source of truth for the frontend. |
| `docs/backend/endpoints.md` | Backend API routes, request and response shapes, permission modules. Frontend types mirror these. |
| `docs/backend/schema-tenant.md`, `docs/backend/schema-platform.md` | Backend data model. Use the same names for domain types. |
| `docs/backend/decisions.md` | Backend decision log. Business rules there apply to the UI as well. |
| `docs/reference/PriceList.csv` | Real Yesim price list: one row per network (country, ISO2, operator, TADIGs, MCC-MNC, `Data, €/MB`, voice/SMS columns that are ignored, 4G/5G/VoLTE flags). 401 networks, 174 countries. |
| `docs/reference/location_zones_list.csv` | Real Yesim zones: TEST_LZ, ENIGMA_LZ and Italy with their networks (TADIG). Reseller B2B_ENIGMA, sponsor SP05. |
| `reference/sip-panel/` | Our previous SIP account panel (read only, git-ignored). Reuse its architecture, shell and navigation patterns, dialogs and component structure. Do not reuse its colours, fonts or surfaces. Never import from `reference/`; copy and adapt. |

If something the UI needs is missing from `docs/backend/`, do not invent backend behaviour: list it as an
open question and design the demo data around the most likely shape.

---

## 2. What the product is

- The company (tenant 1, "Prometeo") buys eSIMs in bulk from **Yesim** and sells them to **resellers** and
  directly to its own **end customers** (direct sales). Later the platform is sold as SaaS to network
  providers (more tenants). v1 has one tenant; data types must not assume there will only ever be one.
- Yesim does all eSIM work (stock, plans on eSIMs, usage metering, QR codes). The backend talks to Yesim;
  the frontend **only ever talks to our backend** (`/api/*`), never to Yesim.
- **One Yesim account holds everything.** Yesim gives each B2B client one account; sub-resellers inside Yesim
  can only be created manually by Yesim, so we don't use them. **Our resellers, assistants, customers, wallets,
  markups and permissions exist only in our platform**, and our data records which reseller and customer owns
  each eSIM. Creating a reseller in the UI never involves Yesim. Per-reseller reports, alerts and balances are
  computed by our platform; Yesim only sees the single account (B2B_ENIGMA). A future tenant using Yesim would
  get its own Yesim account from Yesim (manual setup), connected by the platform owner; no UI for that in v1.
- v1 sells **data-only travel eSIMs**. No phone numbers, calls, SMS plans or VoIP anywhere in the UI.
- All money is in **EUR**. Data amounts arrive as **bytes**; 1 MB = 1,048,576 bytes.
- Reference products: our SIP panel (layout, working style) and DROAM SIM management software (features,
  charts-only dashboard).

### 2.1 How billing works (the UI must make this clear)

- **Pay per MB used, charged after usage.** Yesim charges us per MB per network; resellers are charged per
  MB per network at their own price.
- **Reseller price per MB on a network** = Yesim €/MB × (1 + reseller markup %) × (1 − discount %).
  Markup is per reseller (set by admins only). Discounts are separate, per reseller, optionally per plan; the
  most specific discount wins. Direct sales use a tenant-level retail markup.
- A plan's real cost **depends on the network the phone uses**, so plans show a **price range plus a typical
  (median) price**, always in the viewer's own prices.
- **Holds.** When a plan is assigned to an eSIM, a **hold** reserves the plan's maximum possible cost from
  the wallet (default: plan data × highest reseller price among the zone's networks; admins may set a smaller
  hold per plan). Usage is charged from the hold; whatever is left is released when the plan ends.
- **Zero balance.** Plans can be assigned even when the wallet can't cover the hold:
  - adding a plan to an existing eSIM creates it as **Awaiting funds** (it does not start yet);
  - selling a new eSIM without enough funds only allows **On first use** activation; the plan is assigned and
    immediately **Blocked** until funded.
  - After a top-up, waiting plans are funded **oldest first, skipping to the next one that fits**, and unblock
    automatically. Unfunded plans are cancelled after a configurable number of days (default 30).
- **Hold used up.** When a plan's charged cost reaches its hold, the plan is **blocked** until a new hold can
  be funded.
- **Outstanding amount.** Usage the wallet could not cover (rare: rounding or a price rise) becomes an
  outstanding amount on the reseller. While it exists, **new plan orders are refused** and the next top-up
  pays it first. **No wallet can ever go negative**, including the house wallet.
- **Estimated, then final.** Every 15 minutes usage is charged provisionally (**Estimated**). Each night the
  supplier's per-network report re-prices the previous day exactly (**Final**). If the report is late, charges
  stay Estimated; admins are alerted after 2 days.
- **No refunds.** A failed or unclear sale only releases a hold; no money moved.
- **"Top-up" means topping up a reseller's wallet.** Adding a plan to an existing eSIM is **"Add plan"**. An
  eSIM can carry many plans.
- **Price changes** apply from the moment they take effect, including to plans already running.

---

## 3. Tech stack and conventions

- **Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS v4**, shadcn/Radix primitives.
- Charts: the same library as the SIP panel's `dashboard-charts` (Recharts if none), styled per section 7.
- 3D and motion: `three`, `@react-three/fiber`, `@react-three/drei`, `gsap` (with ScrollTrigger); fonts from the `geist` package. All from npm, bundled; no CDN (section 7.10).
- Each route's `page.tsx` is a thin server file rendering a `*-client.tsx` client component wrapped in
  `<AppShell>`.
- One React context (`PlatformProvider`, `usePlatform()`): signed-in user, role, effective permissions,
  theme, data mode, demo role switcher, unread notification count, wallet summary, `signIn`, `signOut`,
  `refresh`.
- All server calls go through `lib/api/client.ts` (`apiFetch`, `apiFetchBlob`) to `/api/*` with
  `credentials: "include"`; `proxy.ts` forwards `/api/*` to `BACKEND_URL`. Backend port 4000; frontend dev
  server port 3000.
- `lib/api/*` maps backend snake_case to camelCase types in `lib/platform/types.ts`. Components never see raw
  backend shapes.
- Folder and naming conventions match the SIP panel. No tool names in committed files or commit messages.

### 3.1 Folder structure

```
app/                         one folder per URL (section 6)
  layout.tsx, providers.tsx, error.tsx, not-found.tsx, forbidden/
components/
  ui/                        shadcn/Radix primitives
  platform/                  app-specific components
    app-shell, primary-rail, secondary-column, mobile-bottom-nav, mobile-secondary-nav
    route-guard, permission-gate (hides/disables by module + level)
    primitives (PageHeader, StatBlock, EmptyState, SectionCard)
    data-table (pagination, sorting, filters, column visibility)
    status-chip, period-select, unit-select (MB/GB/TB), money, data-amount, date-time
    charts/ (all dashboard and usage charts)
    esim-card (signature SIM-card visual), qr-card, usage-ring, usage-bar
    permission-matrix (assistants and staff roles)
    country-filter-list, coverage-panel, network-badges (4G/5G/VoLTE)
    three/ (globe, shader-background, scene helpers; client-only, lazy-loaded)
    motion/ (reveal, count-up, magnetic/glow button helpers)
    price-range, hold-preview
    confirm-dialog (type-to-confirm), reason-dialog (required reason)
    *-view.tsx (large page bodies), *-dialogs.tsx (create/edit/suspend/extend/top-up...)
contexts/platform-context.tsx
lib/
  api/                       one file per backend resource; demo and api implementations
  demo/                      demo data generators, CSV-derived network data, in-memory store
  platform/                  types.ts, nav-config.ts, permissions.ts, status.ts, period.ts,
                             units.ts, money.ts, dates.ts, pricing.ts (display helpers only)
hooks/                       use-mobile, use-period, use-paginated, use-permission
styles/globals.css           design tokens (section 7)
proxy.ts
```

---

## 4. Data layer: demo mode and API mode

- `NEXT_PUBLIC_DATA_MODE=demo|api`, default **demo** for now.
- Every `lib/api/<resource>.ts` exports the same functions and types in both modes; the mode only selects the
  implementation. **Pages never branch on the mode.** Switching a resource to `api` later needs no page
  changes.
- Function names, parameters and returned types follow `docs/backend/endpoints.md`.

### 4.1 Demo mode behaviour

- Works fully offline: no backend, no Yesim.
- Responses have small random delays (150–600 ms) so loading states are visible.
- An **in-memory store** seeded at startup and persisted to `localStorage`, so a demo survives a page
  refresh, with a **"Reset demo data"** action in the user menu.
- Actions really change the demo store: selling an eSIM creates it, approving a top-up changes the wallet
  and funds waiting plans, editing an assistant's toggles changes their navigation, suspending an eSIM
  changes its status.
- A visible **"Demo data"** badge in the top bar.
- A **role switcher** in the user menu: Admin, Staff (Support role), Reseller, Assistant. Switching applies
  exactly the same permission logic as the real system (section 5), so navigation, buttons and data scope
  change accordingly.
- Demo sign-in accepts any username and password; the 2FA step accepts any 6 digits.

### 4.2 Demo data (realistic, deterministic, seeded)

- **Networks, zones and Yesim prices** from `docs/reference/PriceList.csv` and `location_zones_list.csv`:
  real countries, operators, TADIGs, 4G/5G/VoLTE flags and `Data, €/MB`. Networks with a blank price are
  **unavailable** (never priced at 0).
- Tenant "Prometeo", currency EUR, time zone Asia/Colombo.
- Users: 1 admin, 2 staff (roles Support and Finance), 6 resellers (each with a user), 3 assistants with
  different permission sets.
- Resellers with different markups (15–40%) and some discounts (per reseller and per plan); one reseller with
  an outstanding amount; one suspended reseller.
- About 10 plans on real zones (e.g. Italy 1/3/5 GB, a Europe-style zone 5/10/20 GB, a wide zone 10 GB) with
  validity days, one with a hold override, one with a large price spread.
- About 120 eSIMs: active, suspended (by admin and by reseller), end of life; plans in every state (awaiting
  funds, blocked: no funds, blocked: hold used up, pending first use, active, expired, ended); install
  statuses (not installed, Downloaded, Installed, Enable, Disable, and one unknown raw value).
- 25 eSIMs belonging to **direct customers** (house wallet).
- 90 days of daily usage per plan and network: estimated charges for the last day, final before that, one
  day marked late.
- Wallets with holds, ledger entries of every type, top-up requests (pending, approved, rejected), receipts
  and monthly statements.
- Alerts of every type, notifications, audit log entries, orders including one **Being verified**.
- Inventory: free and assigned counts with 90-day history.
- Prices always computed as Yesim €/MB × (1 + markup) × (1 − discount).

---

## 5. Roles, permissions and navigation

### 5.1 Roles

| Role | Who | Data scope |
|---|---|---|
| Admin | Company managers | Everything in the tenant |
| Staff | Our team (e.g. Support, Finance) | Tenant data, limited by their staff role's grants |
| Reseller | A business buying from us | Only their own eSIMs, customers, plans, wallet, documents |
| Assistant | A person created by a reseller | Only their reseller's data, only the features switched on |

### 5.2 How access is decided

- **Effective access = tenant envelope ∩ role envelope ∩ grants**, per module, with levels `none`, `view`,
  `manage` (`manage` implies `view`).
- **Tenant envelope:** features the tenant has (all on for tenant 1).
- **Role envelope:** the maximum a role can ever have (table below).
- **Grants:** staff role toggles, or the assistant's toggles set by their reseller.
- The backend decides on every request. The frontend uses the same rules only to show or hide things;
  `lib/platform/permissions.ts` implements `can(user, module, level)`.
- The token only identifies the user; permissions are never stored in the token or in localStorage
  (except in the demo store).

### 5.3 Modules and role envelopes

M = manage, V = view, `-` = none. Staff and assistant columns are upper limits.

| Module | Admin | Staff | Reseller | Assistant | Notes |
|---|---|---|---|---|---|
| dashboard | V | V | V | V | Revenue/profit charts need `profit_reports` |
| sell_esim | M | M | M | M | Admin/staff sales are direct sales |
| esims | M | M | M | M | Reseller actions limited (section 8.4) |
| usage | V | V | V | V | |
| orders | M | M | V | V | Resolving "being verified" is admin/staff only |
| inventory | M | M | - | - | |
| alerts | M | M | V | V | Only admin/staff set rules |
| plans | M | M | - | - | Real (supplier) plans |
| reseller_plans | V | V | M | M | Reseller's own named plans |
| coverage | V | V | V | V | |
| price_lists | M | M | V | V | |
| discounts | M | M | V | V | Resellers see only their own |
| resellers | M | M | - | - | Markup editable by admin only |
| customers | M | M | M | M | |
| assistants | V | V | - | - | Admin overview; admin can disable in an emergency |
| team | - | - | M | - | Reseller manages own assistants |
| wallets | M | M | V | V | |
| transactions | V | V | V | V | |
| topup_requests | M | M | M | M | Manage = approve (admin/staff) or create (reseller/assistant) |
| invoices | M | M | V | V | Documents |
| profit_reports | M | V | - | - | Revenue, supplier cost, profit, reconciliation |
| users | M | M | - | - | Username change admin only |
| staff_roles | M | V | - | - | |
| settings | M | V | - | - | |
| yesim_connection | M | V | - | - | |
| audit_log | V | V | - | - | |

Assistants can never exceed their reseller, can never create assistants and never see Team management.

### 5.4 Navigation (sections with tabs)

Labels in sentence case. Desktop: primary rail (sections) + secondary column (tabs). Mobile: top bar,
bottom navigation (sections), secondary navigation (tabs). A tab shows only if the user can `view` its
module; a section with no visible tabs is hidden. Direct URL access without permission shows the
access-denied page. Buttons that change data are hidden when the user only has `view`.

**Admin and staff**

| Section | Tabs |
|---|---|
| Overview | Dashboard |
| eSIM management | All eSIMs, Sell eSIM, Orders, Usage, Inventory, Alerts and rules |
| Product management | Plans, Coverage, Price list, Discounts |
| Reseller management | Resellers, Customers, Assistants |
| Finance | Wallets, Transactions, Top-up requests, Invoices, Profit and costs |
| User management | Users, Staff roles |
| System | Settings, Yesim connection, Audit log |

**Reseller**

| Section | Tabs |
|---|---|
| Overview | Dashboard |
| Sales | Sell eSIM, My plans, Coverage, Price list |
| eSIM management | My eSIMs, Orders, Usage |
| Customer management | Customers |
| Finance | Wallet, Transactions, Invoices |
| Team management | Assistants |
| Settings | Profile, Security, Notifications |

**Assistant:** the reseller navigation without Team management, filtered by their toggles.

Every user also has Notifications (bell with unread count), Profile and security (user menu) and Sign out.

---

## 6. Routes

Workspace routes live under `app/esim/`. One route serves several roles where possible; the data scope and
available actions adapt to the role.

| Route | Module | Section |
|---|---|---|
| `/` | public | Sign in (8.31) |
| `/login/2fa` | public, after password | 2FA step (8.31) |
| `/login/change-password` | signed in, forced | First-login password change (8.31) |
| `/forgot-password`, `/reset-password` | public | Password recovery |
| `/esim/dashboard` | dashboard | 8.1 |
| `/esim/esims`, `/esim/esims/[id]` | esims | 8.2, 8.3 |
| `/esim/sell` | sell_esim | 8.5 |
| `/esim/orders`, `/esim/orders/[id]` | orders | 8.6 |
| `/esim/usage` | usage | 8.7 |
| `/esim/inventory` | inventory | 8.8 |
| `/esim/alerts` | alerts | 8.9 |
| `/esim/plans`, `/esim/plans/[id]` | plans | 8.10 |
| `/esim/my-plans` | reseller_plans | 8.11 |
| `/esim/coverage` | coverage | 8.12 |
| `/esim/price-list` | price_lists | 8.13 |
| `/esim/discounts` | discounts | 8.14 |
| `/esim/resellers`, `/esim/resellers/[id]` | resellers | 8.15 |
| `/esim/customers`, `/esim/customers/[id]` | customers | 8.16 |
| `/esim/assistants` | assistants (admin) / team (reseller) | 8.17 |
| `/esim/wallets`, `/esim/wallets/[id]` | wallets (admin/staff) | 8.18 |
| `/esim/wallet` | wallets (reseller/assistant) | 8.19 |
| `/esim/transactions` | transactions | 8.20 |
| `/esim/topup-requests` | topup_requests (admin/staff) | 8.21 |
| `/esim/invoices` | invoices | 8.22 |
| `/esim/profit` | profit_reports | 8.23 |
| `/esim/users` | users | 8.24 |
| `/esim/staff-roles` | staff_roles | 8.25 |
| `/esim/settings` | settings | 8.26 |
| `/esim/yesim` | yesim_connection | 8.27 |
| `/esim/audit-log` | audit_log | 8.28 |
| `/notifications` | everyone | 8.29 |
| `/profile` | everyone | 8.30 |
| `/design-system` | development only, hidden | 7.7 |

---

## 7. Visual design: ultra-premium, dark first

### 7.1 Goal

Ultra-premium and modern, at the level of polish of Linear or Apple: a rich **dark-first** interface with
subtle ambient lighting, glassmorphic cards with thin borders, generous whitespace, live graphics (an
interactive 3D hero and fluid shader backgrounds that react subtly to the mouse), smooth scroll reveals and
tactile micro-interactions. It must look and feel clearly more premium and more graphical than the SIP
panel, while every working page stays fast, calm and easy to read. Subject: global connectivity: networks,
countries, signal, light travelling across the planet.

Dark mode is the primary design. Light mode is supported as a secondary theme with the same accents.

### 7.2 Palette (semantic tokens in `styles/globals.css`; no hard-coded colours in components)

| Token | Dark (primary) | Light | Role |
|---|---|---|---|
| `--bg` | Midnight Ink `#050A14` | `#F5F8FC` | App background |
| `--surface-1` | `#0A1322` | `#FFFFFF` | Base panels |
| `--surface-2` | `#0F1B2E` | `#F0F4FA` | Raised panels, popovers |
| `--surface-3` | `#15243B` | `#E6EDF7` | Highest elevation, hover |
| `--glass` | `rgba(255,255,255,0.04)` + blur 20px | `rgba(255,255,255,0.7)` + blur 20px | Glassmorphic cards |
| `--border` | `rgba(255,255,255,0.08)` (1px) | `rgba(5,10,20,0.08)` | Thin borders |
| `--highlight` | `rgba(255,255,255,0.12)` top edge | `rgba(255,255,255,0.9)` | 1px inner top highlight on glass |
| `--text` | `#EAF2FF` | `#050A14` | Primary text |
| `--text-2` | `#8A9BB5` | `#4A5A72` | Secondary text |
| `--text-3` | `#5B6B84` | `#7A8AA0` | Tertiary, placeholders |
| `--primary` | Azure Blue `#0080FF` | `#0066E0` | Primary actions, links, focus, active nav, main chart series |
| `--primary-glow` | `rgba(0,128,255,0.35)` | `rgba(0,102,224,0.18)` | Glows and ambient light |
| `--accent` | Bioluminescent Emerald `#00E5A0` | `#00A877` | Live, active, success, positive deltas, "online" signals, second chart series |
| `--accent-glow` | `rgba(0,229,160,0.30)` | `rgba(0,168,119,0.16)` | Bioluminescent glows |
| `--warning` | `#FFB547` | `#B7791F` | Warnings, estimated amounts, 80% usage, low balance |
| `--danger` | `#FF4D6A` | `#D92D4A` | Suspended, blocked, errors, destructive |
| `--neutral` | `#64748B` | `#64748B` | Expired, ended, inactive, in stock |

- **Signature gradient:** Azure → Emerald (135°), used sparingly: primary hero accents, active chart lines,
  the eSIM card edge light, progress and usage rings.
- Azure is the action colour; Emerald means "alive / healthy / positive". Warning and danger colours are only
  for status.
- Contrast: WCAG AA for all text in both themes (Emerald and Azure are not used for body text on light).

### 7.3 Typography

- **Geist Sans** for UI and **Geist Mono** for ICCIDs, IDs, codes and tabular data, installed from the
  `geist` npm package and served locally (no font CDN).
- Scale: display 40/44 (hero numbers), page title 28/34 semibold with tight tracking (-0.02em), section title
  18/26 semibold, body 14/22, small 12/18.
- Tabular figures for all numbers that align. Key numbers are large; labels small and quiet. No all-caps
  labels.

### 7.4 Surfaces, light and depth

- **Ambient lighting:** two or three very soft, slowly drifting radial light sources behind the content (Azure
  top-left, Emerald bottom-right, low opacity), implemented in CSS on ordinary pages; never distracting.
- **Glass cards:** `--glass` fill, backdrop blur, 1px `--border`, 1px top `--highlight`, radius 16px; a faint
  glow on hover/focus only for interactive cards.
- Radii: shell panels 24px, cards 16px, inputs/buttons 12px, chips fully rounded.
- Generous whitespace: 32px gaps between major blocks on desktop, 24px card padding (16px on mobile).
- Dark mode uses light and glow for depth, never heavy drop shadows. Light mode uses very soft cool shadows.

### 7.5 Live graphics and 3D

All built with **Three.js via @react-three/fiber and @react-three/drei, GLSL shaders and GSAP**, installed
from npm and bundled with the app. Spline or any hosted scene is not allowed (no external URLs).

1. **3D globe (signature element):** a dark glass globe made of fine dots (world geometry from a bundled
   local TopoJSON/GeoJSON file), covered countries lit in Emerald, Azure light arcs travelling between
   countries, a soft atmospheric rim glow.
   - **Sign-in page:** the hero; rotates slowly and tilts subtly towards the mouse with weighted inertia.
   - **Coverage page:** interactive; drag to rotate, scroll/pinch to zoom, hovering a country highlights it,
     clicking selects it in the country list (and selecting in the list rotates the globe to it).
   - **Dashboard header:** a small, quieter version with live arcs from recent usage countries.
2. **Fluid shader background:** a subtle, slow, dark fluid/noise shader in Azure and Emerald tones behind
   the sign-in page and the dashboard header, reacting gently to mouse position. Low resolution render
   target, cheap noise; never behind tables or forms.
3. **The eSIM card:** a SIM-shaped card (cut corner, fine-line chip contour) in dark glass with an
   Azure→Emerald edge light, QR code, ICCID in Geist Mono and a usage ring; it **tilts in 3D towards the
   cursor** with a moving specular highlight (CSS 3D transforms, no WebGL needed). Used on the sell result and
   eSIM detail.
4. **Charts:** glowing Azure lines with soft gradient fills, Emerald for the second series and positive
   values, faint grid, rounded bar ends, glass tooltips; draw-in animation once on first view.

### 7.6 Motion: weighted and silky

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, `cubic-bezier(0.65, 0, 0.35, 1)` for movement.
  Durations 400–700ms for layout and reveals, 150–200ms for hovers. **No bouncy springs, no overshoot, nothing
  fast or jittery.**
- Scroll: content sections fade and rise 12–16px with a short stagger as they enter the viewport (GSAP
  ScrollTrigger or IntersectionObserver), once per page view.
- Numbers count up once on the dashboard; charts draw in once.
- Micro-interactions: buttons press to scale 0.98 with an inner glow; primary buttons have a soft light that
  follows the cursor across their surface; toggles slide with weight; the active-nav indicator glides between
  tabs; dialogs and drawers open with a blur-in backdrop.
- Mouse-reactive elements move with inertia (lerped), never 1:1.
- `prefers-reduced-motion`: no 3D animation (static render), no shader animation, no scroll reveals; instant
  state changes.

### 7.7 Performance budget (must hold)

- 60 fps on a mid-range laptop; 3D and shaders never block input.
- 3D code is loaded only on pages that use it (dynamic import, client only); no Three.js in other pages'
  bundles.
- Device pixel ratio capped at 1.5 for WebGL; render loop pauses when the canvas is off screen or the tab is
  hidden; demand-based rendering when idle.
- WebGL unavailable or low-power device: a static pre-rendered globe image/SVG and a CSS gradient instead.
- Tables, forms and lists never sit on top of animated WebGL; they use the CSS ambient background only.

### 7.8 Components

- shadcn/ui components (copied into `components/ui`, as shadcn intends) restyled to these tokens: glass
  surfaces, thin borders, 12px radius, Azure focus rings with a soft glow.
- Icons: lucide (npm), one stroke width (1.5).
- Empty states: a small glowing line illustration (SIM card, globe, signal) and one clear action.
- Loading: skeletons in `--surface-2` with a slow shimmer; no centred spinners.
- Tables: comfortable rows, sticky glass header, row hover in `--surface-3`, status chips with a small glowing
  dot.
- Copy: sentence case, plain verbs; a button and its toast use the same verb.

### 7.9 Design system page

`/design-system` (development only) shows every token, the type scale, all component states, every chart, the
eSIM card (with tilt), the globe, the shader background, glass cards, dialogs and toasts, **dark and light side
by side**, plus a frame-rate meter. It is approved before any feature page is built and becomes the visual
target for every page. There are no external design files: the design is created in code from this section.

### 7.10 No external URLs

The running app loads nothing from outside its own origin: no CDNs, no hosted fonts, no remote images, no
hosted 3D scenes, no analytics. All code, fonts, icons, geometry data and images live in this repository and
are bundled. A Content-Security-Policy with `default-src 'self'` (plus what Next.js needs) enforces this.
npm packages are fine because they are installed into the project and bundled.

## 8. Pages

Every list page: search, filters, sortable columns, pagination, column visibility, loading/empty/error
states, and export where stated. Every mutation shows a toast. Destructive and money actions ask for
confirmation; some require a reason (stored in the audit log).

### 8.1 Dashboard (charts only)

- Toolbar: period (today, 7 days, 30 days, this month, this year, custom range) with grouping day/month/year;
  unit select MB/GB/TB for all usage charts; admins and staff also filter by reseller.
- Stat row: total eSIMs, active eSIMs, data used in the period; resellers/assistants: available wallet
  balance; admins: revenue in the period.
- Charts: daily data usage (area); monthly usage (bar); eSIM status (donut: active, suspended, expired, plus
  in stock for admins); plan types sold; transactions over time (credits vs debits); top 10 eSIMs by usage
  (horizontal bar, click opens the eSIM); usage by country (bar); revenue and profit (needs
  `profit_reports`).
- Every chart shows only data in the viewer's scope; estimated amounts are visibly marked.

### 8.2 eSIM list

- Columns: ICCID, status, install status, current plan(s), data used/limit bar, expiry, customer, reseller
  (admin/staff only), last activity.
- Filters: search (ICCID, customer), status, install status, plan state (awaiting funds, blocked, active,
  pending first use, expired), plan, country, reseller (admin/staff), customer.
- Export CSV.

### 8.3 eSIM detail

- Header: the **eSIM card** (QR, ICCID, plan, usage ring), status (Active, Suspended by admin, Suspended by
  reseller, End of life), install status (the supplier's raw value shown as is when not recognised),
  reseller and customer.
- **Install details:** QR code (show, download, email), activation code, SM-DP+ address, full LPA string,
  each with copy buttons.
- **PIN and PUK:** hidden behind "Show PIN and PUK"; loaded on request (read live by the backend, never
  stored); every reveal is audit-logged; available to every role that can view the eSIM.
- **Plans on this eSIM** (an eSIM can have many): name, state (Awaiting funds, Blocked: no funds, Blocked:
  hold used up, Pending first use, Active, Expired, Ended), activation type, start, expiry, data used/limit,
  hold amount and used part, estimated vs final charges.
- **Usage chart** for this eSIM with period and unit selects, plus a usage by country/network table.
- **Activity timeline:** orders, status changes, install status changes, alerts.
- Actions per section 8.4.

### 8.4 eSIM actions and rules

| Action | Who | Rules |
|---|---|---|
| Add plan | sell_esim manage | Opens the sell flow for this eSIM (8.5) |
| Suspend / reactivate eSIM | esims manage | Resellers and assistants can only reactivate eSIMs **they** suspended; an admin suspension can only be lifted by admin/staff |
| Extend plan expiry | admin/staff only | Reason required |
| Change plan data (add data) | admin/staff only | Reason required; shows the new total |
| Block / unblock plan | admin/staff only | Reason required |
| Set end of life | admin only | Type the eSIM's ICCID to confirm, plus a reason; warns that only the supplier can reverse it |
| Delete plan / remove all plans | admin only | Type-to-confirm and a reason |
| Show PIN and PUK | esims view | Audit-logged |
| Download usage | usage view | CSV and PDF (watermarked) |

### 8.5 Sell eSIM / Add plan

A stepper. The same flow sells a new eSIM or adds a plan to an existing eSIM (then step 1 shows that eSIM).

1. **Choose plan.** Search by country or browse. Each plan card: name, data, validity days, countries ("Works
   in 30 countries", expandable with flags), **price range + typical price per GB in the viewer's prices**,
   and the **hold amount** for this viewer. Resellers can pick their own named plans (My plans).
2. **Customer** (optional): pick an existing one or create inline (name, email, phone).
3. **Activation:** Activate now / On first use (default) / On a set date (date-time picker).
4. **Confirm:** price range, hold amount, available balance now and after the hold. Then:
   - enough balance → "Sell eSIM" or "Add plan";
   - not enough balance, new eSIM → only On first use allowed; message: "The eSIM is created and blocked until
     your wallet covers the hold.";
   - not enough balance, add plan → message: "The plan waits as Awaiting funds and starts when your wallet
     covers the hold.";
   - outstanding amount on the reseller → selling is refused, showing the amount and a "Request top-up" link;
   - daily sale limit reached → clear message.
5. **Result:** Completed → the **eSIM card** with QR, activation code, SM-DP+ address, LPA string, and
   buttons to download the QR, email the QR and open the eSIM. **Being verified** (the supplier didn't
   answer) → "Don't sell again; we're checking with the supplier", with a link to the order. **Failed** →
   the reason, and "No money was taken; the hold was released."

Generate an idempotency key per attempt and reuse it on retry; the confirm button is disabled while sending.

### 8.6 Orders

- List: type (new eSIM, add plan), eSIM, plan, reseller, user, status (Pending, Completed, Being verified,
  Failed), created.
- Admin/staff resolve **Being verified** orders by entering the ICCID, which is checked against the supplier
  before the order completes.

### 8.7 Usage

- Usage per eSIM (per subscriber): table and chart; filters period (day/month/year/custom), reseller
  (admin/staff), plan, country; unit MB/GB/TB; columns include data, cost to the viewer (estimated/final),
  country, network.
- Export **CSV and PDF** (PDF watermarked).

### 8.8 Inventory (admin/staff)

- Free vs assigned eSIM counts, 90-day trend, low-stock threshold (from settings) with a warning.

### 8.9 Alerts and rules

- **Rules** (admin/staff manage): usage threshold % (e.g. 80, 100) with action Notify or Auto-suspend.
- **Alert inbox:** usage thresholds, low stock, low wallet, house wallet low, orders being verified, usage on
  a network with no price, late usage report, daily sale limit reached. Open/resolved. Resellers and
  assistants see alerts for their own eSIMs only.

### 8.10 Plans (admin/staff)

- List: name, zone, data, validity, price range (supplier cost range shown to admins), hold, active, sold
  count.
- Create/edit: name; zone (zones containing networks without a price are listed but can't be used); data in
  MB/GB (sent as bytes); validity days; **calculated default hold** shown live; optional **hold override**;
  **price spread warning** when the zone's highest network price exceeds the lowest by more than the settings
  threshold (default 3×); active toggle.
- Plan detail: the zone's networks with supplier €/MB, example reseller prices, sold count.

### 8.11 My plans (resellers)

- Resellers create named versions of admin plans: base plan, own name, selling price to their customers
  (informational only; billing always uses per-MB charging).

### 8.12 Coverage

- Hero: the interactive 3D globe (section 7.5) with covered countries lit; selecting a country in the list rotates the globe to it, and clicking the globe selects the country.
- Left: **filterable country list** (no continent grouping): search, filters for 4G/5G, plan and zone.
- Right (selected country): networks with 4G/5G/VoLTE badges and the viewer's price per GB; networks without
  a price shown as "Unavailable"; plans that work there; zones that include it.
- Mobile: list, then a detail screen.

### 8.13 Price list

- Per country and network: the viewer's price per MB and per GB, 4G/5G/VoLTE; admins also see supplier €/MB
  and each reseller's resulting price. Last synced time. Filters: country, network, zone.
- Export **Excel and PDF** (PDF watermarked). Resellers export their own prices only.

### 8.14 Discounts (admin manage; others view their own)

- Per reseller %, optionally per plan; the most specific wins; a live preview of the resulting price per GB
  on a sample network.

### 8.15 Resellers (admin/staff)

- List: company, status, markup (admins only), discount, wallet available/held, outstanding, eSIM count,
  assistants count.
- Detail tabs: Overview (stats, usage chart), eSIMs, Customers, Wallet and ledger, Discounts, Assistants,
  Documents, Audit trail.
- Actions: create reseller (company, contact, first user, markup from the settings default; created only in
  our platform, nothing is created at Yesim), edit, suspend,
  **change markup (admins only, audit-logged, applies from save)**, top up wallet.
- Resellers never see the supplier's cost, any markup % (their own included) or other resellers' prices.

### 8.16 Customers

- End customers (resellers see their own; admins see all, including direct customers): name, email, phone,
  reseller, eSIMs. Create, edit, open eSIMs.

### 8.17 Assistants (admin view) / Team (reseller manage)

- Resellers: list assistants (name, username, status, e.g. "6 of 14 areas enabled"), create, edit, disable.
- **Permission matrix:** grouped by the reseller navigation sections; per tab **View** and **Manage**
  switches (`-` where not applicable: Dashboard and Usage are view only, Sell eSIM is action only); a
  section switch toggles the whole section; Manage on turns View on, View off turns Manage off; toggles
  outside the reseller's envelope are greyed out with an explanation. Own profile is always available.
- Admins: read-only list of all assistants across resellers, with an emergency **Disable** action (reason,
  audit-logged).

### 8.18 Wallets (admin/staff)

- All wallets including the **house wallet**: balance, held, available, outstanding.
- Wallet detail: ledger (type, amount, balance after, reference, estimated/final for usage), holds (plan,
  amount, used, status), manual credit or adjustment (reason required).

### 8.19 Wallet (reseller/assistant)

- Balance, held, **available**, outstanding (with an explanation when present).
- Holds (plan, eSIM, amount, used, status) and plans waiting for funds, in funding order.
- **Request top-up** (amount, bank transfer reference, note); list of requests with status; receipt download
  when approved.
- A collapsible plain-language explanation of holds and per-MB charging.

### 8.20 Transactions

- Ledger across the viewer's scope: date, type (top-up, usage charge, hold, hold release, adjustment,
  outstanding payment), amount, balance after, reference, estimated/final; filters for period, type,
  reseller; export CSV.

### 8.21 Top-up requests (admin/staff)

- Pending/approved/rejected; Approve credits the wallet, pays any outstanding amount first, issues a receipt
  and triggers funding of waiting plans; Reject requires a reason.

### 8.22 Invoices (documents)

- Monthly statements per reseller (per-MB usage charges per plan per day, top-ups, released holds), top-up
  receipts, direct-sale invoices. Sequential numbers per tenant; issued documents never change.
- Download as PDF. **Every PDF carries a large diagonal semi-transparent watermark "Downloaded by <full name>
  (<username>) · <date and time>"**, applied at download time; on by default for everyone including admins;
  admins can turn it off per document type in Settings. Downloads are audit-logged.

### 8.23 Profit and costs (admin; staff view)

- Revenue (reseller charges + direct sales), supplier cost, profit by period, reseller, country, network and
  eSIM.
- **Reconciliation:** the supplier's live balance vs the balance our records imply, difference highlighted.
- Export CSV and PDF.

### 8.24 Users (admin/staff)

- All accounts: name, username, email, role, reseller, staff role, status (active, disabled, locked), 2FA
  status, last sign-in.
- Actions: create staff user, disable/enable, unlock, **reset 2FA** (reason required), **change username
  (admins only)**.

### 8.25 Staff roles (admin)

- Create and edit roles (e.g. Support, Finance) with the same permission matrix component over the admin
  navigation sections; the staff envelope applies.

### 8.26 Settings (admin; staff view)

- Company: name, currency (EUR, read only), time zone (default Asia/Colombo).
- Pricing: default markup for new resellers, retail markup for direct sales, price spread warning threshold.
- Billing: unfunded plan cancellation days (default 30), house wallet warning threshold, low wallet threshold.
- Stock: low-stock threshold.
- Documents: watermark on/off per document type (statement, receipt, invoice, usage report, price list); tax
  wording text.
- Security: 2FA required for all accounts (shown as policy).

### 8.27 Yesim connection (admin; staff view)

- Connection status, discovered reseller/account/network profile, write-mode status (read only), daily sale
  limit and total cap.
- Last runs of catalogue sync, price list sync, usage meter (every 15 minutes), nightly re-pricing, funding
  queue and order reconcile; "Sync now" for catalogue and price list.
- Webhook URLs (copy) and the latest notifications received.
- Supplier balance vs house wallet (link to reconciliation).

### 8.28 Audit log (admin/staff)

- Who, action, entity, time, IP; before/after diff view; filters for user, entity, action and period.
  Includes PIN/PUK reveals and PDF downloads.

### 8.29 Notifications

- List with the unread count in the bell; mark as read; links to the related item.

### 8.30 Profile and security

- Profile: name, email; username shown read only (only admins change usernames).
- Change password.
- 2FA: set up (QR image plus the secret key for manual entry), confirm with a code, show recovery codes once,
  regenerate codes.
- Passkeys: add, name, remove.
- Sessions: sign out everywhere.

### 8.31 Sign in

- Username + password, then (when 2FA is set up) a 6-digit code or a recovery code, then the workspace. A
  "Use a passkey" option.
- Forced password change on first sign-in. A 2FA set-up prompt for every account (required from go-live).
- Lockout message after 10 failed attempts (15 minutes).
- The 3D globe hero with the fluid shader background (section 7.5).

---

## 9. Formatting rules

- Data: bytes from the API, displayed in the chosen unit or automatically (binary: 1 MB = 1,048,576 bytes).
- Money: EUR, 2 decimals in summaries; per-MB prices with 4–6 significant digits. The UI never recalculates
  prices the backend returns (demo mode mimics the backend).
- Dates: stored in UTC; shown in the user's time zone (default Asia/Colombo), with relative times where
  helpful.
- Estimated amounts always carry an "Estimated" chip until final.
- ICCIDs and IDs in tabular figures with copy buttons.

---

## 10. Exports and PDFs

- CSV: usage, transactions, eSIM list, profit.
- Excel: price list.
- PDF: usage report, price list, documents (statements, receipts, invoices), profit report.
- Every PDF carries the watermark from 8.22 (respecting the per-document setting); downloads are
  audit-logged.
- In demo mode, PDFs are generated client-side with the same watermark so the behaviour can be shown.

---

## 11. Security

- Auth uses the backend's httpOnly cookie. Never store tokens in localStorage or sessionStorage.
- `apiFetch` handles 401 (sign out, redirect to `/` with a return URL) and 403 (access-denied view).
- The backend checks the Origin header on state-changing requests; the proxy must forward it.
- No secrets in `NEXT_PUBLIC_*` variables. `BACKEND_URL` is server-side only.
- Content-Security-Policy `default-src 'self'`; nothing is loaded from outside the app's origin (section 7.10).
- Client-side permission checks are for display only.

---

## 12. Out of scope for v1 (do not build, no menu items)

Card payments (Stripe, PayPal, NOWPayments), Cloudflare, IP whitelisting, white-label branding and custom
domains, tenant management screens, reseller API and API keys, end-customer portal, ML usage anomaly
detection, recurring/auto-renewing plans, phone numbers, calls, SMS, VoIP, extra assistant attributes
(sales limits, allowed plans, own customers only, expiry), dedicated stock per reseller, creating Yesim
sub-resellers or moving eSIMs between Yesim accounts (Yesim handles sub-resellers manually).

---

## 13. Accessibility and responsiveness

- Keyboard navigation everywhere, visible focus, labels on all inputs, WCAG AA contrast.
- Fully responsive: desktop rail + secondary column; mobile top bar, bottom navigation and secondary
  navigation, following the SIP panel's mobile patterns.

---

## 14. Testing

- Vitest + Testing Library for `lib/platform/*` (permissions including envelopes, units, money, dates,
  period), the demo pricing formula, the permission matrix rules, the sell flow outcomes, and the route guard.

---

## 15. Demo scope (one week)

Build in this order; everything else appears in the navigation as disabled "Coming soon" items.

1. Design system page (light + dark).
2. App shell and navigation (desktop + mobile), role switcher, "Demo data" badge, reset demo data.
3. Sign in, 2FA step, forced password change (demo logic).
4. Dashboard (all charts and filters).
5. Coverage (3D globe, filterable countries, networks, prices) and Price list.
6. Plans (admin) and My plans (reseller).
7. Resellers list and detail (markup, discount, wallet) and Discounts.
8. Assistants / Team with the permission matrix (switching role shows the effect).
9. eSIM list and eSIM detail (eSIM card, install details, PIN/PUK, plans, usage, actions).
10. Sell eSIM / Add plan (all outcomes, including awaiting funds and blocked).
11. Wallet (reseller), Wallets (admin), Transactions, Top-up requests (request and approve end to end).

Write a suggested demo path in `docs/demo-script.md`: admin dashboard → coverage and prices → create a
reseller with a markup → switch to the reseller → sell an eSIM with zero balance (blocked) → request a top-up
→ switch to admin → approve it → the plan unblocks → set an assistant's permissions → switch to the assistant.

---

## 16. Phases (each ends with a review checkpoint)

**Phase 0: Plan (no code).** Produce `docs/CONVENTIONS.md` (architecture and rules summary, kept up to date;
every session reads it first), `docs/routes.md` (route, roles, module, data functions, components),
`docs/components.md` (reused from the SIP panel vs new), `docs/demo-data.md` (data plan per 4.2),
`docs/demo-plan.md` (day-by-day order for two developers working in parallel on separate pages), and open
questions.

**Phase 1: Design system.** Tokens, typography, components, eSIM card (with tilt), permission matrix, charts, 3D
globe, shader background, motion helpers; the `/design-system` page with a frame-rate meter. Screenshot and
short screen-recording review, dark and light.

**Phase 2: Shell and demo foundation.** App shell, navigation, permissions, route guard, platform context,
data layer with the demo implementation and store, role switcher, sign-in screens.

**Phase 3: Demo pages, part 1.** Items 4–8 of section 15.

**Phase 4: Demo pages, part 2.** Items 9–11 of section 15, `docs/demo-script.md`, polish (responsive,
empty and error states), fixes from a demo rehearsal.

**After the demo:** the remaining pages (orders resolve, usage, inventory, alerts, invoices, profit, users,
staff roles, settings, Yesim connection, audit log, notifications, profile and security including passkeys),
then switching each resource to `api` mode as the backend delivers it.