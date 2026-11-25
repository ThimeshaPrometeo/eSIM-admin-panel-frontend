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
| `AppShell` | adapt `telephony/app-shell.tsx` | Rail + secondary column (lg+), glass top bar below lg, skip link, `<AmbientBackground>` behind content. No module accent colours (we have one accent) |
| `PrimaryRail` | adapt `telephony/primary-rail.tsx` | Sections with icons, group dividers, hover-to-preview a section, gliding active indicator, glass |
| `SecondaryColumn` | adapt `telephony/secondary-column.tsx` | Tabs of the active/hovered section |
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
| `RevenueProfitChart` | bar + glowing line | dashboard (profit_reports) |

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
