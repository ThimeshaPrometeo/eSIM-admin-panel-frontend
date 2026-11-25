# Components

What each component is, where it lives, and whether its **structure** comes from the SIP panel
(`reference/sip-panel/`) or is new. The SIP panel gives architecture and interaction patterns only; every
visual follows spec §7 and the approved `/design-system` page.

Legend: **adapt** = copy the structure/behaviour from the named SIP file, restyle completely; **new** = built
for this product; **shadcn** = generated primitive restyled to our tokens.

## 1. Primitives (`components/ui/`)

shadcn (new-york, as in the SIP panel's `components.json`), restyled: glass surfaces, thin borders, 12px
radius, Azure focus ring with a soft glow, press-to-0.98.

button (variants: primary with cursor glow, secondary glass, ghost, outline, destructive, link), input,
textarea, select, command/combobox, checkbox, switch (weighted slide), radio-group, label, dialog,
alert-dialog, sheet, dropdown-menu, popover, tooltip, tabs (gliding indicator), table, badge, separator,
skeleton (slow shimmer), scroll-area, calendar, sonner toasts (glass), avatar, collapsible, progress,
input-otp.

## 2. Shell and navigation (`components/platform/`) — Phase 2

| Component | Source | Notes |
|---|---|---|
| `AppShell` | adapt `telephony/app-shell.tsx` | Rail + secondary column (lg+), glass top bar with a "Section / Page" breadcrumb (`nav[aria-label=Breadcrumb]`), skip link, `<AmbientBackground>` behind content; content up to 1600px wide. The column exists only for sections with more than one tab; it collapses with its button or "[" (not while typing), remembered per user in this browser (`lib/platform/nav-layout.ts`), collapsed by default below 1440px. Its width animates over 300ms (weighted ease); meanwhile `<html data-nav-resizing>` tells charts to hold their size, and `nav:resized` makes them measure once at the end. No module accent colours (we have one accent)
| `PrimaryRail` | adapt `telephony/primary-rail.tsx` | Sections with icons, gliding active indicator, glass. Single-tab sections: the icon goes straight to the page. Multi-tab sections with the column open: the icon goes to the first tab and hovering previews the tabs in the column. Otherwise (column collapsed, or a page without one): hovering (140ms delay, closes 220ms after leaving) or clicking opens the tabs in a floating glass panel; Enter/Space/→ open it with focus on the first link, ↑/↓/Home/End move, Escape closes and returns focus, choosing a page closes it. An expand button appears under the icons while the column is collapsed |
| `SecondaryColumn` | adapt `telephony/secondary-column.tsx` | Tabs of the active/hovered section, with a collapse button at the top; inert while collapsed |
| `ChartBox` | `charts/chart-box.tsx` | Sizes a Recharts chart to its box (replaces `ResponsiveContainer`); holds its size while the section column animates and re-measures once when it ends |
| `MobileBottomNav`, `MobileSecondaryNav` | adapt `telephony/mobile-bottom-nav.tsx`, `mobile-secondary-nav.tsx` | Same breakpoints and clearance variable as the SIP panel |
| `UserMenu` | adapt `telephony/user-menu.tsx` | + role switcher and "Reset demo data" (demo) |
| `NotificationBell` | adapt `telephony/notification-bell.tsx` | |
| `ThemeToggle` | adapt `telephony/theme-toggle.tsx` | Dark default |
| `DemoBadge` | new | |
| `RouteGuard`, `PermissionGate` | new (SIP checks permissions inline) | |
| `AccessDenied`, `NotFound`, `ErrorState` | new | Glowing line illustrations |

## 3. Building blocks (Phase 1)

| Component | Source | Notes |
|---|---|---|
| `PageHeader` | adapt `telephony/primitives.tsx` | Title + description + actions (actions stack under the title on phones, as in the SIP panel). **No eyebrow** |
| `GlassCard` / `SectionCard` | new | `interactive` adds hover/focus glow |
| `StatBlock` | adapt `primitives.tsx` (`StatBlock` + `CountUp`) | Large number (display 40/44 on dashboard), quiet label, optional delta in Emerald/danger |
| `EmptyState` | adapt `primitives.tsx` | Glowing line illustrations (SIM card, globe, signal) |
| `StatusChip` | adapt `telephony/status-pill.tsx` | Small glowing dot + label; tone from `lib/platform/status.ts` |
| `EstimatedChip` | new | Warning tone |
| `NetworkBadges` | new | 4G / 5G / VoLTE |
| `Money`, `DataAmount`, `DateTime`, `CopyValue`, `MonoValue` | new | Geist Mono for IDs/codes; copy button |
| `DataTable` | adapt the table pattern of `telephony/resellers-view.tsx` / `wallet-ledger-table.tsx` | Sticky glass header, `--surface-3` row hover, pagination, sorting, column visibility, skeleton rows, empty/error. Full generic version in Phase 2; Phase 1 shows the styling |
| `PeriodSelect`, `UnitSelect` | adapt `telephony/period-select.tsx`, `pill-select.tsx` | Phase 2 logic, Phase 1 styling |
| `ConfirmDialog` | adapt the dialog structure of `telephony/account-dialogs.tsx` | Optional **type-to-confirm** |
| `ReasonDialog` | new | Required reason |
| `UsageRing`, `UsageBar` | new | Azure → Emerald gradient below 80%, warning 80–99%, danger at 100% |
| `PermissionMatrix` | new | Sections → tabs; View/Manage switches; section toggle; manage ⇒ view, view off ⇒ manage off; outside envelope = disabled with reason. Rules in `lib/platform/permission-matrix.ts` (tested) |

## 4. Signature and live graphics

| Component | Where | Notes |
|---|---|---|
| `EsimCard` | `components/platform/esim-card.tsx` | SIM shape (cut corner), fine-line chip contour, dark glass, Azure → Emerald edge light, QR (`qrcode.react`, local), ICCID in Geist Mono, plan name, `UsageRing`. **CSS 3D tilt** toward the cursor with lerped inertia and a moving specular highlight. No WebGL. Static under reduced motion |
| `Globe` | `three/globe.tsx` (lazy via `three/lazy.tsx`) | Land dots in latitude rows from `lib/geo/globe-mask.json` (soft Emerald, additive glow in dark; darker Emerald on frosted glass in light), dark glass ocean with a thin fresnel edge, wide soft Azure halo, surface-hugging Azure → Emerald arcs with travelling pulses and landing ripples, all fading at the limb. Modes: `hero` (slow rotation, weighted tilt toward the mouse), `interactive` (drag, zoom, hover highlight, click to select, `focusCountry` rotates to it), `compact` (dashboard header, quieter, live arcs) |
| `ShaderBackground` | `three/shader-background.tsx` (lazy) | Full-bleed fragment shader: slow domain-warped noise in Azure/Emerald on Midnight Ink, gently follows the lerped pointer. Rendered at 0.35–0.5 scale, DPR ≤ 1.5. Sign-in and dashboard header only |
| `GlobeFallback` | `three/lazy.tsx` | `public/globe-fallback-dark.svg` / `-light.svg` (pre-rendered by `scripts/build-globe.ts`) |
| `SignInView` | `components/platform/sign-in-view.tsx` | Approved sign-in layout: brand, headline, stats chips, glass card; globe as a horizon; CSS backdrop with grain and vignette |
| `CardTurn` | `components/platform/card-turn.tsx` | One card, several faces: 3D turn around Y (650 ms, `cubic-bezier(0.65,0,0.35,1)`), lighter turn for recovery ⇄ app, 150 ms crossfade with reduced motion; height follows the faces; blur swapped for a fill mid-turn; hidden face inert; focus and aria-live on settle; fade-out exit |
| `OtpInput` | `components/platform/otp-input.tsx` | Six single-digit boxes: auto-advance, Backspace to the previous box, paste or autofill fills all six, `onComplete` on the sixth digit |
| `AmbientBackground` | `components/platform/ambient-background.tsx` | CSS-only drifting radial lights; every ordinary page |

Shared 3D helpers in `three/`: `use-canvas-visibility.ts` (IntersectionObserver + `visibilitychange` →
pause), `use-webgl-support.ts`, `scene-canvas.tsx` (Canvas with DPR cap, demand frameloop, reduced-motion
static mode), `theme-colors.ts` (reads tokens).

## 5. Motion (`components/platform/motion/`)

| Helper | Notes |
|---|---|
| `Reveal`, `RevealGroup` | Fade + rise 14px, stagger 60 ms, once, IntersectionObserver; GSAP ScrollTrigger only where a page needs scroll-linked motion |
| `CountUp` | rAF, 900 ms, `--ease-out-expo`, once per mount, tabular figures |
| `useCursorGlow` | Sets `--glow-x/--glow-y` on the element for the radial light on primary buttons and interactive cards |
| `useLerpedPointer` | Pointer position smoothed with a lerp factor; shared by the eSIM card tilt, globe tilt and shader |
| `useReducedMotion` | Media query hook |
| `FpsMeter` | Development only; rolling average and 1% low |

## 6. Charts (`components/platform/charts/`)

Recharts. One `ChartFrame` (title, legend, loading/empty) and one `GlassTooltip` (value first). Azure main
series with a glow filter and soft gradient fill; Emerald second series and positive values; faint grid;
rounded bar ends; draw-in once. Colours from tokens. Structure adapted from `telephony/dashboard-charts.tsx`.

| Chart | Type | Used on |
|---|---|---|
| `UsageAreaChart` | area (estimated part dashed) | dashboard, eSIM detail, usage, reseller overview |
| `MonthlyBarChart` | bar | dashboard |
| `StatusDonut` | donut | dashboard |
| `PlansSoldChart` | bar | dashboard |
| `TransactionsChart` | grouped bar (credits Emerald vs debits Azure) | dashboard |
| `TopEsimsBar` | horizontal bar, clickable | dashboard |
| `CountryBar` | bar | dashboard, usage |
| `RevenueProfitChart` | bar + glowing line | Profit and costs |
| `TrendChart` | bars on one axis: one measure (data used, spend) or two stacked parts that add up to a whole (Yesim cost + profit = revenue, legend under the chart); optional measure `switcher` in the header (Revenue \| Data); dashed daily-average line and an "avg … · best …" subtitle (final days only); estimated days faded with a "What's estimated?" explanation (`ESTIMATE_EXPLAINED`); when an estimated bar is over 1.3× the tallest final day the scale is capped there and the clipped bar shows "↑€4.5k" on top (of neighbouring clipped bars only the tallest, so labels never overlap); charts with the same `syncId` hover together; bars animate only on first draw; click a bar → that day | dashboard |
| `LiveGlobeCard` | `LiveGlobe` (interactive + `live`: keeps drawing and spinning while on screen, the spin resumes ~3.5 s after a drag unless a country is in focus) with zoom buttons (+, −, reset view; `zoomRequest`) besides scroll and pinch, countries glowing by the chosen measure (`weights`), arcs from home to the latest activity and "Updated … ago". Clicking a country with usage focuses the whole dashboard on it (country filter): the globe turns to it and a spotlight strip replaces the feed with its figures, "Usage" and "Show all countries"; "Top countries" becomes "Networks in …" (selecting a network narrows further). The dashboard polls every minute quietly (`useResource` `pollMs`, unchanged parts keep their identity) and keeps the previous figures, dimmed, while a filter change loads (`keepPrevious`) | dashboard |
| `DonutCard` | donut (top 5 + Other, total in the centre) over a two-column legend with shares; optional measure switch in the header (`action`); colours follow the entity via `colorMap` on the `--series-1…6` tokens (validated with the dataviz script, both themes), fixed by the period's main measure so switching measure doesn't repaint; hover highlights | dashboard (Plan mix) |
| `SupplyTile` | one KPI tile with two lines: Yesim balance runway and Free eSIMs days of stock, each amber/red below the Settings thresholds | dashboard |
| `NetworksRankCard` | ranked networks (top 8, two columns, country-code chip) with a Data \| Cost \| Profit switch; each row and "+N more networks" open Usage filtered by network | dashboard |

Dashboard pieces (`components/platform/overview-view.tsx`): `OverviewFilterBar` (period presets, time zone, compare toggle,
Filters popover with reseller / country / network / plan; Clear), slim `KpiTile` (label + trend, value + note, status
colour from Settings for the runway tiles), `TopCountriesCard` (ranked with bars; selecting one turns the globe to it),
`TabbedCard` (Needs attention | Plans | Resellers, or Customers for resellers) with `AttentionList` and `MiniTable`.
Layout: 7 KPIs (resellers 6), then [Live globe | Data used | Money], then [Networks · data | Networks · cost | Top countries | tabs].

## 7. Domain components (built with their pages)

`QrCard`, `InstallDetails`, `PinPukReveal`, `EsimPlansTable`, `ActivityTimeline`, `PriceRange`, `HoldPreview`,
`PlanCard`, `CountryFilterList`, `CoveragePanel`, `WalletSummary` (adapt `telephony/wallet-balance.tsx`),
`FundingQueue`, `HowBillingWorks`, `SellStepper`, `SellResult`.

## 8. Dialog files

| File | Dialogs | Source |
|---|---|---|
| `esim-dialogs.tsx` | Suspend, Reactivate, Extend expiry, Add data, Block/Unblock plan, Set end of life (type ICCID), Delete plan, Remove all plans, Assign customer | new, structure of `account-dialogs.tsx` |
| `reseller-dialogs.tsx` | Create reseller, Edit, Suspend/reactivate, Change markup, Top up wallet | adapt `telephony/reseller-dialogs.tsx`, `top-up-dialog.tsx` |
| `assistant-dialogs.tsx` | Create, Edit, Disable, Emergency disable (admin, reason) | new |
| `plan-dialogs.tsx` | Create/edit plan, Activate/deactivate | new |
| `wallet-dialogs.tsx` | Request top-up, Cancel request, Approve, Reject, Manual adjustment | adapt `top-up-dialog.tsx` |
| `discount-dialogs.tsx`, `customer-dialogs.tsx` | Create/edit | new |
