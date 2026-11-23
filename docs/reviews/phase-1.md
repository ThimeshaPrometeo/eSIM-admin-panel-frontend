# Phase 1 review: design system

Date: 2026-11-20. Status: **waiting for approval.** Once approved, `/design-system` is the visual target for
every page (CONVENTIONS §9).

Screenshots, the screen recording and the raw measurements are in `review-artifacts/phase-1/` (not
committed). They are regenerated from a production build (`DESIGN_SYSTEM_PAGE=1 pnpm build`, then
`next start`).

## What was built

| Area | Where |
|---|---|
| Tokens: dark (primary) and light, scoped by `data-theme` so both can show side by side; type scale; radii; glass; ambient light; motion easing | `styles/globals.css` |
| Geist Sans and Geist Mono from the `geist` package (served locally) | `app/layout.tsx` |
| shadcn primitives restyled: button (cursor glow, press 0.98), input, textarea, select, switch (weighted), checkbox, dialog (blur-in), dropdown, tooltip, tabs (gliding indicator), table (sticky glass header), skeleton (slow shimmer), toasts | `components/ui/` |
| Building blocks: glass card, section card, page header, stat block, empty state with line illustrations, status chips, estimated chip, network badges, mono value with copy, usage ring and bar, confirm dialog (type-to-confirm, reason), reason dialog, ambient background | `components/platform/` |
| Status vocabulary (one place) + tests | `lib/platform/status.ts` |
| Permission matrix (rules + tests + component) | `lib/platform/permission-matrix.ts`, `components/platform/permission-matrix.tsx` |
| Charts: daily usage (estimated tail dashed), monthly, status donut, plans sold, transactions, top 10 eSIMs (clickable), usage by country, revenue and profit | `components/platform/charts/` |
| eSIM card with CSS 3D tilt and moving highlight | `components/platform/esim-card.tsx` |
| 3D globe (hero, interactive, compact modes), fluid shader background, lazy wrappers, static fallbacks | `components/platform/three/` |
| Globe geometry generated from npm world data, bundled; static fallback SVGs | `scripts/build-globe-dots.ts`, `lib/geo/`, `public/globe-fallback-*.svg` |
| Motion helpers: Reveal, CountUp, useCursorGlow, useLerpedPointer, useReducedMotion, FpsMeter | `components/platform/motion/` |
| CSP `default-src 'self'` and other security headers | `next.config.ts` |
| `/design-system` page (development only; dark and light side by side; frame-rate meter; `?static=1` shows the fallbacks) | `app/design-system/` |

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (17 tests) and `pnpm build` pass. Running the page loads
nothing from outside its origin (checked in the browser: no external requests, no console errors).

## Measurements

Production build, Chrome on an Apple M3 (Metal GPU), 1600 × 1000.

**Frame rate** (rolling 2 s average and worst 1% low, pointer moving): 60 fps / 60 in every section,
including the sign-in hero (2 globes + 2 shaders on screen), the dashboard header and the interactive globe.
Off-screen canvases stop rendering (`frameloop: never`). An M3 is faster than the spec's "mid-range laptop";
the budget should be re-checked on a mid-range Windows laptop before the demo.

**Bundles** (JavaScript, gzip transfer / raw):

| Page | JS | WebGL code |
|---|---|---|
| `/` (no 3D) | 181 KB / 594 KB | none |
| `/design-system?static=1` (fallbacks) | 369 KB / 1,244 KB | none |
| `/design-system` with live 3D | 709 KB / 2,413 KB | yes |
| Loaded only for live 3D (3 chunks) | **340 KB / 1,169 KB** | three.js 238 KB, R3F + drei + gsap + globe data 100 KB |

The 3D code is loaded only when a page shows live graphics and the device can run them; the fallback path
never downloads it.

## Assumptions and decisions to confirm

1. **Filled buttons use a slightly deeper Azure** (`#0070F0` dark, `#0059C7` light) because white on
   `#0080FF` fails WCAG AA (3.8:1). Azure stays for links, focus, glows and charts.
2. **The eSIM card is always dark glass**, also on light pages; its QR is black on white so it scans.
3. **Lit countries are a calm Emerald**: with 173 of ~235 countries covered, the full Emerald glow made the
   globe one bright mass. Hover and selection use Azure.
4. **Low-power rule** for the static fallback: no WebGL, a software renderer, ≤ 2 CPU cores or ≤ 2 GB memory,
   or data saver on.
5. **Idle rendering**: the interactive and compact globes drop to on-demand rendering after 12 s without
   pointer activity; the sign-in hero keeps turning.
6. Scroll reveals use IntersectionObserver; GSAP is used for the globe's rotate-to-country movement
   (spec allows either).
7. The design-system page shows the 3D sections in both themes at once (up to 4 WebGL canvases on screen);
   real pages show at most one globe and one shader.

## Known limits

- Toasts follow the page theme, not the pane they were triggered from (dialogs, menus and tooltips do follow
  their pane).
- React Three Fiber logs a `THREE.Clock` deprecation warning from inside the library (not our code).
- Two price-list rows are "Satellite Networks" with no country (handled in the Phase 2 demo data).
