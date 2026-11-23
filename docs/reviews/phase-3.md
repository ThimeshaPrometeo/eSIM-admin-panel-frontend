# Phase 3: demo pages, part 1

Screenshots (dark; dashboard also light): `review-artifacts/phase-3/` (git-ignored).

## Built (spec §15 items 4–8)

- **Dashboard**: fits one screen on desktop (≥ 1280 × 640): header with greeting, stats and a compact globe
  with arcs from Colombo to this week's usage countries over the shader; a 4 × 2 grid of charts (usage with a
  By period / Monthly switch, eSIM status, plans sold, top 10 eSIMs, usage by country, transactions with a
  Revenue and profit switch for `profit_reports`). Period, grouping, unit and (admin/staff) reseller filters.
  Phones and narrower screens: stacked and scrolling. Estimated usage is dashed.
- **Coverage**: one screen on desktop: filterable country list | interactive globe | selected country
  (networks with 4G/5G/VoLTE and price per GB, "Unavailable" for unpriced networks, plans that work there,
  zones incl. demo zones). Phones: list, then a detail screen.
- **Price list**: per network, the viewer's price per MB and GB; admins and staff see supplier cost, retail,
  and any reseller's prices. Filters, last sync, Sync now (admin), Excel and PDF (watermark "Downloaded by …",
  downloads audit-logged).
- **Plans** (admin edits, staff read-only) with a live hold, spread warning, zones with unpriced networks
  listed but blocked, hold override; **plan detail** with zone networks, supplier cost and example reseller
  prices.
- **My plans** (resellers): own name and informational selling price on an active plan; cost range and hold.
- **Resellers**: list (markup for admin; staff read-only), create (first user must change the password at
  first sign-in), detail with Overview, eSIMs, Customers, Wallet and ledger, Discounts, Assistants, Documents
  (watermarked PDFs) and Audit trail; change markup (admin, reason, audit), top up / debit the wallet
  (admin; pays the outstanding amount, then funds waiting plans), suspend/reactivate (reason).
- **Discounts** (admin) with a live before/after price preview; the plan-specific discount wins.
- **Assistants / Team**: resellers manage their team with the permission matrix (switching to the
  assistant role shows the change); admins see all assistants read-only with an emergency Disable.

## Fixes found on the way

- `.gitignore` had `coverage/`, which also ignored `app/(workspace)/esim/coverage/` (for git and for the CSS
  scanner). Now anchored to the root (`/coverage/`, `/out/`), plus an explicit CSS `@source` for that folder.
- Demo store saves at once (a reload right after an action kept it).
- Seed top-ups spread every 10–12 days per wallet (was one day for everyone).

## Open decisions

- The one-screen dashboard groups usage (period / monthly) and money (transactions / revenue and profit)
  behind a small switch each, so all eight charts fit. Keep, or prefer the scrolling page with every chart
  visible at once?
- Resellers have `discounts:view` but no Discounts tab (Q-RDISC); their discount is already in their prices.
