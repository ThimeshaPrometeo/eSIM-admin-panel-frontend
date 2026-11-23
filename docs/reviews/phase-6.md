# Phase 6: operations

Screenshots (dark): `review-artifacts/phase-6/` (git-ignored).

## Built

- **Usage** (8.7, `/esim/usage`): period, reseller (admin/staff), plan and country filters, MB/GB/TB; data,
  charge (resellers: "Your cost") and Yesim cost (admin/staff); usage over time with the estimated tail
  dashed, top countries; per-eSIM table (customer, reseller, plans, countries, main network); CSV and PDF
  (watermark per the Settings switch; downloads audit-logged). Figures come from the same rated lines as
  wallets and statements.
- **Customers** (8.16, `/esim/customers`, `/esim/customers/[id]`): search, reseller filter (admin/staff,
  including direct customers), add and edit; customer page with their eSIMs (status, current plan, last
  activity) and "Sell eSIM" that starts the sell flow with the customer chosen. The reseller page's
  Customers tab opens the same page.
- **Inventory** (8.8, `/esim/inventory`, admin/staff): free now, assigned, new eSIMs in the last 30 days,
  how long the stock lasts at that pace; warning when close to or below the low-stock threshold; 90-day
  free/assigned chart with the threshold line; deliveries.
- **Alerts and rules** (8.9, `/esim/alerts`): inbox with status, type and reseller filters; admin and staff
  acknowledge and resolve (who and when shown); usage rules (threshold, notify or suspend, on/off, add,
  edit, delete). Resellers and assistants see their own alerts, view only.
- **Yesim connection** (8.27, `/esim/yesim`, admin manages, staff view): account found by the backend
  (reseller, sponsor, network profile, write mode), sale limits, balance check (same figures as Profit →
  Reconciliation) with the house wallet, price list version with a link to "what changed", the six jobs
  with last run, duration and result, "Sync now" for catalogue and price list (admin), webhook addresses
  to copy, latest notifications from Yesim.
- Price list and Profit accept `?tab=` so other pages can link to History and Reconciliation.

## Demo data

Alerts are built from the data (usage %, wallet balances, the ledger, deliveries), so every alert's
figures match the pages it links to. Stock went below the warning exactly once, on the day the low-stock
alert reports. Details in `docs/demo-data.md` §5.

## Checked

- Tests: 79 (new: usage report = wallet usage charges; resellers see only their own usage without Yesim
  cost; stock never negative and the alert's dip is real; alert scoping and who may change them; every
  alert type present; rules add/change/remove; customer scope and edits; Yesim balance = reconciliation;
  "Sync now" updates the price list time and is admin-only).
- Browser run as admin, staff and reseller at 1440 × 900: no page scroll, no table overflow, no console
  errors, no external requests; no "Soon" items left in the reseller navigation.
