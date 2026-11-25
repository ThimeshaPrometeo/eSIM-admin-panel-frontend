# Frontend conventions

**Read this file first, every session.** It summarises the architecture and the rules of
[FRONTEND_BUILD_SPEC.md](../FRONTEND_BUILD_SPEC.md) (the source of truth) plus what Phase 0 found in the
backend docs. When the two disagree, the item is listed in [open-questions.md](open-questions.md) with the
assumption we build on until it is answered. Keep this file up to date when a rule changes.

Related docs: [routes.md](routes.md) · [components.md](components.md) · [demo-data.md](demo-data.md) ·
[demo-plan.md](demo-plan.md) · [open-questions.md](open-questions.md).

## 1. Sources

| What | Where |
|---|---|
| Frontend spec | `FRONTEND_BUILD_SPEC.md` |
| Backend API, permissions, billing, schema, decisions | Backend repo `docs/` (`endpoints.md`, `permissions.md`, `billing.md`, `schema-tenant.md`, `decisions.md`, `open-questions.md`). Not copied here (see Q-DOCS) |
| Real Yesim price list and zones (demo fixtures) | `docs/reference/PriceList.csv`, `docs/reference/location_zones_list.csv` |
| Previous SIP panel | `reference/sip-panel/` (git-ignored, read only). **Architecture, structure and interaction patterns only** (shell, navigation, tables, dialogs). Never its colours, fonts, surfaces or eyebrow labels. Never import from it; copy and adapt |
| Backend requests | [backend-backlog.md](backend-backlog.md): endpoints we need, faked in demo mode until they ship |

Backend decisions (`D<n>`) are cited by number. Business rules in them apply to the UI.

## 2. Stack

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/Radix primitives (copied into
  `components/ui`), lucide icons (stroke 1.5).
- Charts: Recharts (same library as the SIP panel's `dashboard-charts`).
- 3D and motion: `three`, `@react-three/fiber`, `@react-three/drei`, GLSL shaders, `gsap` (+ ScrollTrigger).
- Fonts: Geist Sans and Geist Mono from the `geist` npm package (served locally).
- Package manager: pnpm. Tests: Vitest + Testing Library.
- Dev server port 3000; backend port 4000.
- **Everything is bundled from npm or this repo** (§10). No CDN, hosted font, remote image or hosted scene.

## 3. Architecture rules

1. **Thin pages.** `app/**/page.tsx` is a server file that renders `<XxxClient />`. Workspace pages live in
   the route group `app/(workspace)/` whose `layout.tsx` wraps them in `<AppShell>` once (the shell stays
   mounted between pages, so the navigation indicator can glide). All interactivity lives in `*-client.tsx`.
   Large bodies go in `components/platform/*-view.tsx`, dialogs in `*-dialogs.tsx`.
2. **One context.** `PlatformProvider` / `usePlatform()` holds the signed-in user, role, effective
   permissions, theme, data mode, demo role switcher, unread notification count, wallet summary, `signIn`,
   `signOut`, `refresh`. No other global state store.
3. **One way to the server.** Every call goes through `lib/api/client.ts` (`apiFetch`, `apiFetchBlob`),
   `credentials: "include"`, to `/api/v1/*`. `proxy.ts` forwards `/api/*` to `BACKEND_URL` (server-only env)
   and forwards the `Origin` header. The frontend never talks to Yesim.
4. **One resource file per backend resource** in `lib/api/<resource>.ts`. It exports the same functions and
   types in both data modes; `NEXT_PUBLIC_DATA_MODE` (`demo` | `api`, default `demo`) only selects the
   implementation. **Pages never branch on the data mode.**
5. **Function names and parameters follow `endpoints.md`.** E.g. `listEsims(filters)`, `getEsim(id)`,
   `suspendEsim(id, { reason })`, `createEsimOrder(input, idempotencyKey)`, `addPlanToEsim(id, input, key)`.
6. **Components never see raw backend shapes.** `lib/api/*` maps responses into the domain types in
   `lib/platform/types.ts`. The backend JSON is already **camelCase** (backend CONVENTIONS), so mapping is
   mostly: money strings → `Money`, byte counts → `number` (bytes), ISO strings stay strings until formatted,
   derived UI states (see §7). Domain type names follow the backend schema (`Esim`, `EsimPackage`, `Order`,
   `Wallet`, `WalletHold`, `UsageCharge`, `ResellerProfile`, `Plan`, `ResellerPlan`, `Discount`, ...).
7. **Demo mode mimics the backend, including its errors.** Demo implementations return the same shapes and
   throw the same `ApiError` codes (`OUTSTANDING_BALANCE`, `ACTIVATION_REQUIRES_FUNDS`,
   `ZONE_HAS_UNPRICED_NETWORKS`, `END_OF_LIFE_FINAL`, 429 daily limit, ...) so error UI is built once.
8. **Loading and changing data.** Views load with `useResource(() => api.fn(args), [args])` (hooks/use-resource),
   which reloads when its inputs change or when `dataVersion` goes up, keeping the previous data while
   reloading. Mutations go through `useAction().run(() => api.fn(...), { success: "eSIM suspended" })`
   (toast with the button's verb, error in plain words, then `refresh()`). In demo mode every store write
   bumps `dataVersion`, so a change shows on every open view.
9. **The UI never recalculates prices the backend returns.** `lib/platform/pricing.ts` holds display helpers
   only. The demo store computes prices with the backend formula (§6) in `lib/demo/`, not in components.

## 4. Folders

```
app/                      one folder per URL (routes.md); workspace under app/esim/
components/ui/            shadcn/Radix primitives
components/platform/      app components (components.md)
  three/                  globe, shader background, scene helpers (client only, lazy-loaded)
  motion/                 reveal, count-up, cursor glow, fps meter
  charts/                 all charts
contexts/platform-context.tsx
lib/design/               theme colours for canvas/WebGL, motion tokens
lib/geo/                  bundled geometry (globe dots) and country helpers
scripts/                  build-time generators (globe dots, demo networks); output committed
public/                   static fallbacks (globe-fallback.svg); no remote assets
lib/api/                  client.ts, errors.ts, mode.ts, one file per resource (+ <resource>.demo.ts, <resource>.http.ts)
lib/demo/                 catalogue (CSV-derived networks and zones), model, seed, store (localStorage),
                          pricing (backend formula), derive (read models), session (caller, scope), run (latency)
lib/platform/             types, nav-config, permissions, status, period, units, money, dates, pricing
hooks/                    use-mobile, use-period, use-paginated, use-permission
styles/globals.css        design tokens
proxy.ts
```

- Files `kebab-case`; components `PascalCase`; hooks `use-*.ts` exporting `useXxx`.
- `lib/api/<resource>.ts` re-exports the mode-selected implementation; the two implementations live in
  `<resource>.demo.ts` and `<resource>.http.ts` and must satisfy the same TypeScript interface.
- Never import from `reference/`. Copy and adapt.

## 5. Permissions

- Levels `none < view < manage`; `manage` implies `view`.
- **Effective = tenant envelope ∩ role envelope ∩ grants** (D23). Admin and reseller grants are implicit
  `manage`; staff grants come from their staff role; an assistant's grant is
  `min(toggle, effective(their reseller))`.
- `lib/platform/permissions.ts` exports `can(user, module, level)` and `effectivePermissions(...)`. In API
  mode the effective permissions come from `GET /auth/me` / `GET /permissions/modules`; the frontend never
  computes them from stored data except in the demo store.
- **Display only.** The backend decides on every request. Never store permissions in localStorage (the demo
  store is the only exception).
- Two kinds of check, both through `<PermissionGate>` / `usePermission()`:
  - **module level**: `can(user, "esims", "manage")`;
  - **role rules** where the backend uses `@Roles(...)` on top of the module (e.g. markup change = admin
    only). These live in `lib/platform/permissions.ts` as named rules (`canChangeMarkup(user)`,
    `canResolveOrder(user)`, ...) so a page never checks `role === "admin"` inline.
- **Orders** follows the backend: visible with `sell_esim:view` **or** `transactions:view`; there is no
  `orders` toggle in the permission matrix (backlog BB-1).
- **Staff limits follow the backend's admin-only rules** (open-questions §2): plan edits, discounts, wallet
  adjustments, order resolve, 2FA reset, price sync, job runs and auto-suspend rules are admin only.
- Navigation: a tab shows if the user can `view` its module; a section with no visible tab is hidden. A direct
  URL without permission renders the access-denied page (`/forbidden` view inside the shell). Mutating buttons
  are hidden at `view` level.
- Data scope is the backend's job (out of scope = 404). The demo store applies the same scope.

## 6. Money, data, dates

- **Money:** EUR, held as a decimal string from the API, wrapped in a `Money` type. Never do arithmetic on
  money in components. Summaries 2 decimals; per-MB prices 4–6 significant digits.
- **Data:** bytes everywhere in types. Binary units: 1 MB = 1,048,576 bytes, 1 GB = 1024³. Unit select
  MB/GB/TB or auto.
- **Price formula** (demo store only): reseller €/MB on a network = Yesim €/MB × (1 + markup) × (1 − discount);
  the most specific discount wins (reseller + plan over reseller only). Blank Yesim price = network
  unavailable, never 0.
- **Rating** (spec 8.32, demo store: `lib/demo/rating.ts` only): every usage line is one plan, one day, one
  network, with the Yesim price of that day and the markup and discount **in force at the moment the data
  was used**. Markup, discount and retail markup changes apply **from the moment they're saved** (Q-EFFECTIVE),
  including plans already running; a day with a change is split at that moment (the demo spreads a day's
  data evenly over the day). Running holds are never resized. A plan's charge for a day is its lines summed
  and rounded to the cent once. Ledger, holds, statements, dashboard and profit are all built from these
  lines, so pages agree to the cent (pinned by tests).
- **Dates:** UTC ISO strings from the API; shown in the user's time zone (tenant default Asia/Colombo) with
  relative times where helpful. Formatting only through `lib/platform/dates.ts`.
- **Estimated** amounts always carry an "Estimated" chip until final (D82).

## 7. Status vocabulary (one place: `lib/platform/status.ts`)

Each status maps to a label, a chip tone (`positive` Emerald = active/success/final, `warning` = estimated/80%/low balance, `danger` = suspended/blocked/error, `neutral` = expired/ended/inactive/in stock, `info` Azure = installed/pending) and a sort order.

| Thing | Backend values | UI labels |
|---|---|---|
| eSIM | `ACTIVE`, `INACTIVE`, `DISCONNECTED`, `SUSPENDED` (+ `suspendedBy` reseller/admin/rule), `END_OF_LIFE`, `UNKNOWN` | Active, Inactive, Disconnected, Suspended by reseller / by admin / by rule, End of life, Unknown |
| Install | `not_installed`, `downloaded`, `installed`, `enabled`, `disabled`, `deleted`, `error`, `unknown` + `installStatusRaw` | Not installed, Downloaded, Installed, Enabled, Disabled, Deleted, Error; unknown shows the raw value as is |
| Plan on an eSIM (`planState`, approved mapping; backlog BB-2) | order `awaiting_funds` → awaiting funds · hold `waiting` + blocked → blocked no funds · hold `exhausted` → blocked hold used up · `adminBlocked` → blocked by admin · package `pending_activation` → pending first use · `active` → active · `expired`/`depleted` → expired · `deleted` or hold `settled` → ended | Awaiting funds, Blocked: no funds, Blocked: hold used up, Blocked by admin, Pending first use, Active, Expired, Ended |
| Order | `awaiting_funds`, `pending`, `completed`, `failed`, `needs_check`, `cancelled` | Awaiting funds, Pending, Completed, Failed, Being verified, Cancelled |
| Hold | `waiting`, `active`, `exhausted`, `ending`, `settled`, `released`, `cancelled` | Waiting, Active, Used up, Ending, Settled, Released, Cancelled |
| Usage charge | `accruing`, `rated`, `posted` | Estimated, Final, Final (posted) |
| Top-up request | `pending`, `approved`, `rejected`, `cancelled` | as is |
| Alert | `open`, `acknowledged`, `resolved` | as is |
| User | `active`, `disabled` (+ locked flag) | Active, Disabled, Locked |

## 8. Terminology (copy rules)

- "Top-up" = topping up a **wallet**. Putting a plan on an eSIM = **"Add plan"** (D26). Never mix them.
- "Being verified" in the UI = `needs_check` in the API.
- "Reseller" = our reseller. Yesim is "the supplier" in operational copy. Financial pages for admin and staff
  (price breakdown, simulator, charge breakdown, profit and costs, price history, reconciliation) and the
  Yesim connection page name Yesim, so the cost side reads plainly. Reseller-facing copy never names it.
- Sentence case everywhere; no all-caps labels, no eyebrow text.
- A button and its toast use the same verb: "Suspend eSIM" → "eSIM suspended".
- Errors say what happened and how to fix it. Map backend error codes to messages in `lib/api/errors.ts`.
- v1 is data only: no phone numbers, calls, SMS or VoIP anywhere.

## 9. Visual rules (details in spec §7)

**The approved `/design-system` page is the visual target for every page.** There are no external design
files. If a page needs something the design system doesn't have, add it there first.

### 9.1 Tokens and type

- **Dark first.** Dark is the primary design, light the secondary theme with the same accents.
- Colours only through the semantic tokens in `styles/globals.css` (`--bg`, `--surface-1..3`, `--glass`,
  `--border`, `--highlight`, `--text`, `--text-2`, `--text-3`, `--primary` Azure, `--primary-glow`,
  `--accent` Emerald, `--accent-glow`, `--warning`, `--danger`, `--neutral`). No hex values in components;
  3D code reads the same tokens through `lib/design/theme-colors.ts`.
- **Azure = action** (buttons, links, focus, active nav, main chart series). **Emerald = alive / healthy /
  positive** (live, active, success, second series). Warning and danger only for status. The Azure → Emerald
  gradient (135°) is used sparingly (hero accents, active chart lines, eSIM card edge, rings).
- **Buttons** (approved spec, Phase 1 review): styles live in `globals.css` (`.btn`, `.btn-primary`,
  `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-destructive`, `.btn-link`; sizes 36 / 44 / 52).
  Primary is the Azure gradient `#1A8FFF → #0070E6` in both themes; secondary is glass with a 10% border
  rising to 18% on hover; destructive only for destructive actions. Never restyle a button inline; add a
  variant in `globals.css`. Known: white on the gradient's top is 3.3:1 (bottom 4.7:1), see the review notes.
- Two documented colour exceptions: the eSIM card is always dark glass (`data-theme="dark"`, also on light
  pages), and its QR code is fixed black on white so it scans.
- Themes are set by `data-theme="dark|light"` on `<html>` **or any element** (tokens are scoped to the
  attribute, so the design-system page can show both themes side by side).
- Geist Sans for UI, **Geist Mono** for ICCIDs, IDs, codes and tabular data. Scale: display 40/44, page
  title 28/34 semibold −0.02em, section 18/26 semibold, body 14/22, small 12/18. Tabular figures for aligned
  numbers. No all-caps labels, no eyebrow text.

### 9.2 Surfaces

- Ambient light: 2–3 soft, slowly drifting radial lights (Azure top-left, Emerald bottom-right) in **CSS**
  behind ordinary pages (`<AmbientBackground>`).
- Glass cards: `--glass` fill, 20px backdrop blur, 1px `--border`, 1px top `--highlight`, radius 16; hover
  glow only on interactive cards (`.glass-card`, `<GlassCard interactive>`).
- Radii: shell 24, card 16, input/button 12, chips full. 32px gaps between major blocks on desktop; card
  padding 24 (16 on mobile).
- Depth in dark comes from light and glow, never heavy drop shadows; light mode uses very soft cool shadows.
- Loading = skeletons in `--surface-2` with a slow shimmer; no centred spinners. Empty states = small glowing
  line illustration + one action.

### 9.2a One screen on desktop

- **Desktop pages fit the screen (product decision, 2026-11-20/23).** From 1024 × 640 the page itself never
  scrolls: wrap a page in `<FitPage>` (components/platform/fit-page); its main list (`DataTable`) fills the
  space and scrolls inside its card with a sticky header; pages with several sections put the part below
  their header in `<FitScroll>`. Dashboard, Coverage and eSIM detail have their own one-screen layouts
  (charts grid, list | globe | country, eSIM | tabs). Phones, tablets and short screens scroll as usual.
- Check with the scroll test in the phase review (document height = window height on every page).

### 9.3 Motion (`components/platform/motion/`, `lib/design/motion.ts`)

- Easing tokens: `--ease-out-expo` = `cubic-bezier(0.22, 1, 0.36, 1)` for entrances,
  `--ease-in-out` = `cubic-bezier(0.65, 0, 0.35, 1)` for movement. Durations 400–700 ms for layout and reveals,
  150–200 ms for hovers. **No springs, no overshoot.**
- Helpers, never ad-hoc animation code in pages:
  - `<Reveal>` / `<RevealGroup>`: fade + rise 12–16px with a short stagger, once per page view
    (IntersectionObserver);
  - `<CountUp>`: once, dashboard numbers;
  - `useCursorGlow()`: the light that follows the cursor across primary buttons and interactive cards;
  - `useLerpedPointer()`: mouse-reactive elements move with inertia, never 1:1;
  - `useReducedMotion()`: every helper checks it.
- Buttons press to 0.98 with an inner glow; toggles slide with weight; the active-nav indicator glides;
  dialogs and drawers open with a blur-in backdrop.
- `prefers-reduced-motion`: no 3D animation (static frame), no shader animation, no reveals, instant state
  changes.

### 9.4 3D and shaders (`components/platform/three/`)

- **Client only, lazy-loaded:** every 3D component is imported with `next/dynamic` + `ssr: false` through a
  wrapper in `components/platform/three/lazy.tsx`. Pages import only the wrapper. **No `three` import outside
  `components/platform/three/`.**
- Globe geometry is a bundled land/country mask (`lib/geo/globe-mask.json`, 18 KB gzipped), generated by
  `scripts/build-globe.ts` from world geometry in npm packages; the globe places its dots in latitude rows at
  run time. Never fetched at run time from another origin.
- WebGL rules: device pixel ratio capped at **1.5**; render loop pauses when the canvas is off screen or the
  tab is hidden (`useCanvasVisibility`); `frameloop="demand"` when idle (no pointer, no animation);
  low-resolution render target for the shader background.
- Fallbacks: WebGL unavailable or low-power device (`useWebGLSupport`) or reduced motion → a static
  pre-rendered globe image (`public/globe-fallback-dark.svg` / `-light.svg`) and a CSS gradient instead of the shader.
- **Tables, forms and lists never sit on top of animated WebGL.** The sign-in page uses a CSS backdrop
  (layered light, film grain, vignette) behind its form; the fluid shader is only behind the dashboard header;
  the globe only on sign-in, coverage and the dashboard header.
- The sign-in page is `components/platform/sign-in-view.tsx`; Phase 2 wires the flow into it. It follows
  the app theme (dark first, light variant) with its own palette: the `--si-*` tokens in `globals.css`
  (signature gradient electric blue → signal teal on the second headline line, the main button and the
  globe's edge glow; `--si-gradient-ink` is the darker text version for light) and the `.si-*` classes. All
  copy is in `SIGN_IN_COPY`. The full-width gradient button is allowed on this page only.
- **No claims we can't back with data.** Never show certifications, uptime, carrier counts or activity
  numbers that aren't true or don't come from our data. The country count is computed from the networks
  (`countryCount()`: countries with at least one priced network); globe events come from the data layer
  (demo events in demo mode); "All systems operational" shows only when the health check says so.
- **No company name in the UI.** The logo mark only, until tenant settings (white-label) supply the
  brand name and logo.
- WebGL reads colours through `themeTokens()`, which lets the browser convert any CSS colour (oklch, lab,
  …) to RGB; never parse colour strings by hand for three.js.

### 9.5 Performance budget (must hold)

- 60 fps on a mid-range laptop; 3D never blocks input.
- No `three`/R3F/drei in the bundle of any page that doesn't show 3D (checked at each phase review by
  comparing a page's JS with and without its 3D sections).
- Measure with the `<FpsMeter>` on `/design-system` (development only).

## 10. Security

- **No external URLs (spec §7.10).** The running app loads nothing from outside its origin: no CDN, hosted
  font, remote image, hosted 3D scene or analytics. `next.config.ts` sends a Content-Security-Policy with
  `default-src 'self'` plus only what Next.js needs (`'unsafe-inline'` styles and scripts; `'unsafe-eval'`
  and `ws:` in development only; `blob:`/`data:` for images and workers). A new dependency that fetches from
  the network at run time is not allowed.
- Auth is the backend's httpOnly cookie. Never put tokens in localStorage/sessionStorage.
- `apiFetch`: 401 → sign out and redirect to `/` with `?next=`; 403 → access-denied view; other errors →
  `ApiError { status, code, message, details }` from `{ error: { code, message, details } }`.
- No secrets in `NEXT_PUBLIC_*`. `BACKEND_URL` is server-only.
- Mutations with money or a supplier call send an `Idempotency-Key` generated per attempt and reused on
  retry; the confirm button is disabled while sending.

## 11. Workflow

- Phases per spec §16; each ends with a review checkpoint (summary, assumptions, screenshots as below).
- **Screenshots: as few as possible** (rule from 2026-11-25; they are expensive to review).
  - While developing, never screenshot. Verify with typecheck, lint, tests and DOM/text checks (text
    content, element sizes, overflow, console errors).
  - At the end of a task, at most **one screenshot per changed page: dark theme, desktop 1440 × 900**.
  - Light theme, mobile, other sizes or sets of screenshots only when the product owner asks.
- New open questions go in [open-questions.md](open-questions.md) with the assumption used.
- Committed files and commit messages talk only about the project, never about the tools used to write it.
- **Never run `git commit` or `git push`** (rule from 2026-11-23). All changes stay uncommitted; the product
  owner reviews and commits them. At the end of each phase, list the changed files (`git status --short`)
  and a suggested commit message in project-only wording (no tool names).
- Tests (Vitest) for everything in `lib/platform/*`, the demo pricing formula, permission-matrix rules,
  sell-flow outcomes and the route guard.
