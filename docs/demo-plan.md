# Demo plan (one week, two developers)

Goal: a client demo on demo data (spec §15), built so each page later switches to the real backend without
redesign. Two developers work in parallel on **separate files**; shared files have one owner (below) to
avoid merge conflicts.

- **Dev A, platform:** data layer, demo store, permissions, shell, sign-in, money and wallet flows.
- **Dev B, visuals:** tokens, components, charts, motion, 3D (globe, shader, eSIM card), catalogue and eSIM
  pages.

Review checkpoints (spec §16) are marked ⏸. Each needs dark + light, desktop + mobile screenshots; Phase 1
also needs a short screen recording of the live graphics, the measured frame rate and the bundle size with and
without the 3D code. A checkpoint not approved the same day blocks only the work that depends on it.

The **approved `/design-system` page is the visual target** for every later page: pages compose its
components; anything new is added there first.

## Day 0: Phase 0 (done, approved 2026-11-20)

## Day 1: Phase 1 (design system), part 1

| Dev A | Dev B |
|---|---|
| Project setup: Next 16, TS strict, Tailwind v4, shadcn, Vitest, ESLint, `geist` fonts, CSP headers in `next.config.ts` (no external URLs) — first 2 h, then hands `styles/` to Dev B | `styles/globals.css`: dark + light tokens scoped by `data-theme`, type scale, radii, glass, ambient light, motion easing tokens |
| `lib/platform/permission-matrix.ts` (rules) + tests; `PermissionMatrix` component | shadcn primitives restyled (glass, focus glow, press, cursor glow); `GlassCard`, `PageHeader`, `StatBlock`, `StatusChip`, `EmptyState`, skeletons, toasts |
| `scripts/build-globe.ts` → `lib/geo/globe-mask.json` + `public/globe-fallback-*.svg` | Motion helpers: `Reveal`, `CountUp`, `useCursorGlow`, `useLerpedPointer`, `useReducedMotion`, `FpsMeter` |
| `three/` helpers: `scene-canvas` (DPR cap, demand frameloop, pause off screen), `use-webgl-support`, lazy wrappers | Charts: `ChartFrame`, `GlassTooltip`, all chart types on sample data |

## Day 2: Phase 1, part 2 ⏸

| Dev A | Dev B |
|---|---|
| `Globe` (dots, lit countries, arcs, rim glow; hero / interactive / compact modes; fallback) | `EsimCard` with CSS 3D tilt + specular highlight, `UsageRing`/`UsageBar` |
| `ShaderBackground` (low-res render target, pointer-reactive, static under reduced motion) | `/design-system` page: every token, type, component state, chart, card, globe, shader, dialogs, toasts; dark and light side by side; FPS meter |
| Frame-rate and bundle measurement script | **⏸ Phase 1 review** (screenshots, recording, fps, bundle sizes) |

## Day 3: Phase 2 (shell, demo foundation, sign-in) ⏸

| Dev A | Dev B |
|---|---|
| `lib/platform/` (types, units, money, dates, period, status, permissions, nav-config) + tests; `lib/api/client.ts`, `errors.ts`, `proxy.ts` | `AppShell`, rail, secondary column, mobile navs, user menu (role switcher, reset demo data), Demo badge, `AccessDenied`, `ComingSoon` |
| `lib/demo/` store, PRNG, persistence, reset; seed catalogue (networks, demo zones, plans, prices) and people | Sign in (globe hero on the shader background), 2FA step, forced password change, 2FA set-up prompt |
| `PlatformProvider`, `RouteGuard`; resource interfaces for auth, me, permissions | **⏸ Phase 2 review** (end of day) |

## Day 4: Phase 3 (demo pages, part 1)

| Dev A | Dev B |
|---|---|
| Seed: eSIMs, packages, orders, usage (90 days), dashboard aggregates | **Dashboard** (compact globe + shader header, count-up stats, all charts, period/unit/reseller filters) |
| **Resellers** list + detail (tabs, markup change, wallet top-up), **Discounts** (live preview) | **Coverage** (interactive globe ↔ country list, networks, prices) and **Price list** (exports) |
| **Assistants / Team** with the permission matrix; switching role shows the effect | **Plans** (form with live hold, spread warning, unpriced zones) and **My plans** |
| | **⏸ Phase 3 review** (end of day) |

## Day 5: Phase 4 (demo pages, part 2)

| Dev A | Dev B |
|---|---|
| Seed: wallets, holds, ledger, top-up requests, receipts (invariant tests) | **eSIM list** (filters, CSV export) |
| **Wallet** (reseller), **Wallets** (admin) + detail, **Transactions**, **Top-up requests** (request → approve, funding queue) | **eSIM detail** (eSIM card with tilt, install details, PIN/PUK, plans, usage chart, timeline, actions + dialogs) |

## Day 6: sell flow + demo script

| Dev A | Dev B |
|---|---|
| Sell / Add plan store logic: holds, awaiting funds, blocked, outstanding refusal, daily limit, being verified, failed; idempotency key; tests | Sell / Add plan UI: stepper, plan cards, customer picker, activation, confirm states, result (eSIM card reveal) |
| Order detail (target of "Being verified"), notifications bell and list | `docs/demo-script.md`; responsive and reduced-motion pass on every demo page; perf check (fps, bundles) |

## Day 7: rehearsal and polish ⏸

- Full rehearsal of `docs/demo-script.md`, dark and light, desktop and a phone, plus once with reduced motion
  and once with WebGL disabled (fallbacks).
- Fix list; empty, error and loading states on every demo page.
- **⏸ Phase 4 review**, then the client demo.

## Ownership of shared files

| File / folder | Owner |
|---|---|
| `styles/globals.css`, `components/ui/*`, `components/platform/charts/*`, `components/platform/motion/*`, `esim-card.tsx` | Dev B |
| `components/platform/three/*`, `lib/geo/*`, `scripts/*` | Dev A |
| `lib/api/*`, `lib/demo/store.ts`, `lib/platform/*`, `contexts/*`, `proxy.ts`, `next.config.ts` | Dev A |
| `lib/demo/seed/<area>.ts` | whoever seeds that area |
| `app/design-system/*` | Dev B (Dev A adds the 3D sections) |
| Page folders | whoever builds the page (tables above) |

## Risks

| Risk | Mitigation |
|---|---|
| 3D work (globe, shader) overruns | Fallbacks (static globe SVG, CSS gradient) are built first, so a page always has a finished look; 3D polish can continue on Day 6 |
| Frame rate on weaker laptops | DPR cap, low-res shader target, demand rendering, pause off screen; measured at every review |
| Design-system review takes more than a day | Dev A's platform work (Day 3 left column) can start early; pages wait |
| Demo store money logic (holds, funding queue) | Tests first on Day 5; the sell flow on Day 6 reuses it |
| Week is tight for 11 page groups | Order follows spec §15; anything unfinished stays "Coming soon" in the nav rather than half-built |
