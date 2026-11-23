# Phase 5: financial transparency

Screenshots (dark and light): `review-artifacts/phase-5/` (git-ignored).

## Built (spec 8.32, with 8.22, 8.23, 8.26)

- **One rating module** (`lib/demo/rating.ts`): every usage line is one plan, one day, one network, priced
  with the Yesim price, markup and discount in force that day. Ledger, holds, statements, dashboard, eSIM
  usage and the profit report all come from it, so every page agrees to the cent.
- **Price list, admin tabs:** Prices | Price breakdown (Yesim €/MB → markup → discount → reseller price, per
  MB and per GB, profit per GB, margin; one reseller or a comparison of up to three) | Simulator | History
  (Yesim price versions with "what changed" and the effect on what resellers pay; markup changes with who,
  when, why and from which day). Resellers see their own price list only.
- **Pricing simulator** (price list and the reseller's Pricing tab): reseller or direct sale, country or one
  network, an amount of data; the formula written out in five steps with real numbers.
- **"How was this charged?"** from eSIM detail (each plan's charged amount), transactions, wallet ledgers
  and statement lines: network lines with MB, Yesim rate, cost, markup and discount, price, charge, profit,
  version, estimated or final. Resellers see only their own price and charge. Direct sales show the retail
  price as revenue.
- **Profit and costs:** revenue, Yesim cost, profit, margin, data; over time and a waterfall (Yesim cost +
  markup − discounts = revenue → profit); breakdowns by reseller, country, network and plan with margin;
  highest and lowest margins; reconciliation with the Yesim balance (deposits, cost to date, reported
  balance, tolerance); CSV and watermarked PDF.
- **Invoices and statements:** sequential numbers per type and year (ST/RC/INV-YYYY-NNNN); statements with
  opening balance + top-ups − usage = closing balance, lines per plan per day (each opens its breakdown),
  released holds; watermarked PDF per the Settings switch.
- **Settings:** pricing (default and retail markup, spread warning), billing, stock, documents (watermark per
  document type, tax wording), security; admin edits, staff read only.

## Demo data

Yesim price versions v13 (−74 days) and v14 (−32 days) with rises and falls; markup changes for Blue Horizon
(12% → 15%) and Nomad Connect (35% → 40%); usage split across two networks on about a third of days;
supplier deposits with a €3.82 difference inside the €5 tolerance. Details in `docs/demo-data.md` §5.1.

Demo changes to markup, discount and retail markup apply from the next day, so charges already made never
change (CONVENTIONS §6).

## Checked

- Tests: 72 (new: every line follows the formula with that day's rates; ledgers, holds, statements and
  profit equal the rated charges; statement balances close; the waterfall closes; simulator = breakdown;
  resellers never receive cost or markup; markup change shows at once and never reprices past charges).
- Browser run in dark and light at 1440 × 900 as admin and reseller: no page scroll, no table overflow
  (pages and side sheets), no console errors, no external requests.
